"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-thinking-'));
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'acc.sqlite');
process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_BUILD_WORKERS='0';
const builder=require('../react-builder'),{streamSnapshot}=require('../create-api');
test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));

test('the plan streams item by item, before the code',()=>{
 assert.deepEqual(streamSnapshot('{"plan":["Add a bo','build').plan,['Add a bo']);
 assert.deepEqual(streamSnapshot('{"plan":["Add a booking form","Save it to \\"bookings\\""','build').plan,['Add a booking form','Save it to "bookings"']);
 const done=streamSnapshot('{"plan":["A","B"],"message":"Done","files":{"src/App.jsx":"export default 1"}}','build');
 assert.deepEqual(done.plan,['A','B']);assert.equal(done.message,'Done');assert.deepEqual(done.files,['src/App.jsx']);
 assert.deepEqual(streamSnapshot('{"message":"No plan","files":{}}','build').plan,[]);
});

test('a change keeps its plan, the model\'s reasoning and how long it thought',async()=>{
 const meta=builder.create({name:'Thinking'});await builder.initialize(meta);
 const files=builder.loadFiles(meta.id,1),live=[];let seen;
 const callModel=async(opts,parse)=>{
  seen=opts;
  opts.onReasoning('The user','The user');opts.onReasoning(' wants a title.','The user wants a title.');
  await new Promise(r=>setTimeout(r,30));
  const reply=JSON.stringify({plan:['Add a title to the page','  ',''],message:'Added a title.',files:{'src/App.jsx':files['src/App.jsx'].replace(/<\/main>|<\/div>\s*\);\s*}\s*$/,m=>'<h1>Hello</h1>'+m)}});
  opts.onToken(reply,reply);
  return parse(reply);
 };
 const r=await builder.edit(meta.id,'Add a title',{callModel,onStream:()=>{},onThinking:t=>live.push(t)});
 assert.equal(typeof seen.onReasoning,'function');
 assert.deepEqual(live,['The user','The user wants a title.']);
 assert.deepEqual(r.plan,['Add a title to the page'],'empty plan items are dropped');
 const m=builder.loadMeta(meta.id).messages.at(-1);
 assert.deepEqual(m.plan,['Add a title to the page']);
 assert.equal(m.thinking,'The user wants a title.');
 assert.ok(m.thought_ms>=25,'time until the first word of the answer: '+m.thought_ms);
 assert.equal(m.attempts,undefined,'first-try changes do not say "fixed"');
 assert.match(builder.SYSTEM_PROMPT,/"plan":\[/);
});

test('Build mode records a timeline: thought, plan, edits, build and fixes',async()=>{
 const meta=builder.create({name:'Timeline'});await builder.initialize(meta);
 const files=builder.loadFiles(meta.id,1),live=[];
 const good=files['src/App.jsx'].replace(/<\/main>|<\/div>\s*\);\s*}\s*$/,m=>'<h1>Hi</h1>'+m);
 const queue=[{plan:['Add a greeting'],message:'x',files:{'src/App.jsx':'export default function App( {'}},{plan:['ignored'],message:'Added a greeting.',files:{'src/App.jsx':good,'src/Hello.jsx':'export default function Hello(){return null}\n'}}];
 const callModel=async(opts,parse)=>{opts.onReasoning&&opts.onReasoning('Hmm','Hmm');return parse(JSON.stringify(queue.shift()))};
 const r=await builder.edit(meta.id,'Add a greeting',{callModel,onEvent:ev=>live.push(ev.length)});
 const types=r.timeline.map(e=>e.t);
 assert.deepEqual(types.slice(0,2),['think','plan']);
 assert.ok(types.includes('fix'),'the failed build is shown as a fix: '+types.join(','));
 assert.equal(r.timeline.find(e=>e.t==='build'&&!e.ok).detail.length>0,true);
 const edits=r.timeline.filter(e=>e.t==='edit');
 assert.deepEqual(edits.slice(-2).map(e=>e.file+':'+e.kind),['src/App.jsx:edited','src/Hello.jsx:created']);
 assert.ok(r.timeline.some(e=>e.t==='build'&&e.ok));
 assert.ok(live.length>=5&&live.at(-1)===r.timeline.length,'events stream live');
 const m=builder.loadMeta(meta.id).messages.at(-1);
 assert.equal(m.timeline.length,r.timeline.length);assert.ok(m.duration_ms>=0);
 // The editor gets the full reasoning only on recent messages.
 assert.equal(builder.detail(meta.id).messages.at(-1).timeline[0].text,'Hmm');
});

