"use strict";
// OpenCode as the build engine (opencode-engine.js). A stand-in "opencode" program edits the
// files the way OpenCode does and prints its JSON events; Kairoq's builder then builds, tests
// and repairs as usual. With KAIROQ_TEST_OPENCODE_BIN set, the real program also runs against a
// local stand-in model server.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-oc-test-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const engine=require('../opencode-engine'),builder=require('../react-builder');

// The stand-in: first run writes broken JSX, a run with --session repairs it.
const FAKE=path.join(tmp,'opencode');
fs.writeFileSync(FAKE,`#!/usr/bin/env node
const fs=require('fs'),path=require('path');
const a=process.argv.slice(2),dir=a[a.indexOf('--dir')+1],resumed=a.includes('--session'),prompt=a.at(-1);
fs.appendFileSync(${JSON.stringify(path.join(tmp,'calls.jsonl'))},JSON.stringify({args:a,resumed,prompt,env:Object.keys(process.env),config:JSON.parse(process.env.OPENCODE_CONFIG_CONTENT),rules:fs.readFileSync(path.join(dir,'AGENTS.md'),'utf8').slice(0,200)})+'\\n');
const out=o=>process.stdout.write(JSON.stringify({sessionID:'ses_fake1',timestamp:Date.now(),...o})+'\\n');
out({type:'step_start',part:{type:'step-start'}});
const file=path.join(dir,'src/App.jsx');
fs.writeFileSync(file,resumed?'export default function App(){return <main><h1>Fixed by OpenCode</h1></main>}\\n':'export default function App(){return <main><h1>Broken</main>}\\n');
fs.writeFileSync(path.join(dir,'src/Extra.jsx'),'export default function Extra(){return null}\\n');
out({type:'tool_use',part:{type:'tool',tool:'edit',state:{status:'completed',input:{filePath:file}}}});
out({type:'step_finish',part:{type:'step-finish',reason:'stop',tokens:{input:1200,output:300},cost:0}});
out({type:'text',part:{type:'text',text:resumed?'Fixed the heading.':'Added a heading.'}});
`,{mode:0o755});

