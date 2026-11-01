"use strict";
// kairoq_browse: while it builds, the builder can use its own app in a real browser. Kairoq
// builds the current files as a scratch version, the browser agent tries the goal on a test copy
// of the data, and the builder gets back what happened step by step (react-builder.js selfBrowse).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-browse-'));
Object.assign(process.env,{NODE_ENV:'test',KAIROQ_DESIGN_BRIEF:'off',KAIROQ_BROWSER_JUDGE:'off',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'projects'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite')});
const builder=require('../react-builder'),backend=require('../react-backend'),runtime=require('../runtime-check'),engine=require('../opencode-engine');

const MAIN="import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<App />);\n";
const app=works=>({'src/main.jsx':MAIN,'src/App.jsx':`import React, { useState } from 'react';
export default function App() {
  const [n, setN] = useState(0);
  return <main><h1>Tally</h1><p>Count: {n}</p><button onClick={() => ${works?'setN(n + 1)':'null'}}>Add one</button></main>;
}
`});
// The scripted visitor: presses "Add one" until the page says "Count: 2", gives up after 3 tries.
let presses=0;
const callModel=async(opts,parse)=>{
 const user=opts.messages.at(-1).content,text=typeof user==='string'?user:user[0].text;
 let reply;
 if(/Count: 2/.test(text))reply={thought:'The count shows 2.',actions:[{action:'done',value:'The count shows 2.'}]};
 else if(presses>=3)reply={thought:'Pressing Add one does nothing.',actions:[{action:'give_up'}]};
 else{const m=/\[(\d+)\][^\n]*Add one/.exec(text);presses++;reply={thought:'Press Add one.',actions:[{action:'click',target:Number(m[1])}]}}
 return parse(JSON.stringify(reply));
};
let server;
test.before(async()=>{
 server=http.createServer(async(req,res)=>{if(await backend.handle(req,res))return;if(builder.handlePreview(req,res))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
});
test.after(async()=>{server.close();await runtime.close();fs.rmSync(tmp,{recursive:true,force:true})});
const browse=(u,o)=>runtime.session('http://127.0.0.1:'+server.address().port+u,o);

test('the builder uses its own app: a working button reaches the goal',{skip:!runtime.available()&&'no Chromium',timeout:120000},async()=>{
 const meta=builder.create({name:'Tally',owner:'owner'});presses=0;
 // The owner watches in Kairoq's browser pane: frames with a screenshot, the address and the steps.
 const frames=[];
 const r=await builder.selfBrowse(meta.id,meta,app(true),{goal:'Press Add one until the count shows 2'},{browse,callModel,onBrowser:f=>frames.push(f)});
 assert.ok(frames.length>=2,'frames streamed: '+frames.length);
 assert.match(frames[0].title,/^Testing: Press Add one/);
 assert.match(frames[0].url,/127\.0\.0\.1/);
 assert.ok(/^[A-Za-z0-9+/=]{200,}$/.test(frames[0].screenshot),'a JPEG as base64');
 assert.ok(frames.at(-1).steps.some(x=>/click "Add one"/.test(x)),'the steps are listed: '+JSON.stringify(frames.at(-1).steps));
 assert.match(r,/^Reached the goal \(desktop\)/);
 assert.match(r,/click "Add one"/);
 assert.match(r,/It works for this goal\./);
 assert.ok(!fs.readdirSync(path.join(process.env.KAIROQ_REACT_PROJECTS_DIR,meta.id)).some(f=>/9\d{5}/.test(f)),'scratch version removed');
});

test('a button that does nothing is reported, step by step, with what to fix',{skip:!runtime.available()&&'no Chromium',timeout:120000},async()=>{
 const meta=builder.create({name:'Broken tally',owner:'owner'});presses=0;
 const r=await builder.selfBrowse(meta.id,meta,app(false),{goal:'Press Add one until the count shows 2',device:'phone'},{browse,callModel});
 assert.match(r,/^Gave up \(phone\)/);
 assert.match(r,/nothing changed on screen/);
 assert.match(r,/Fix what stopped it/);
});

test('no goal, or files that do not build, never open a browser',async()=>{
 const meta=builder.create({name:'Empty',owner:'owner'});let opened=0;
 const b=async()=>{opened++;return null};
 assert.match(await builder.selfBrowse(meta.id,meta,app(true),{goal:' '},{browse:b,callModel}),/Say what a visitor should be able to do/);
 assert.match(await builder.selfBrowse(meta.id,meta,{'src/main.jsx':MAIN,'src/App.jsx':'export default function App( {'},{goal:'add one'},{browse:b,callModel}),/does not build|build failed/i);
 assert.equal(opened,0);
 assert.match(builder.browseReport('x','desktop',{outcome:'completed',steps:[]},['Uncaught error: boom']),/Errors on the page:\n- Uncaught error: boom[\s\S]*Fix what stopped it/);
});

test('the real OpenCode program calls kairoq_browse and gets the report back',{skip:!process.env.KAIROQ_TEST_OPENCODE_BIN&&'set KAIROQ_TEST_OPENCODE_BIN to run OpenCode itself',timeout:300000},async()=>{
 const offered=[],results=[],asked=[];
 const plan=[['kairoq_browse',{goal:'Add a task and mark it done',device:'phone'}]];
 const model=http.createServer((q,r)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{
  const j=JSON.parse(b||'{}'),tools=(j.tools||[]).map(t=>t.function&&t.function.name),done=(j.messages||[]).filter(m=>m.role==='tool');if(tools.length)offered.push(tools);
  for(const m of done)results[done.indexOf(m)]=typeof m.content==='string'?m.content:JSON.stringify(m.content);
  r.writeHead(200,{'Content-Type':'text/event-stream'});const send=o=>r.write('data: '+JSON.stringify({id:'c',object:'chat.completion.chunk',created:1,model:j.model,...o})+'\n\n');
  const next=tools.length?plan[done.length]:null;
  if(next)send({choices:[{index:0,delta:{role:'assistant',tool_calls:[{index:0,id:'call_'+done.length,type:'function',function:{name:next[0],arguments:JSON.stringify(next[1])}}]},finish_reason:'tool_calls'}],usage:{prompt_tokens:100,completion_tokens:5}});
  else send({choices:[{index:0,delta:{role:'assistant',content:tools.length?'Tried it.':'Title'},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:5}});
  r.end('data: [DONE]\n\n');
 })});
 const route=http.createServer((q,r)=>{let b='';q.on('data',c=>b+=c);q.on('end',async()=>{try{const j=JSON.parse(b||'{}');r.end(JSON.stringify({report:await engine.runCheck(String(q.headers.authorization||'').replace(/^Bearer\s+/i,''),j.tool||'check',j.args||{})}))}catch(e){r.statusCode=404;r.end('{}')}})});
 await new Promise(r=>model.listen(0,'127.0.0.1',r));await new Promise(r=>route.listen(0,'127.0.0.1',r));
 Object.assign(process.env,{KAIROQ_OPENCODE_BIN:process.env.KAIROQ_TEST_OPENCODE_BIN,EXPLABS_API_KEY:'test-key',KAIROQ_OPENCODE_BASE_URL:'http://127.0.0.1:'+model.address().port+'/v1',KAIROQ_OPENCODE_MODEL:'m1',NO_PROXY:'127.0.0.1,localhost'});
 engine.configure({enforceBudget:null,recordUsage:null,checkUrl:'http://127.0.0.1:'+route.address().port+'/'});
 const s=engine.session({rules:engine.rules('Rules.'),browse:async(files,a)=>{asked.push({files:Object.keys(files),...a});return'Reached the goal (phone): Add a task and mark it done'}});
 try{
  const r=await s.reply({files:{'src/App.jsx':'export default function App(){return null}\n'},prompt:'A to-do app'});
  assert.ok((offered.find(t=>t.includes('kairoq_browse'))||[]).length,'kairoq_browse offered');
  assert.deepEqual(asked,[{files:['src/App.jsx'],goal:'Add a task and mark it done',device:'phone'}]);
  assert.match(results[0]||'',/Reached the goal \(phone\)/);
  assert.match(r.message,/Tried it/);
 }finally{s.close();model.close();route.close();engine.configure({checkUrl:null});for(const k of ['KAIROQ_OPENCODE_BIN','EXPLABS_API_KEY','KAIROQ_OPENCODE_BASE_URL','KAIROQ_OPENCODE_MODEL'])delete process.env[k]}
});
