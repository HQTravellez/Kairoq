"use strict";
// Server functions for Create apps. Each functions/<name>.js file is a handler:
//   export default async function (request, { user, db, secrets, fetch, ai, email, crypto, log }) {
//     return { status: 200, json: { ok: true } };
//   }
// Handlers run inside QuickJS compiled to WebAssembly: no Node APIs, no file system,
// no network except the guarded fetch below, with time and memory limits per call.
const crypto=require('crypto'),dns=require('dns'),net=require('net'),http=require('http'),https=require('https');

const MAX_FUNCTIONS=20,MAX_SOURCE=50000,MAX_RESPONSE=1024*1024,MAX_FETCHES=10,MAX_FETCH_BYTES=5*1024*1024;
// Host calls (db, sql, secrets, ai, email, fetch) per invocation, and how many may be waiting at once,
// so one function cannot flood the main thread or the shared SQL pool.
const MAX_HOST_CALLS=200,MAX_HOST_INFLIGHT=8;
let modulePromise=null;
function quickjs(){
 if(!modulePromise)modulePromise=import('quickjs-emscripten').then(m=>m.newQuickJSWASMModule().then(mod=>({mod,deadline:m.shouldInterruptAfterDeadline})));
 return modulePromise;
}
function fail(status,message){return Object.assign(Error(message),{status})}
function timeoutMs(){return Math.min(30000,Math.max(1000,Number(process.env.KAIROQ_FUNCTION_TIMEOUT_MS||10000)))}