test('OpenCode edits the files; a build error is sent back to the same session and fixed',async()=>{
 process.env.KAIROQ_BUILD_ENGINE='opencode';process.env.KAIROQ_OPENCODE_BIN=FAKE;process.env.EXPLABS_API_KEY='test-key';
 const used=[];engine.configure({enforceBudget:async()=>({daily:0,monthly:0}),recordUsage:async u=>{used.push(u)}});
 try{
  assert.equal(engine.enabled(),true);
  const meta=builder.create({name:'Oc',owner:'owner'});await builder.initialize(meta);
  const r=await builder.edit(meta.id,'add a heading',{callModel:()=>{throw Error('Kairoq model must not be called')},checkRuntime:async()=>({errors:[]})});
  assert.equal(r.attempts,2,'the broken build was repaired');
  const files=builder.loadFiles(meta.id,r.version);
  assert.match(files['src/App.jsx'],/Fixed by OpenCode/);
  assert.ok(files['src/Extra.jsx'],'new files come back');
  assert.match(r.message,/Fixed the heading/);
  assert.equal(builder.loadMeta(meta.id).versions.at(-1).engine,'opencode');
  const calls=fs.readFileSync(path.join(tmp,'calls.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(calls.length,2);
  assert.equal(calls[0].resumed,false);assert.equal(calls[1].resumed,true,'the repair continues the session');
  assert.match(calls[0].prompt,/Request: add a heading/);
  assert.match(calls[1].prompt,/Vite build failed/);
  assert.match(calls[0].rules,/no shell/);
  const perm=calls[0].config.permission;
  assert.deepEqual([perm.bash,perm.webfetch,perm.external_directory],['deny','deny','deny']);
  assert.ok(!calls[0].env.some(k=>/OPENROUTER|EXPLABS|DATABASE|STRIPE|RESEND/.test(k)),'only the model key, under its own name');
  assert.equal(used.length,2);assert.equal(used[0].input_tokens,1200);assert.ok(used[0].cost>0,'cost from the token rates');
 }finally{delete process.env.KAIROQ_BUILD_ENGINE;delete process.env.KAIROQ_OPENCODE_BIN;delete process.env.EXPLABS_API_KEY}
});

test('without KAIROQ_BUILD_ENGINE the builder keeps its own model',()=>{
 process.env.KAIROQ_OPENCODE_BIN=FAKE;process.env.EXPLABS_API_KEY='test-key';
 try{assert.equal(engine.enabled(),false)}finally{delete process.env.KAIROQ_OPENCODE_BIN;delete process.env.EXPLABS_API_KEY}
});

test('the folder is kept in step with the files, and the rules drop the JSON reply format',()=>{
 const dir=fs.mkdtempSync(path.join(tmp,'sync-'));
 engine.sync(dir,{'src/a.js':'1','src/b.js':'2'});
 engine.sync(dir,{'src/a.js':'3'});
 assert.deepEqual(engine.readTree(dir),{'src/a.js':'3'});
 const rules=engine.rules('Rules here.\nRespond with ONLY a JSON object, no markdown fences:\n{...}','Project memory: x');
 assert.match(rules,/Rules here\./);assert.doesNotMatch(rules,/Respond with ONLY/);assert.match(rules,/Project memory: x/);
});

// The real OpenCode against a stand-in model that answers with one edit, then a sentence.
test('the real OpenCode program edits a file through the model',{skip:!process.env.KAIROQ_TEST_OPENCODE_BIN&&'set KAIROQ_TEST_OPENCODE_BIN to run OpenCode itself'},async()=>{
 let dir='';const seen=[];
 const server=http.createServer((q,r)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{
  const j=JSON.parse(b||'{}'),tools=(j.tools||[]).map(t=>t.function&&t.function.name),done=(j.messages||[]).some(m=>m.role==='tool');seen.push(tools);
  r.writeHead(200,{'Content-Type':'text/event-stream'});const send=o=>r.write('data: '+JSON.stringify({id:'c',object:'chat.completion.chunk',created:1,model:j.model,...o})+'\n\n');
  if(tools.length&&!done)send({choices:[{index:0,delta:{role:'assistant',tool_calls:[{index:0,id:'call_1',type:'function',function:{name:'edit',arguments:JSON.stringify({filePath:path.join(dir,'src/App.jsx'),oldString:'Hello',newString:'Hello from OpenCode'})}}]},finish_reason:'tool_calls'}],usage:{prompt_tokens:1000,completion_tokens:40}});
  else send({choices:[{index:0,delta:{role:'assistant',content:done?'Changed the greeting.':'Greeting'},finish_reason:'stop'}],usage:{prompt_tokens:900,completion_tokens:8}});
  r.end('data: [DONE]\n\n');
 })});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 Object.assign(process.env,{KAIROQ_OPENCODE_BIN:process.env.KAIROQ_TEST_OPENCODE_BIN,EXPLABS_API_KEY:'test-key',KAIROQ_OPENCODE_BASE_URL:'http://127.0.0.1:'+server.address().port+'/v1',KAIROQ_OPENCODE_MODEL:'m1',NO_PROXY:'127.0.0.1,localhost'});
 const s=engine.session({rules:engine.rules('Rules.')});dir=s.dir;
 try{
  const r=await s.reply({files:{'src/App.jsx':'export default function App(){return <h1>Hello</h1>}\n'},prompt:'Change the greeting'});
  assert.deepEqual(Object.keys(r.files),['src/App.jsx']);assert.match(r.files['src/App.jsx'],/Hello from OpenCode/);
  assert.match(r.message,/Changed the greeting/);
  const offered=seen.find(t=>t.length)||[];
  assert.ok(offered.includes('edit')&&!offered.includes('bash')&&!offered.includes('webfetch'),'no shell and no web: '+offered.join(','));
 }finally{s.close();server.close();for(const k of ['KAIROQ_OPENCODE_BIN','EXPLABS_API_KEY','KAIROQ_OPENCODE_BASE_URL','KAIROQ_OPENCODE_MODEL'])delete process.env[k]}
});

