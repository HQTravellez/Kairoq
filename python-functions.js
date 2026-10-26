"use strict";
// Python server functions: functions/<name>.py with
//   async def handler(request, ctx):
//       return {'status': 200, 'json': {...}}
// Each runs in python-runner.mjs (Pyodide, Python in WebAssembly) in a child process that has no
// environment, runs as an unprivileged user when the server runs as root, may only read
// Pyodide's own files, cannot start processes, load addons or turn strings into code, and has
// no network of its own. Database, secrets, fetch (the same guarded fetch as JavaScript
// functions), AI and email go through the host calls here, with the same per-call limits.
// One process serves one app at a time, so apps never share a Python interpreter; idle
// processes stop after a few minutes, and a call that runs too long or uses too much memory
// stops its process.
const path=require('path'),fs=require('fs'),{fork}=require('child_process');

const MAX_SOURCE=50000,MAX_RESPONSE=1024*1024,MAX_FETCHES=10,MAX_HOST_CALLS=200,MAX_HOST_INFLIGHT=8;
const IDLE_MS=5*60000,START_MS=60000,MEMORY_MB=Number(process.env.KAIROQ_PYTHON_MEMORY_MB||512);
function fail(status,message){return Object.assign(Error(message),{status})}
function timeoutMs(){return Math.min(30000,Math.max(1000,Number(process.env.KAIROQ_FUNCTION_TIMEOUT_MS||10000)))}
function maxProcesses(){const n=Number(process.env.KAIROQ_PYTHON_WORKERS??2);return Number.isInteger(n)&&n>=1?Math.min(n,8):2}
function pyodideDir(){return path.dirname(require.resolve('pyodide/package.json'))}