test('Agent mode records reads, edits, builds and its thoughts',async()=>{
 const agent=require('../react-agent');
 const meta=builder.create({name:'Agent timeline'});await builder.initialize(meta);
 const files=builder.loadFiles(meta.id,1);
 const steps=[{thought:'Look at the page first.',actions:[{tool:'read_files',paths:['src/App.jsx']}]},
  {thought:'Add a heading.',actions:[{tool:'write_files',files:{'src/App.jsx':files['src/App.jsx'].replace(/<\/main>|<\/div>\s*\);\s*}\s*$/,m=>'<h1>Hi</h1>'+m)}},{tool:'finish',message:'Added a heading.'}]}];
 const callModel=async(opts,parse)=>parse(JSON.stringify(steps.shift()));
 const r=await agent.run(meta.id,'Add a heading',{callModel});
 const tl=r.timeline;
 assert.deepEqual(tl.filter(e=>e.t==='think').map(e=>e.title),['Look at the page first.','Add a heading.']);
 assert.deepEqual(tl.find(e=>e.t==='read').files,['src/App.jsx']);
 assert.equal(tl.find(e=>e.t==='edit').file,'src/App.jsx');
 assert.ok(tl.some(e=>e.t==='build'&&e.ok));
 assert.equal(builder.loadMeta(meta.id).messages.at(-1).timeline.length,tl.length);
});

test('the Changes API returns each changed file before and after',async()=>{
 const http=require('http'),createApi=require('../create-api');
 const server=http.createServer(async(req,res)=>{if(await createApi.handle(req,res,{isOwner:()=>false,callModel:async()=>{throw Error('no model')},secure:false}))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const call=(method,url,{body,headers={}}={})=>new Promise((resolve,reject)=>{const payload=body?Buffer.from(JSON.stringify(body)):null;const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{let json;try{json=JSON.parse(Buffer.concat(c))}catch{}resolve({status:res.statusCode,headers:res.headers,json})})});req.on('error',reject);if(payload)req.write(payload);req.end()});
 try{
  const signup=await call('POST','/api/create/signup',{body:{email:'changes@example.com',password:'password1'},headers:{'x-forwarded-for':'10.77.0.1'}});
  const cookie=signup.headers['set-cookie'][0].split(';')[0];
  const id=(await call('POST','/api/create/projects',{headers:{cookie},body:{name:'Changes'}})).json.project.id;
  const files=builder.loadFiles(id,1);
  await builder.saveSource(id,{...files,'src/App.jsx':files['src/App.jsx']+'\n// v2\n','src/New.jsx':'export default function New(){return null}\n'},{summary:'Two changes',changed:['src/App.jsx','src/New.jsx']});
  const r=await call('GET','/api/create/projects/'+id+'/changes?version=2',{headers:{cookie}});
  assert.equal(r.status,200);assert.equal(r.json.previous,1);
  const byPath=Object.fromEntries(r.json.files.map(f=>[f.path,f]));
  assert.equal(byPath['src/New.jsx'].status,'created');assert.equal(byPath['src/New.jsx'].before,null);
  assert.equal(byPath['src/App.jsx'].status,'edited');assert.match(byPath['src/App.jsx'].after,/\/\/ v2/);assert.doesNotMatch(byPath['src/App.jsx'].before,/\/\/ v2/);
  assert.equal((await call('GET','/api/create/projects/'+id+'/changes?version=9',{headers:{cookie}})).status,404);
  assert.equal((await call('GET','/api/create/projects/'+id+'/changes?version=2')).status,401,'sign-in needed');
 }finally{server.close()}
});