test('a project can choose OpenCode; when OpenCode fails, Kairoq\'s own engine finishes the change',async()=>{
 const FAIL=path.join(tmp,'opencode-fails');
 fs.writeFileSync(FAIL,'#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({type:"error",sessionID:"s",error:{message:"model does not support tools"}})+"\\n");process.exit(1);\n',{mode:0o755});
 process.env.KAIROQ_OPENCODE_BIN=FAIL;process.env.EXPLABS_API_KEY='test-key';
 try{
  assert.equal(engine.available(),true);assert.equal(engine.enabled(),false,'not for every project');
  const meta=builder.create({name:'Choice',owner:'owner'});await builder.initialize(meta);
  assert.equal(engine.chosenFor(builder.loadMeta(meta.id)),false);
  const m=builder.loadMeta(meta.id);m.engine='opencode';builder.saveMeta(m);
  assert.equal(engine.chosenFor(builder.loadMeta(meta.id)),true);
  let kairoqCalls=0;
  const r=await builder.edit(meta.id,'add a heading',{callModel:(o,parse)=>{kairoqCalls++;return Promise.resolve(parse(JSON.stringify({message:'Added it.',files:{'src/App.jsx':'export default function App(){return <main><h1>By Kairoq</h1></main>}\n'}})))},checkRuntime:async()=>({errors:[]})});
  assert.equal(kairoqCalls,1,'Kairoq took over');
  assert.match(builder.loadFiles(meta.id,r.version)['src/App.jsx'],/By Kairoq/);
  const v=builder.loadMeta(meta.id).versions.at(-1);
  assert.equal(v.engine,undefined);assert.equal(v.engine_fallback,true);
  assert.ok(r.timeline.some(e=>/OpenCode could not do this \(OpenCode stopped: model does not support tools\)/.test(e.text||'')),JSON.stringify(r.timeline));
 }finally{delete process.env.KAIROQ_OPENCODE_BIN;delete process.env.EXPLABS_API_KEY}
});

// kairoq_check: OpenCode asks Kairoq to build and browser-test the folder while it works.
test('kairoq_check builds and tests the files in progress, and OpenCode fixes what it reports',async()=>{
 const route=http.createServer(async(q,r)=>{try{const report=await engine.runCheck(String(q.headers.authorization||'').replace(/^Bearer\s+/i,''));r.end(JSON.stringify({report}))}catch(e){r.statusCode=e.status||500;r.end(JSON.stringify({error:e.message}))}});
 await new Promise(r=>route.listen(0,'127.0.0.1',r));
 // The stand-in writes broken JSX, asks for a check, reads the report and fixes it.
 const SELF=path.join(tmp,'opencode-selfcheck');
 fs.writeFileSync(SELF,`#!/usr/bin/env node
const fs=require('fs'),path=require('path');
const a=process.argv.slice(2),dir=a[a.indexOf('--dir')+1],file=path.join(dir,'src/App.jsx');
const out=o=>process.stdout.write(JSON.stringify({sessionID:'ses_self',...o})+'\\n');
const check=async()=>{const r=await fetch(process.env.KAIROQ_CHECK_URL,{method:'POST',headers:{authorization:'Bearer '+process.env.KAIROQ_CHECK_TOKEN},body:'{}'});return (await r.json()).report};
(async()=>{
 fs.writeFileSync(file,'export default function App(){return <main><h1>Oops</main>}\\n');
 const first=await check();
 fs.appendFileSync(${JSON.stringify(path.join(tmp,'reports.txt'))},first+'\\n---\\n');
 fs.writeFileSync(file,'export default function App(){return <main><h1>Checked by Kairoq</h1></main>}\\n');
 const second=await check();
 fs.appendFileSync(${JSON.stringify(path.join(tmp,'reports.txt'))},second+'\\n---\\n');
 out({type:'tool_use',part:{tool:'kairoq_check',state:{status:'completed',input:{}}}});
 out({type:'step_finish',part:{tokens:{input:500,output:100},cost:0}});
 out({type:'text',part:{text:'Fixed the heading after the check.'}});
})();
`,{mode:0o755});
 process.env.KAIROQ_OPENCODE_BIN=SELF;process.env.EXPLABS_API_KEY='test-key';
 engine.configure({enforceBudget:null,recordUsage:null,checkUrl:'http://127.0.0.1:'+route.address().port+'/'});
 try{
  const meta=builder.create({name:'Self',owner:'owner'});await builder.initialize(meta);
  const m=builder.loadMeta(meta.id);m.engine='opencode';builder.saveMeta(m);
  const r=await builder.edit(meta.id,'add a heading',{callModel:()=>{throw Error('Kairoq model must not be called')},checkRuntime:async()=>({errors:[]})});
  assert.equal(r.attempts,1,'fixed inside OpenCode, before handing back');assert.equal(r.engine,'opencode');
  assert.match(builder.loadFiles(meta.id,r.version)['src/App.jsx'],/Checked by Kairoq/);
  const [first,second]=fs.readFileSync(path.join(tmp,'reports.txt'),'utf8').split('\n---\n');
  assert.match(first,/The Vite build failed/);
  assert.match(second,/All checks passed/);
  assert.ok(!fs.readdirSync(path.join(builder.projectDir(meta.id),'versions')).some(n=>Number(n)>=900000),'scratch builds are removed');
  await assert.rejects(engine.runCheck('not-a-token'),/Unknown check/);
 }finally{route.close();engine.configure({checkUrl:null});delete process.env.KAIROQ_OPENCODE_BIN;delete process.env.EXPLABS_API_KEY}
});

