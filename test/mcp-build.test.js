"use strict";
// The MCP build tools: an agent platform creates, builds, inspects and publishes an app with an API key.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-mcpb-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_HOSTING_CREDITS='0'; // hosting billing has its own tests (hosting-billing.test.js)
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_HOSTING_REGISTRY=path.join(tmp,'hosting.json');
process.env.KAIROQ_FREE_CREDITS='20';
process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_PUBLIC_URL='https://kairoq.example';
const builder=require('../react-builder'),createApi=require('../create-api'),backend=require('../react-backend'),hosting=require('../react-hosting'),runtime=require('../runtime-check');

const OK="export default function App() { return <h1>Acme Rooms</h1>; }\n";
// Shows the page but throws once it is open: a blank page instead would not be kept at all
// (the preview stays on the working version, see test/rollback-journey.test.js).
const BROKEN="import { useEffect } from 'react';\nexport default function App() { useEffect(() => { setTimeout(() => { throw new Error('boom'); }); }, []); return <h1>Broken</h1>; }\n";
const prompts=[];
const callModel=async(opts,parse)=>{
 const sys=opts.messages[0].content,last=opts.messages.at(-1).content,user=typeof last==='string'?last:last.map(p=>p.text||'').join('');
 if(/decide what to look up on the web/.test(sys))return parse(JSON.stringify({web:[]}));
 if(/coding engine/.test(sys)){const req=user.split('Request:').pop();prompts.push(req.trim().slice(0,60));
  // Like a stubborn bug: the automatic fix attempts after "Break it" leave it broken; only the explicit fix request works.
  if(/Break it|Find the cause in the code/.test(user))return parse(JSON.stringify({plan:[],message:'Broke it.',files:{'src/App.jsx':BROKEN}}));
  return parse(JSON.stringify({plan:['Write the page'],message:'Built the rooms page.',files:{'src/App.jsx':OK}}))}
 throw Error('unexpected prompt: '+sys.slice(0,60));
};
function request(server,method,url,{body,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=body!==undefined?Buffer.from(JSON.stringify(body)):null;
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const text=Buffer.concat(c).toString();let json=null;try{json=JSON.parse(text)}catch{}resolve({status:res.statusCode,headers:res.headers,text,json})})});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
}
let server,ip=0;const base=()=>'http://127.0.0.1:'+server.address().port;
test.before(async()=>{
 server=http.createServer(async(req,res)=>{
  const deps={callModel,checkRuntime:u=>runtime.check(base()+u),inspect:(u,o)=>runtime.inspect(base()+u,o),browse:(u,o)=>runtime.session(base()+u,o)};
  if(req.url==='/mcp')return void await require('../kairoq-mcp').handle(req,res,deps);
  if(await backend.handle(req,res))return;if(builder.handlePreview(req,res))return;if(hosting.handlePath(req,res))return;
  if(await createApi.handle(req,res,{isOwner:()=>false,secure:false,...deps}))return;
  res.writeHead(404);res.end();
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
});
test.after(async()=>{server.close();await runtime.close();fs.rmSync(tmp,{recursive:true,force:true})});
async function signup(email){const r=await request(server,'POST','/api/create/signup',{body:{email,password:'password1'},headers:{'x-forwarded-for':'10.6.0.'+(++ip)}});assert.equal(r.status,201,r.text);return r.headers['set-cookie'][0].split(';')[0]}
async function apiKey(cookie){return (await request(server,'POST','/api/create/api-keys',{headers:{cookie},body:{name:'Paperclip'}})).json.created.key}
const wait=ms=>new Promise(r=>setTimeout(r,ms));

test('an agent platform creates, builds, follows, inspects and publishes an app through MCP',async()=>{
 const cookie=await signup('platform@example.com'),key=await apiKey(cookie);
 const rpc=async(method,params,k=key)=>(await request(server,'POST','/mcp',{headers:{authorization:'Bearer '+k},body:{jsonrpc:'2.0',id:1,method,params}})).json;
 const call=async(name,args,k)=>(await rpc('tools/call',{name,arguments:args},k)).result;
 const init=await rpc('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'paperclip',version:'1'}});
 assert.match(init.result.instructions,/create_project/);
 const tpl=(await call('list_templates',{})).structuredContent.templates;
 assert.ok(tpl.some(t=>t.id==='restaurant'));
 // From a template, without a prompt: ready at once.
 const fromTpl=(await call('create_project',{template:'restaurant',name:'Bistro'})).structuredContent;
 assert.equal(fromTpl.name,'Bistro');assert.match(fromTpl.preview_url,/^\/builder\/p\//);assert.equal(fromTpl.job_id,undefined);
 // From a prompt: the first build starts and get_job follows it.
 const made=await call('create_project',{prompt:'A booking page for Acme Rooms'});
 assert.ok(!made.isError,made.content[0].text);
 const {project_id,job_id,credits}=made.structuredContent;
 assert.match(project_id,/^[a-f0-9]{12}$/);assert.ok(job_id);assert.equal(credits,1);
 let j;for(let i=0;i<600;i++){j=(await call('get_job',{job_id})).structuredContent;if(['complete','failed'].includes(j.status))break;await wait(50)}
 assert.equal(j.status,'complete',JSON.stringify(j));
 assert.equal(j.version,2,'version 1 is the blank start');assert.deepEqual(j.changed,['src/App.jsx']);assert.match(j.message,/rooms page/);assert.equal(j.credits,1);assert.deepEqual(j.runtime_errors,[]);
 assert.equal(prompts.at(-1),'A booking page for Acme Rooms');
 // A change that leaves errors: the job says so and the next fix is on us.
 const bad=(await call('build',{project_id,message:'Break it'})).structuredContent;
 let b;for(let i=0;i<600;i++){b=(await call('get_job',{job_id:bad.job_id})).structuredContent;if(['complete','failed'].includes(b.status))break;await wait(50)}
 assert.equal(b.status,'complete');
 if(runtime.available()){assert.ok(b.runtime_errors.length,'the browser test caught the error');assert.equal(b.fix_on_us,true);
  const fix=(await call('build',{project_id,message:'Fix the crash',fix:true})).structuredContent;
  assert.equal(fix.on_us,true);assert.equal(fix.credits,0);
  let f;for(let i=0;i<600;i++){f=(await call('get_job',{job_id:fix.job_id})).structuredContent;if(['complete','failed'].includes(f.status))break;await wait(50)}
  assert.equal(f.status,'complete');assert.equal(f.credits,0);assert.deepEqual(f.runtime_errors,[]);
 }else{
  await call('build',{project_id,message:'Fix the crash'});await wait(300);
 }
 // The project's state, then live.
 const p=(await call('get_project',{project_id})).structuredContent;
 assert.equal(p.role,'owner');assert.ok(p.current_version>=2);assert.equal(p.published,null);assert.ok(p.files.includes('src/App.jsx'));assert.equal(p.messages.at(-1).role,'assistant');
 const pub=await call('publish',{project_id,slug:'acme-rooms'});
 assert.ok(!pub.isError,pub.content[0].text);
 assert.equal(pub.structuredContent.urls.path,'https://kairoq.example/sites/acme-rooms/');
 assert.match(pub.content[0].text,/Live at https:\/\/kairoq.example\/sites\/acme-rooms\//);
 assert.equal((await call('get_project',{project_id})).structuredContent.published.urls.path,'https://kairoq.example/sites/acme-rooms/');
 const site=await request(server,'GET','/sites/acme-rooms/');
 assert.equal(site.status,200);
 // Another account's key cannot touch it.
 const other=await apiKey(await signup('other@example.com'));
 assert.equal((await call('build',{project_id,message:'Hi'},other)).isError,true);
 assert.equal((await call('get_project',{project_id},other)).isError,true);
 assert.equal((await call('publish',{project_id},other)).isError,true);
 assert.equal((await call('get_job',{job_id},other)).isError,true);
 // Bad input is a tool error, not a crash.
 assert.equal((await call('create_project',{})).isError,true);
 assert.equal((await call('create_project',{template:'nope'})).isError,true);
 assert.equal((await call('build',{project_id,message:''})).isError,true);
});
