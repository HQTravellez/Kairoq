"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-tier1-'));
process.env.NODE_ENV='test';
// These tests script the model's replies in order; the design brief has its own tests.
process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_FREE_CREDITS='20';
process.env.OPENROUTER_API_KEY='test-only-not-a-real-key';
const {callBuilderModel}=require('../server');
const builder=require('../react-builder'),createApi=require('../create-api'),runtime=require('../runtime-check'),backend=require('../react-backend');

const GOOD='export default function App(){return <main className="p-6"><h1>Hello studio</h1></main>}\n';
const CRASH='export default function App(){const x=null;return <main>{x.missing}</main>}\n';
function reply(obj){return(_opts,parse)=>Promise.resolve(parse(JSON.stringify(obj)))}
function sse(chunks,usage){
 const enc=new TextEncoder();
 return new ReadableStream({start(c){for(const t of chunks)c.enqueue(enc.encode('data: '+JSON.stringify({choices:[{delta:{content:t}}]})+'\n\n'));c.enqueue(enc.encode(': OPENROUTER PROCESSING\n\ndata: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}],usage})+'\n\ndata: [DONE]\n\n'));c.close()}});
}

test('streamed model output reaches onToken and parses like a normal response',async()=>{
 const saved={...process.env},original=global.fetch,bodies=[];
 Object.assign(process.env,{KAIROQ_BUILDER_MODE:'paid-first',KAIROQ_BUILDER_PAID_APPROVED:'true',KAIROQ_BUILDER_MONTHLY_LIMIT_USD:'100'});
 const full=JSON.stringify({message:'Streamed.',files:{'src/App.jsx':GOOD}});
 global.fetch=async(_u,init)=>{bodies.push(JSON.parse(init.body));return new Response(sse([full.slice(0,20),full.slice(20,60),full.slice(60)],{cost:0.0001,prompt_tokens:10,completion_tokens:20}),{status:200,headers:{'Content-Type':'text/event-stream'}})};
 try{
  const seen=[];
  const result=await callBuilderModel({messages:[{role:'user',content:'x'}],onToken:(d,all)=>seen.push(all.length)},builder.parseEdit);
  assert.equal(result.message,'Streamed.');
  assert.equal(bodies[0].stream,true);
  assert.deepEqual(seen,[20,60,full.length]);
 }finally{global.fetch=original;process.env=saved}
});

test('the Pro tier tries the Pro models first and needs paid approval',async()=>{
 const saved={...process.env},original=global.fetch,models=[];
 Object.assign(process.env,{KAIROQ_BUILDER_MODE:'paid-first',KAIROQ_BUILDER_PAID_APPROVED:'true',KAIROQ_PRO_MODELS:'anthropic/claude-test,openai/gpt-test',KAIROQ_VISION_MODELS:'google/vision-test'});
 global.fetch=async(_u,init)=>{const b=JSON.parse(init.body);models.push(b.model);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({message:'ok',files:{'src/App.jsx':GOOD}})}}],usage:{cost:0.001}}),{status:200})};
 try{
  await callBuilderModel({messages:[],tier:'pro'},builder.parseEdit);
  await callBuilderModel({messages:[],tier:'vision'},builder.parseEdit);
  assert.deepEqual(models,['anthropic/claude-test','google/vision-test']);
  process.env.KAIROQ_BUILDER_PAID_APPROVED='false';
  await assert.rejects(callBuilderModel({messages:[],tier:'pro'},builder.parseEdit),/Pro and image models need/);
 }finally{global.fetch=original;process.env=saved}
});