test('the real OpenCode program finds and calls kairoq_check',{skip:!process.env.KAIROQ_TEST_OPENCODE_BIN&&'set KAIROQ_TEST_OPENCODE_BIN to run OpenCode itself'},async()=>{
 const offered=[];
 const model=http.createServer((q,r)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{
  const j=JSON.parse(b||'{}'),tools=(j.tools||[]).map(t=>t.function&&t.function.name),result=(j.messages||[]).find(m=>m.role==='tool');if(tools.length)offered.push(tools);
  r.writeHead(200,{'Content-Type':'text/event-stream'});const send=o=>r.write('data: '+JSON.stringify({id:'c',object:'chat.completion.chunk',created:1,model:j.model,...o})+'\n\n');
  if(tools.includes('kairoq_check')&&!result)send({choices:[{index:0,delta:{role:'assistant',tool_calls:[{index:0,id:'call_k',type:'function',function:{name:'kairoq_check',arguments:'{}'}}]},finish_reason:'tool_calls'}],usage:{prompt_tokens:100,completion_tokens:5}});
  else send({choices:[{index:0,delta:{role:'assistant',content:result?'The check said: '+String(typeof result.content==='string'?result.content:JSON.stringify(result.content)):'Title'},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:5}});
  r.end('data: [DONE]\n\n');
 })});
 const route=http.createServer(async(q,r)=>{try{r.end(JSON.stringify({report:await engine.runCheck(String(q.headers.authorization||'').replace(/^Bearer\s+/i,''))}))}catch(e){r.statusCode=404;r.end('{}')}});
 await new Promise(r=>model.listen(0,'127.0.0.1',r));await new Promise(r=>route.listen(0,'127.0.0.1',r));
 Object.assign(process.env,{KAIROQ_OPENCODE_BIN:process.env.KAIROQ_TEST_OPENCODE_BIN,EXPLABS_API_KEY:'test-key',KAIROQ_OPENCODE_BASE_URL:'http://127.0.0.1:'+model.address().port+'/v1',KAIROQ_OPENCODE_MODEL:'m1',NO_PROXY:'127.0.0.1,localhost'});
 engine.configure({checkUrl:'http://127.0.0.1:'+route.address().port+'/'});
 let checked=0;const s=engine.session({rules:engine.rules('Rules.'),check:async files=>{checked++;return 'REPORT-OK-123 for '+Object.keys(files).join(',')}});
 try{
  const r=await s.reply({files:{'src/App.jsx':'export default function App(){return null}\n'},prompt:'Check the app'});
  assert.equal(checked,1);assert.ok(offered.some(t=>t.includes('kairoq_check')),'the tool is offered: '+JSON.stringify(offered[0]));
  assert.match(r.message,/REPORT-OK-123 for src\/App\.jsx/);
 }finally{s.close();model.close();route.close();engine.configure({checkUrl:null});for(const k of ['KAIROQ_OPENCODE_BIN','EXPLABS_API_KEY','KAIROQ_OPENCODE_BASE_URL','KAIROQ_OPENCODE_MODEL'])delete process.env[k]}
});