// ---------- source rules ----------
// Pyodide's own modules give a way around the host calls; ctypes reaches raw memory.
const FORBIDDEN=/^\s*(?:from|import)\s+(js|pyodide|pyodide_js|_pyodide|micropip|ctypes|_ctypes)\b/m;
function validate(file,code){
 const errors=[];
 if(typeof code!=='string'||code.length>MAX_SOURCE)return[file+' must be text under 50 KB.'];
 if(!/^(async\s+)?def\s+handler\s*\(/m.test(code))errors.push(file+' must define "async def handler(request, ctx):".');
 if(FORBIDDEN.test(code))errors.push(file+': Python functions cannot import js, pyodide, micropip or ctypes. Use the ctx helpers: ctx.fetch, ctx.db, ctx.secrets, ctx.ai, ctx.email.');
 if(/\b(__import__|importlib)\b/.test(code))errors.push(file+': import modules with a plain "import" line.');
 return errors;
}

// ---------- processes ----------
const procs=[];// {child, key, ready, job, queue, idleTimer, memTimer}
function spawn(key){
 const runner=path.join(__dirname,'python-runner.mjs'),dir=pyodideDir();
 const opts={env:{},execArgv:['--permission','--allow-fs-read='+dir,'--allow-fs-read='+runner,'--disallow-code-generation-from-strings','--max-old-space-size=256'],stdio:['ignore','ignore','ignore','ipc'],serialization:'json'};
 if(process.getuid&&process.getuid()===0){opts.uid=65534;opts.gid=65534}
 const p={key,ready:null,job:null,queue:[],child:fork(runner,[],opts)};
 p.ready=new Promise((resolve,reject)=>{
  const t=setTimeout(()=>reject(fail(503,'Python did not start')),START_MS);
  p.child.once('message',m=>{clearTimeout(t);m&&m.type==='ready'?resolve():reject(fail(503,'Python did not start'))});
  p.child.once('exit',()=>{clearTimeout(t);reject(fail(503,'Python stopped while starting'))});
 });
 p.ready.catch(()=>{});
 p.child.on('message',m=>onMessage(p,m));
 p.child.on('exit',()=>retire(p,fail(500,'The Python function stopped')));
 // Memory is watched from outside: WebAssembly memory is not covered by Node's heap limit.
 p.memTimer=setInterval(()=>{try{const kb=Number((fs.readFileSync('/proc/'+p.child.pid+'/status','utf8').match(/VmRSS:\s+(\d+)/)||[])[1]);if(kb>MEMORY_MB*1024)stop(p,fail(507,'The Python function used more than '+MEMORY_MB+' MB'))}catch{}},500);
 p.memTimer.unref();
 procs.push(p);
 return p;
}
function stop(p,err){retire(p,err);try{p.child.kill('SIGKILL')}catch{}}
function retire(p,err){
 const i=procs.indexOf(p);if(i>=0)procs.splice(i,1);
 clearInterval(p.memTimer);clearTimeout(p.idleTimer);
 if(p.job){clearTimeout(p.job.timer);const j=p.job;p.job=null;j.reject(err)}
 for(const j of p.queue.splice(0))j.reject(err);
}
// A process for this app: its own if one is running, else a new one (stopping the longest-idle
// process of another app when the limit is reached).
function processFor(key){
 let p=procs.find(x=>x.key===key);
 if(p)return p;
 if(procs.length>=maxProcesses()){
  const idle=procs.filter(x=>!x.job&&!x.queue.length).sort((a,b)=>(a.lastUsed||0)-(b.lastUsed||0))[0];
  if(!idle)return null;
  stop(idle,fail(503,'stopped'));
 }
 return spawn(key);
}

// ---------- host calls ----------
function hostCalls(job){
 const {host,user}=job,guarded=require('./react-functions').guardedFetch;
 const io={
  fetch:async a=>{if(++job.fetches>MAX_FETCHES)throw fail(429,'fetch: at most '+MAX_FETCHES+' requests per call');return host.fetch?host.fetch(a):guarded(a)},
  secret:a=>host.secret(String(a.name||'')),
  'db.list':a=>host.db('list',a,user),'db.get':a=>host.db('get',a,user),'db.create':a=>host.db('create',a,user),'db.update':a=>host.db('update',a,user),'db.remove':a=>host.db('remove',a,user),
  sql:a=>{if(!host.sql)throw fail(501,'SQL is not available here');return host.sql(String(a.query||''),Array.isArray(a.params)?a.params:[])},
  'sql.batch':a=>{if(!host.sqlBatch)throw fail(501,'SQL is not available here');return host.sqlBatch(a.steps)},
  'ai.chat':a=>host.ai(a,user),
  'ai.ask':a=>{if(!host.ask)throw fail(501,'ai.ask is not available here');return host.ask(a,user)},
  'ai.extract':a=>{if(!host.extract)throw fail(501,'ai.extract is not available here');return host.extract(a,user)},
  email:a=>host.email(a,user),
 };
 return async(op,argsText)=>{
  if(Date.now()>job.deadline)throw fail(504,'Function timed out');
  if(++job.hostCalls>MAX_HOST_CALLS)throw fail(429,'At most '+MAX_HOST_CALLS+' database, secret, AI, email and fetch calls per request');
  if(job.inflight>=MAX_HOST_INFLIGHT)throw fail(429,'At most '+MAX_HOST_INFLIGHT+' calls can run at once; await them in smaller batches');
  const fn=io[op];if(!fn)throw fail(400,'Unknown host call');
  let args;try{args=JSON.parse(String(argsText||'{}'))}catch{throw fail(400,'Bad host call')}
  if(!args||typeof args!=='object')throw fail(400,'Bad host call');
  job.inflight++;try{return await fn(args)}finally{job.inflight--}
 };
}
async function onMessage(p,m){
 const job=p.job;
 if(!m||!job)return;
 if(m.type==='host'){
  let text;
  try{const v=await job.call(String(m.op),m.args);text=JSON.stringify({value:v===undefined?null:v})}
  catch(e){text=JSON.stringify({error:String(e.message||e).slice(0,500)})}
  if(p.job===job)p.child.send({type:'hostReply',callId:m.callId,text});
  return;
 }
 if(m.type==='done'&&m.id===job.id){
  clearTimeout(job.timer);p.job=null;p.lastUsed=Date.now();
  const logs=Array.isArray(m.logs)?m.logs.slice(0,50).map(l=>String(l).slice(0,1000)):[];
  if(!m.ok)job.reject(fail(500,'Function error: '+String(m.message||'failed').slice(0,500)));
  else if(String(m.text).length>MAX_RESPONSE)job.reject(fail(500,'Function response is larger than 1 MB'));
  else{let result;try{result=JSON.parse(m.text)}catch{result=null}job.resolve({result,logs})}
  next(p);
 }
}
function next(p){
 clearTimeout(p.idleTimer);
 const job=p.queue.shift();
 if(!job){p.idleTimer=setTimeout(()=>{if(!p.job&&!p.queue.length)stop(p,fail(503,'idle'))},IDLE_MS);p.idleTimer.unref();return}
 const limit=timeoutMs();
 job.deadline=Date.now()+limit;job.call=hostCalls(job);p.job=job;
 job.timer=setTimeout(()=>stop(p,fail(504,'Function timed out after '+Math.round(limit/1000)+' seconds')),limit+500);
 p.child.send({type:'run',id:job.id,source:job.source,request:job.request,user:job.user});
}
let seq=0;
// key: which app (and copy) the call is for; calls for one key run one after another.
function invoke({key,source,request,user,host}){
 return new Promise((resolve,reject)=>{
  const p=processFor(String(key));
  if(!p)return reject(fail(503,'Python functions are busy. Try again shortly.'));
  if(p.queue.length>=20)return reject(fail(503,'This app\'s Python functions are busy. Try again shortly.'));
  p.queue.push({id:++seq,source,request,user,host,resolve,reject,fetches:0,hostCalls:0,inflight:0});
  p.ready.then(()=>{if(!p.job)next(p)},e=>retire(p,e));
 });
}
function shutdown(){for(const p of procs.slice())stop(p,fail(503,'shutdown'))}
module.exports={invoke,validate,shutdown,stats:()=>({processes:procs.length,busy:procs.filter(p=>p.job).length,max:maxProcesses()})};