test('runtime errors found after the build are sent back and fixed before saving',async()=>{
 const meta=builder.create({name:'Runtime',owner:'owner'});await builder.initialize(meta);
 const replies=[{message:'v1',files:{'src/App.jsx':CRASH}},{message:'fixed',files:{'src/App.jsx':GOOD}}];let call=0;const seen=[];
 const checks=[];
 const result=await builder.edit(meta.id,'make it',{
  callModel:(opts,parse)=>{seen.push([...opts.messages]);return reply(replies[call++])(opts,parse)},
  checkRuntime:async url=>{checks.push(url);return{errors:checks.length===1?['Uncaught error: TypeError: Cannot read properties of null']:[]}}});
 assert.equal(result.attempts,2);assert.equal(result.message,'fixed');assert.deepEqual(result.runtime_errors,[]);
 assert.match(JSON.stringify(seen[1].at(-1)),/opening it in a browser showed these problems/);
 assert.match(checks[0],/\/builder\/p\/[a-f0-9]{12}-[a-f0-9]{24}\/v\/2\//);
 // If the last attempt still has runtime errors, the version is saved with them so the user can press "Fix it".
 const m2=builder.create({name:'Runtime2',owner:'owner'});await builder.initialize(m2);
 const r2=await builder.edit(m2.id,'x',{callModel:reply({message:'v',files:{'src/App.jsx':CRASH}}),checkRuntime:async()=>({errors:['Blank page']})});
 assert.equal(r2.attempts,3);assert.deepEqual(r2.runtime_errors,['Blank page']);
 assert.deepEqual(builder.loadMeta(m2.id).versions.at(-1).runtime_errors,['Blank page']);
});

test('headless Chromium catches a crashing app and passes a working one',{skip:!runtime.available()&&'Chromium not installed'},async()=>{
 const crash=builder.create({name:'Crash',owner:'owner'});await builder.initialize(crash);
 await builder.edit(crash.id,'x',{callModel:reply({message:'v',files:{'src/App.jsx':CRASH}})});
 const ok=builder.create({name:'Ok',owner:'owner'});await builder.initialize(ok);
 await builder.edit(ok.id,'x',{callModel:reply({message:'v',files:{'src/App.jsx':GOOD}})});
 const server=http.createServer((req,res)=>{if(!builder.handlePreview(req,res)){res.writeHead(404);res.end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const bad=await runtime.check(base+builder.previewUrl(builder.loadMeta(crash.id)));
  assert.ok(bad.errors.some(e=>/Uncaught error: TypeError/.test(e)),bad.errors.join('\n'));
  assert.ok(bad.errors.some(e=>/Blank page/.test(e)));
  const good=await runtime.check(base+builder.previewUrl(builder.loadMeta(ok.id)));
  assert.deepEqual(good.errors,[]);
 }finally{server.close();await runtime.close()}
});

test('discuss mode answers without creating a version',async()=>{
 const meta=builder.create({name:'Talk',owner:'owner'});await builder.initialize(meta);
 const r=await builder.discuss(meta.id,'How should I add bookings?',{callModel:(_o,parse)=>Promise.resolve(parse('1. Add a bookings collection\n2. Add a form'))});
 assert.match(r.message,/bookings collection/);
 const after=builder.loadMeta(meta.id);
 assert.equal(after.current_version,1);
 assert.deepEqual(after.messages.map(m=>[m.role,m.mode]),[['user','discuss'],['assistant','discuss']]);
});

function request(server,method,url,{body,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=body?JSON.stringify(body):null;
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}:{}),...headers}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>{let json;try{json=JSON.parse(data)}catch{}resolve({status:res.statusCode,headers:res.headers,text:data,json})})});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
}
async function waitJob(s,cookie,id){for(let i=0;i<300;i++){const r=await request(s,'GET','/api/create/jobs/'+id,{headers:{cookie}});if(['complete','failed'].includes(r.json.job.status))return r.json.job;await new Promise(r=>setTimeout(r,30))}throw Error('timeout')}
const PNG='data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(40)]).toString('base64');

