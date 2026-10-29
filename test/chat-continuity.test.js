'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kq-conversation-'));
Object.assign(process.env,{NODE_ENV:'test',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'projects'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'accounts.sqlite'),KAIROQ_DESIGN_BRIEF:'off',KAIROQ_WEB_RESEARCH:'off',KAIROQ_MEMORY:'off',KAIROQ_FORMAT_CODE:'off',KAIROQ_CRAFT_CHECK:'off',KAIROQ_LOOK_CHECK:'off'});
const Q=require('../builder-question'),builder=require('../react-builder'),api=require('../create-api');
const brief='Build an iPhone AR coloring book: a printable T-Rex, a commercially licensed animated model, walk and jump, and the child’s colors.';
const question={text:'Which version do you want?',options:['Browser camera version','Keep the 3D viewer'],recommended:0};

test('numbered choices are separate options, and recommendation is shown only once',()=>{
 const q=Q.fromText('Keep the printable T-Rex.\nQUESTION: Which version? | Options: 1) Browser camera version (recommended) 2) Keep the current 3D viewer 3) Native app 4) Something else').question;
 assert.equal(q.options.length,4);
 assert.equal(q.options[0],'Browser camera version');
 assert.equal(q.recommended,0);
});
test('greeting exchanges do not consume project context or dismiss an unanswered question',()=>{
 const messages=[{role:'user',text:brief},{role:'assistant',text:'Choose the browser camera version.',question}];
 for(let i=0;i<14;i++)messages.push({role:'user',text:'hi'},{role:'assistant',text:'Hi! I am here.',support:true,credits:0});
 assert.deepEqual(Q.pending({messages}),question);
 const history=builder.historyMessages({messages});
 assert.ok(history.some(m=>m.content===brief),'original request is still sent to the model');
 assert.ok(history.some(m=>m.content.includes('Browser camera version')),'the pending plan is still sent');
 assert.ok(!history.some(m=>m.content==='hi'),'greetings do not crowd out decisions');
});
test('a greeting in Discuss is free, durable and keeps the active decision',()=>{
 const m=builder.create({name:'Dinosaur coloring book',owner:'owner'});
 builder.addMessages(m.id,[{role:'user',text:brief},{role:'assistant',text:'Which version?',question}]);
 const job=api.startJob({kind:'owner',owner:'owner'},m.id,{message:'hi',mode:'discuss'},{callModel:async()=>{throw Error('A greeting must not call a model')}});
 assert.equal(job.status,'complete');assert.equal(job.credits,0);
 assert.deepEqual(Q.pending(builder.loadMeta(m.id)),question);
 assert.match(builder.loadMeta(m.id).messages.at(-1).text,/browser camera version/i);
});
test('long replies retain the original brief within a bounded context',()=>{
 const messages=[{role:'user',text:brief}];
 for(let i=0;i<30;i++)messages.push({role:i%2?'assistant':'user',text:String(i)+' '+ 'long explanation '.repeat(1000)});
 const history=builder.historyMessages({messages});
 assert.equal(history[0].content,brief);
 assert.ok(history.at(-1).content.startsWith('29 '));
 assert.ok(history.reduce((n,m)=>n+m.content.length,0)<=24000);
});
test('greetings during an active build are saved without launching another build',()=>{
 const m=builder.create({name:'Dinosaur coloring book',owner:'owner'});
 builder.addMessages(m.id,[{role:'user',text:brief},{role:'assistant',text:'Which version?',question}]);
 const active={id:'active-fixture',projectId:m.id,status:'building'};api.jobs.set(active.id,active);
 try{
  const job=api.startJob({kind:'owner',owner:'owner'},m.id,{message:'hi',mode:'discuss'},{callModel:async()=>{throw Error('must not infer')}});
  assert.equal(job.status,'complete');assert.equal(job.credits,0);
  assert.equal(active.status,'building');
  const saved=builder.loadMeta(m.id);
  assert.equal(saved.messages.at(-2).text,'hi');
  assert.match(saved.messages.at(-1).text,/current change is still running/);
  assert.deepEqual(Q.pending(saved),question);
 }finally{api.jobs.delete(active.id);}
});
test('implementation references must identify a proposal in this project',()=>{
 const m=builder.create({name:'Other project',owner:'owner'});
 assert.throws(()=>api.startJob({kind:'owner',owner:'owner'},m.id,{message:'Implement this plan.',implementFrom:'outside-project'},{callModel:async()=>{throw Error('must not infer')}}),/plan is no longer available/i);
});
test('OpenCode receives the same conversation and original goal as the regular builder',async()=>{
 const m=builder.create({name:'Dinosaur coloring book',owner:'owner'});await builder.initialize(m);
 builder.addMessages(m.id,[{role:'user',text:brief},{role:'assistant',text:'The agreed plan: a browser camera version; use a real animated T-Rex, never a flat substitute.'}]);
 let seen;
 const engine={model:()=>({id:'fake'}),rules:(a,b)=>a+'\n'+b,session:opts=>{seen=opts.rules;return{reply:async()=>({message:'Added the camera screen.',files:{'src/App.jsx':'export default function App(){return <main><h1>Dinosaur camera</h1></main>}\n'},edits:{},delete:[],plan:[],images:[],checks:[]}),close(){}}}};
 await builder.edit(m.id,'Implement the plan you just described.',{engine,callModel:async()=>{throw Error('not used')},checkRuntime:async()=>({errors:[]})});
 assert.match(seen,/printable T-Rex/);assert.match(seen,/agreed plan: a browser camera version/);
});
test.after(()=>{require('../runtime-check').close();fs.rmSync(tmp,{recursive:true,force:true})});