// ---------- source rules ----------
function functionName(file){const m=/^functions\/([a-z][a-z0-9-]{0,39})\.js$/.exec(file);return m&&m[1]}
function validate(files){
 const errors=[],names=Object.keys(files).filter(f=>f.startsWith('functions/'));
 if(names.length>MAX_FUNCTIONS)errors.push('Up to '+MAX_FUNCTIONS+' server functions are allowed.');
 for(const f of names){
  const code=files[f];
  if(!functionName(f)){errors.push('Invalid function path: '+f+' (use functions/<lowercase-name>.js).');continue}
  if(typeof code!=='string'||code.length>MAX_SOURCE){errors.push(f+' must be text under 50 KB.');continue}
  const defaults=(code.match(/\bexport\s+default\b/g)||[]).length;
  if(defaults!==1)errors.push(f+' must have exactly one "export default async function (request, ctx) { ... }".');
  if(/^\s*import\s|\bimport\s*\(|\brequire\s*\(/m.test(code))errors.push(f+': server functions cannot import modules. Use the ctx helpers: fetch, db, secrets, ai, email, crypto.');
  if(/^\s*export\s+(?!default\b)/m.test(code))errors.push(f+': only the default export is allowed.');
 }
 return errors;
}
function list(files){return Object.keys(files).map(functionName).filter(Boolean).sort()}

// ---------- guarded fetch ----------
function privateAddress(ip){
 if(net.isIPv4(ip)){
  const [a,b]=ip.split('.').map(Number);
  return a===0||a===10||a===127||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===192&&b===0)||(a===198&&(b===18||b===19))||a>=224;
 }
 const v=ip.toLowerCase();
 if(v==='::'||v==='::1')return true;
 const mapped=/^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);if(mapped)return privateAddress(mapped[1]);
 // IPv4 embedded in IPv6 in hex form (::ffff:7f00:1, 64:ff9b::7f00:1, ::7f00:1): check the IPv4 part.
 const hex=/^(?:::ffff:|64:ff9b::|::ffff:0:|::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(v);
 if(hex){const n=(parseInt(hex[1],16)<<16>>>0)+parseInt(hex[2],16);return privateAddress([n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join('.'))}
 if(/^(::ffff:|64:ff9b:)/.test(v))return true;
 // 6to4 (2002::/16) and Teredo (2001:0::/32) embed IPv4 addresses that may be private.
 if(/^2002:/.test(v)||/^2001:0{0,4}:/.test(v))return true;
 return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
}
// DNS lookup that refuses private addresses at connect time, so rebinding cannot reach internal hosts.
function guardedLookup(hostname,options,callback){
 dns.lookup(hostname,{...options,all:true},(err,addresses)=>{
  if(err)return callback(err);
  const list=Array.isArray(addresses)?addresses:[{address:addresses,family:options.family||4}];
  const bad=list.find(a=>privateAddress(a.address));
  if(bad||!list.length)return callback(Object.assign(Error('Blocked address for '+hostname),{code:'EBLOCKED'}));
  if(options.all)return callback(null,list);
  callback(null,list[0].address,list[0].family);
 });
}
function guardedFetch({url,method='GET',headers={},body}){
 return new Promise((resolve,reject)=>{
  let u;try{u=new URL(String(url))}catch{return reject(fail(400,'fetch: invalid URL'))}
  if(!/^https?:$/.test(u.protocol))return reject(fail(400,'fetch: only http and https URLs are allowed'));
  if(u.username||u.password)return reject(fail(400,'fetch: credentials in URLs are not allowed'));
  if(net.isIP(u.hostname.replace(/^\[|\]$/g,''))&&privateAddress(u.hostname.replace(/^\[|\]$/g,'')))return reject(fail(400,'fetch: private network addresses are blocked'));
  if(u.port&&!['80','443','8080','8443'].includes(u.port))return reject(fail(400,'fetch: only ports 80, 443, 8080 and 8443 are allowed'));
  const h={};for(const [k,v] of Object.entries(headers||{}))if(/^[A-Za-z0-9-]{1,64}$/.test(k)&&!/^(host|connection|content-length|transfer-encoding)$/i.test(k))h[k]=String(v).slice(0,4000);
  const payload=body===undefined||body===null?null:Buffer.from(String(body));
  if(payload&&payload.length>MAX_FETCH_BYTES)return reject(fail(413,'fetch: request body too large'));
  if(payload)h['Content-Length']=payload.length;
  h['User-Agent']=h['User-Agent']||'KairoqFunctions/1.0';
  const lib=u.protocol==='https:'?https:http;
  // agent:false: a fresh direct connection, never an environment proxy that would skip the address check.
  const req=lib.request(u,{method:String(method).toUpperCase(),headers:h,lookup:guardedLookup,timeout:15000,agent:false},res=>{
   const chunks=[];let size=0;
   res.on('data',c=>{size+=c.length;if(size>MAX_FETCH_BYTES){req.destroy(fail(413,'fetch: response larger than 5 MB'));return}chunks.push(c)});
   res.on('end',()=>{const headersOut={};for(const [k,v] of Object.entries(res.headers))headersOut[k]=Array.isArray(v)?v.join(', '):String(v);resolve({status:res.statusCode,headers:headersOut,body:Buffer.concat(chunks).toString('utf8')})});
   res.on('error',reject);
  });
  req.on('timeout',()=>req.destroy(fail(504,'fetch: timed out after 15 seconds')));
  req.on('error',e=>reject(e.code==='EBLOCKED'?fail(400,'fetch: private network addresses are blocked'):e));
  if(payload)req.write(payload);req.end();
 });
}

// ---------- sandbox ----------
// Inside the sandbox, I/O host calls return promises; pure helpers (crypto, log) are synchronous.
const PRELUDE=`
const __unwrap=t=>{const r=JSON.parse(t);if(r.error)throw new Error(r.error);return r.value};
const __call=async(name,args)=>__unwrap(await __host(name,JSON.stringify(args===undefined?null:args)));
const __sync=(name,args)=>__unwrap(__hostSync(name,JSON.stringify(args===undefined?null:args)));
const __fetch=async(url,o={})=>{const r=await __call('fetch',{url:String(url),method:o.method||'GET',headers:o.headers||{},body:o.body==null?undefined:String(o.body)});return{ok:r.status>=200&&r.status<300,status:r.status,headers:{get:k=>r.headers[String(k).toLowerCase()]??null},text:async()=>r.body,json:async()=>JSON.parse(r.body)}};
const __col=n=>({list:(o={})=>__call('db.list',{collection:n,...o}),get:id=>__call('db.get',{collection:n,id}),create:d=>__call('db.create',{collection:n,data:d}),update:(id,d)=>__call('db.update',{collection:n,id,data:d}),remove:id=>__call('db.remove',{collection:n,id})});
const __log=(...a)=>__sync('log',{args:a.map(v=>typeof v==='string'?v:(()=>{try{return JSON.stringify(v)}catch{return String(v)}})())});
globalThis.console={log:__log,info:__log,warn:__log,error:__log};
globalThis.fetch=__fetch;
globalThis.__ctx=user=>({user,fetch:__fetch,log:__log,
 db:{collection:__col,
  sql:(q,...p)=>Array.isArray(q)&&q.raw?__call('sql',{query:q.join('?'),params:p}):__call('sql',{query:String(q),params:p.length===1&&Array.isArray(p[0])?p[0]:p}),
  batch:steps=>__call('sql.batch',{steps})},
 secrets:{get:n=>__call('secret',{name:String(n)})},
 ai:{chat:o=>__call('ai.chat',o),ask:(q,o={})=>__call('ai.ask',{...o,question:q})},
 email:{send:o=>__call('email',o)},
 crypto:{hmacSha256Hex:(k,m)=>__sync('hmac',{key:String(k),message:String(m)}),sha256Hex:m=>__sync('sha256',{message:String(m)}),timingSafeEqual:(a,b)=>__sync('tseq',{a:String(a),b:String(b)}),randomId:()=>__sync('random',null)}});
`;
// host: {secret(name), db(op,args,user), ai(args,user), email(args,user)}
// Host helpers only accept strings (the sandbox can call them with anything).
function str(v){return typeof v==='string'?v.slice(0,5000000):''}
async function run({source,request,user,host}){
 const {mod,deadline}=await quickjs();
 const runtime=mod.newRuntime();
 runtime.setMemoryLimit(16*1024*1024);runtime.setMaxStackSize(512*1024);
 const limit=timeoutMs(),stop=Date.now()+limit;
 runtime.setInterruptHandler(deadline(stop));
 const context=runtime.newContext(),logs=[];let fetches=0,hostCalls=0,inflight=0,disposed=false;
 const io={
  fetch:async a=>{if(++fetches>MAX_FETCHES)throw fail(429,'fetch: at most '+MAX_FETCHES+' requests per call');return guardedFetch(a)},
  secret:async a=>host.secret(a.name),
  'db.list':a=>host.db('list',a,user),'db.get':a=>host.db('get',a,user),'db.create':a=>host.db('create',a,user),'db.update':a=>host.db('update',a,user),'db.remove':a=>host.db('remove',a,user),
  sql:a=>{if(!host.sql)throw fail(501,'SQL is not available here');return host.sql(a.query,a.params)},
  'sql.batch':a=>{if(!host.sqlBatch)throw fail(501,'SQL is not available here');return host.sqlBatch(a.steps)},
  'ai.chat':a=>host.ai(a,user),
  'ai.ask':a=>{if(!host.ask)throw fail(501,'ai.ask is not available here');return host.ask(a,user)},
  email:a=>host.email(a,user)
 };
 const pure={
  hmac:a=>crypto.createHmac('sha256',str(a.key)).update(str(a.message)).digest('hex'),
  sha256:a=>crypto.createHash('sha256').update(str(a.message)).digest('hex'),
  tseq:a=>{const x=Buffer.from(str(a.a)),y=Buffer.from(str(a.b));return x.length===y.length&&crypto.timingSafeEqual(x,y)},
  random:()=>crypto.randomUUID(),
  log:a=>{if(logs.length<50)logs.push(a.args.join(' ').slice(0,1000));return null}
 };
 const encode=(value,error)=>JSON.stringify(error?{error:String(error.message||error).slice(0,500)}:{value:value===undefined?null:value});
 const hostSync=context.newFunction('__hostSync',(nameH,argsH)=>{
  const fn=pure[context.getString(nameH)];
  try{if(!fn)throw Error('Unknown host call');return context.newString(encode(fn(JSON.parse(context.getString(argsH)))))}
  catch(e){return context.newString(encode(null,e))}
 });
 const hostAsync=context.newFunction('__host',(nameH,argsH)=>{
  const name=context.getString(nameH),args=context.getString(argsH),deferred=context.newPromise();
  (async()=>{
   let text;
   try{
    if(Date.now()>stop)throw fail(504,'Function timed out');
    if(++hostCalls>MAX_HOST_CALLS)throw fail(429,'At most '+MAX_HOST_CALLS+' database, secret, AI, email and fetch calls per request');
    if(inflight>=MAX_HOST_INFLIGHT)throw fail(429,'At most '+MAX_HOST_INFLIGHT+' calls can run at once; await them in smaller batches');
    const fn=io[name];if(!fn)throw Error('Unknown host call');
    inflight++;try{text=encode(await fn(JSON.parse(args)))}finally{inflight--}
   }
   catch(e){text=encode(null,e)}
   if(disposed)return;
   const h=context.newString(text);deferred.resolve(h);h.dispose();
   runtime.executePendingJobs();
  })();
  return deferred.handle;
 });
 context.setProp(context.global,'__hostSync',hostSync);hostSync.dispose();
 context.setProp(context.global,'__host',hostAsync);hostAsync.dispose();
 const dump=h=>{const e=context.dump(h);h.dispose();return String(e&&e.message||JSON.stringify(e))};
 let timer;
 try{
  const code=source.replace(/\bexport\s+default\b/,'globalThis.__handler =');
  for(const [label,text] of [['prelude.js',PRELUDE],['function.js',code]]){
   const r=context.evalCode(text,label);
   if(r.error){const msg=dump(r.error);throw fail(/interrupted/.test(msg)?504:500,/interrupted/.test(msg)?'Function timed out':'Function error: '+msg.slice(0,500))}
   r.value.dispose();
  }
  const input=JSON.stringify({request,user});
  const started=context.evalCode(`(async()=>{const i=${input};if(typeof globalThis.__handler!=='function')throw new Error('The file must export a default function');const r=await globalThis.__handler(i.request,globalThis.__ctx(i.user));return JSON.stringify(r===undefined?{status:204}:r)})()`,'call.js');
  if(started.error)throw fail(500,'Function error: '+dump(started.error).slice(0,500));
  const settled=context.resolvePromise(started.value);started.value.dispose();
  runtime.executePendingJobs();
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(fail(504,'Function timed out after '+Math.round(limit/1000)+' seconds')),limit+250)});
  const outcome=await Promise.race([settled,timeout]);
  if(outcome.error){const msg=dump(outcome.error);throw fail(/interrupted/.test(msg)?504:500,/interrupted/.test(msg)?'Function timed out after '+Math.round(limit/1000)+' seconds':'Function error: '+msg.slice(0,500))}
  const text=context.getString(outcome.value);outcome.value.dispose();
  if(text.length>MAX_RESPONSE)throw fail(500,'Function response is larger than 1 MB');
  return{result:JSON.parse(text),logs};
 }finally{
  clearTimeout(timer);disposed=true;
  try{context.dispose()}catch{}try{runtime.dispose()}catch{}
 }
}
// Turns a handler's return value into an HTTP response.
// Redirects stay on the app's own pages unless the app is served from its own domain
// (custom domain or sites host), so Kairoq's domain is never an open redirect.
function safeLocation(v,external){const u=String(v).slice(0,2000);if(/^\/(?![\/\\])/.test(u))return u;return external&&/^https?:\/\//i.test(u)?u:null}
function respond(res,result,cors,{externalRedirects=false}={}){
 const r=result&&typeof result==='object'?result:{json:result};
 const status=Number.isInteger(r.status)&&r.status>=200&&r.status<600?r.status:200;
 // Responses never run scripts on Kairoq's origin: every body gets a sandbox CSP.
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",...cors};
 const extra={};
 if(r.headers&&typeof r.headers==='object')for(const [k,v] of Object.entries(r.headers)){const key=k.toLowerCase();if(key==='content-type')extra['Content-Type']=String(v).slice(0,200);else if(key==='cache-control')headers['Cache-Control']=String(v).slice(0,200);else if(key==='location'){const loc=safeLocation(v,externalRedirects);if(loc)headers['Location']=loc}}
 let body='';
 if(r.json!==undefined){headers['Content-Type']='application/json; charset=utf-8';body=JSON.stringify(r.json)}
 else if(r.body!==undefined){body=String(r.body);headers['Content-Type']=extra['Content-Type']||'text/plain; charset=utf-8'}
 res.writeHead(status,headers);res.end(status===204?undefined:body);
}
module.exports={validate,list,run,respond,guardedFetch,guardedLookup,privateAddress,functionName};

// ---------- worker pool (main thread) ----------
// Functions run in worker threads so a slow or stuck function never blocks the
// server; one that overruns its time limit is stopped by terminating its worker.
const pool={workers:[],queue:[],seq:0};
function need(fn){if(typeof fn!=='function')throw fail(501,'This is not available here');return fn}
function poolSize(){const n=Number(process.env.KAIROQ_FUNCTION_WORKERS??4);return Number.isInteger(n)&&n>=1?Math.min(n,16):4}
function invoke({source,request,user,host}){
 return new Promise((resolve,reject)=>{
  if(pool.queue.length>=100)return reject(fail(503,'Server functions are busy. Try again shortly.'));
  pool.queue.push({source,request,user,host,resolve,reject});pump();
 });
}
function spawn(){
 const {Worker}=require('worker_threads');
 const w={thread:new Worker(require('path').join(__dirname,'functions-worker.js')),job:null};
 w.thread.unref();
 w.thread.on('message',async msg=>{
  const job=w.job;if(!job)return;
  if(msg.type==='host'){
   let reply;
   try{
    // A call that arrives after its function's time is up is refused without doing the work.
    if(Date.now()>job.deadline)throw fail(504,'Function timed out');
    const value=msg.op==='secret'?await job.host.secret(msg.args.name):msg.op==='db'?await job.host.db(msg.args.op,msg.args.args,msg.user):msg.op==='ai'?await job.host.ai(msg.args,msg.user):msg.op==='ai.ask'?await need(job.host.ask)(msg.args,msg.user):msg.op==='email'?await job.host.email(msg.args,msg.user):msg.op==='sql'?await need(job.host.sql)(msg.args.query,msg.args.params):msg.op==='sqlBatch'?await need(job.host.sqlBatch)(msg.args.steps):(()=>{throw Error('Unknown host call')})();
    reply={type:'hostReply',callId:msg.callId,value:value===undefined?null:value};
   }catch(e){reply={type:'hostReply',callId:msg.callId,error:String(e.message||e),status:e.status}}
   if(w.job===job)w.thread.postMessage(reply);
   return;
  }
  if(msg.type==='done'&&msg.id===job.id){
   clearTimeout(job.timer);w.job=null;w.thread.unref();
   msg.ok?job.resolve(msg.out):job.reject(fail(msg.status||500,msg.message));
   pump();
  }
 });
 const retire=err=>{const i=pool.workers.indexOf(w);if(i>=0)pool.workers.splice(i,1);if(w.job){clearTimeout(w.job.timer);const j=w.job;w.job=null;j.reject(err)}pump()};
 w.thread.on('error',e=>retire(fail(500,'Function worker crashed: '+e.message)));
 w.thread.on('exit',()=>retire(fail(504,'Function stopped')));
 pool.workers.push(w);
 return w;
}
function pump(){
 while(pool.queue.length){
  let w=pool.workers.find(x=>!x.job);
  if(!w&&pool.workers.length<poolSize())w=spawn();
  if(!w)return;
  const job=pool.queue.shift();job.id=++pool.seq;
  const limit=timeoutMs();job.deadline=Date.now()+limit;
  // On timeout the worker leaves the pool at once, so no new job is sent to a thread that is still stuck.
  job.timer=setTimeout(()=>{const j=w.job;w.job=null;const i=pool.workers.indexOf(w);if(i>=0)pool.workers.splice(i,1);j&&j.reject(fail(504,'Function timed out after '+Math.round(limit/1000)+' seconds'));w.thread.terminate().catch(()=>{});pump()},limit+1000);
  w.job=job;w.thread.ref();
  w.thread.postMessage({type:'run',id:job.id,source:job.source,request:job.request,user:job.user,timeoutMs:limit});
 }
}
module.exports.invoke=invoke;
module.exports.poolStats=()=>({workers:pool.workers.length,busy:pool.workers.filter(w=>w.job).length,queued:pool.queue.length,max:poolSize()});