test('credits follow the mode and tier; images are saved as project uploads; Fix it and live events work',async()=>{
 process.env.KAIROQ_BUILDER_PAID_APPROVED='true';
 let lastOpts;
 const callModel=async(opts,parse)=>{lastOpts={...opts,messages:[...opts.messages]};if(opts.onToken){opts.onToken('x','{"message":"Adding');opts.onToken('y','{"message":"Adding a logo","files":{"src/App.jsx":"export');await new Promise(r=>setTimeout(r,450))}
  return(parse===builder.parseEdit?parse(JSON.stringify({message:'Done',files:{'src/App.jsx':GOOD}})):parse('A plan.'))};
 const s=http.createServer(async(req,res)=>{if(await backend.handle(req,res))return;if(builder.handlePreview(req,res))return;if(await createApi.handle(req,res,{isOwner:()=>false,callModel,secure:false}))return;res.writeHead(404);res.end()});
 await new Promise(r=>s.listen(0,'127.0.0.1',r));
 try{
  const signup=await request(s,'POST','/api/create/signup',{body:{email:'t1@example.com',password:'password1'}});
  const cookie=signup.headers['set-cookie'][0].split(';')[0];
  const me=(await request(s,'GET','/api/create/me',{headers:{cookie}})).json;
  assert.deepEqual(me.tiers.map(t=>[t.id,t.credits,t.enabled]),[['standard',1,true],['pro',5,true]]);
  const created=await request(s,'POST','/api/create/projects',{headers:{cookie},body:{name:'Logo test'}});
  const id=created.json.project.id;
  const credits=async()=>(await request(s,'GET','/api/create/me',{headers:{cookie}})).json.viewer.account.credits;
  // Pro build with an image: 5 + 1 credits, image saved, vision not used because Pro is chosen.
  let job=(await request(s,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'Use my logo',tier:'pro',images:[{name:'My Logo.png',dataUrl:PNG}]}})).json.job;
  // Live events stream the job until it finishes.
  const events=await request(s,'GET','/api/create/jobs/'+job.id+'/events',{headers:{cookie}});
  assert.match(events.headers['content-type'],/text\/event-stream/);
  const frames=events.text.split('\n\n').filter(f=>f.startsWith('data: ')).map(f=>JSON.parse(f.slice(6)));
  assert.equal(frames.at(-1).status,'complete');
  assert.ok(frames.some(f=>f.stream&&f.stream.message==='Adding a logo'&&f.stream.files.includes('src/App.jsx')),JSON.stringify(frames.map(f=>f.stream)));
  assert.equal(frames[0].owner,undefined,'job owner is not exposed');
  assert.equal(lastOpts.tier,'pro');
  assert.equal(await credits(),20-6);
  const assets=(await request(s,'GET','/api/create/projects/'+id+'/assets',{headers:{cookie}})).json.assets;
  assert.deepEqual(assets.map(a=>a.path),['./uploads/my-logo.png']);
  assert.match(JSON.stringify(lastOpts.messages.at(-1)),/\.\/uploads\/my-logo\.png/);
  assert.match(JSON.stringify(lastOpts.messages.at(-1)),/image_url/);
  const meta=builder.loadMeta(id);
  const preview=await request(s,'GET',builder.previewUrl(meta)+'uploads/my-logo.png');
  assert.equal(preview.status,200,'uploads are copied into the build');
  // Standard build with an image uses the vision models.
  job=(await request(s,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'Match this screenshot',images:[{name:'shot.png',dataUrl:PNG}]}})).json.job;
  await waitJob(s,cookie,job.id);assert.equal(lastOpts.tier,'vision');assert.equal(await credits(),14-2);
  // Discuss: 1 credit, no new version.
  const before=builder.loadMeta(id).current_version;
  job=(await request(s,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'What next?',mode:'discuss'}})).json.job;
  assert.equal((await waitJob(s,cookie,job.id)).result.message,'A plan.');
  assert.equal(builder.loadMeta(id).current_version,before);assert.equal(await credits(),11);
  // Fix it sends the reported errors to the model.
  assert.equal((await request(s,'POST','/api/create/projects/'+id+'/fix',{headers:{cookie},body:{}})).status,400);
  job=(await request(s,'POST','/api/create/projects/'+id+'/fix',{headers:{cookie},body:{errors:['Uncaught TypeError: x is undefined']}})).json.job;
  await waitJob(s,cookie,job.id);
  assert.match(JSON.stringify(lastOpts.messages.at(-1)),/Uncaught TypeError: x is undefined/);
  assert.equal(await credits(),10);
  // Bad images are rejected before any credit is taken.
  assert.equal((await request(s,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'x',images:[{name:'a.png',dataUrl:'data:image/png;base64,AAAA'}]}})).status,400);
  assert.equal(await credits(),10);
 }finally{s.close()}
});

test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
