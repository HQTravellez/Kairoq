'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-batch-'));
process.env.KAIROQ_REACT_PROJECTS_DIR=root;process.env.KAIROQ_AUTONOMY_DIR=path.join(root,'learning');process.env.KAIROQ_DESIGN_BRIEF='off';
const agent=require('../react-agent'),builder=require('../react-builder'),runtime=require('../runtime-check');
test('fifteen adjacent independent writes become one tool action without losing files',()=>{
 const actions=Array.from({length:15},(_,i)=>({tool:'write_files',files:{['src/p'+i+'.js']:'export default '+i}}));
 const parsed=agent.parseStep({actions});assert.equal(parsed.actions.length,1);assert.equal(Object.keys(parsed.actions[0].files).length,15);
 assert.equal(Object.keys(actions[0].files).length,1,'input must not be mutated');
 const ordered=agent.parseStep({actions:[actions[0],{tool:'read_files',paths:['src/p0.js']},actions[1],{tool:'write_files',files:{'src/p1.js':'changed'}}, {tool:'write_files',files:{'src/p2.js':'new'},delete:['src/p1.js']}]});
 assert.equal(ordered.actions.length,5,'reads, overlapping paths and deletion boundaries remain ordered');
});
test('one model file batch builds multiple modules and proves an interaction in Chrome',{skip:!runtime.available()},async()=>{
 const meta=builder.create({name:'Batch app',owner:'owner'});await builder.initialize(meta);
 const files={'src/App.jsx':"import Counter from './components/Counter.jsx';export default function App(){return <main><h1>Batch scaffold</h1><Counter/></main>}",
 'src/components/Counter.jsx':"import {useState} from 'react';export default function Counter(){const [n,set]=useState(0);return <button onClick={()=>set(n+1)}>Count {n}</button>}",
 'src/components/metadata.js':"export const title='Batch scaffold';"};
 const server=http.createServer((req,res)=>{if(builder.handlePreview(req,res))return;res.writeHead(404);res.end();});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let calls=0;
 try{
  const result=await agent.run(meta.id,'Create a simple counter app',{inspect:(url,opts)=>runtime.inspect('http://127.0.0.1:'+server.address().port+url,opts),maxSteps:3,callModel:async(_opts,parse)=>{
   calls++;return parse(JSON.stringify(calls===1?{thought:'Write all modules together and test.',actions:[{tool:'write_files',files},{tool:'build_and_test',steps:[{action:'click',text:'Count 0'},{action:'expect',text:'Count 1'}]}]}:{thought:'Verified.',actions:[{tool:'finish',message:'Built and tested the counter.'}]}));}});
  assert.equal(calls,2);assert.equal(result.verification.verified,true);
  await require('../account-memory').settled();
  const learning=require('../verified-learning'),lessons=await learning.entries(builder.loadMeta(meta.id));
  assert.equal(lessons.length,1);assert.ok(lessons[0].actions.includes('write_files'));
  let received='';await builder.discuss(meta.id,'How should the counter be verified?',{callModel:async(o,parse)=>{received=o.messages[0].content;return parse('Test a click and assert the increment.');}});
  assert.match(received,/VERIFIED PROJECT PROCEDURES/);
  assert.equal((await learning.trainingExamples(builder.loadMeta(meta.id))).length,0,'no training export before review');
  for(const [name,content] of Object.entries(files))assert.equal(builder.loadFiles(meta.id,result.version)[name],content);
 } finally {server.closeAllConnections();await new Promise(r=>server.close(r));await runtime.close();fs.rmSync(root,{recursive:true,force:true});}
});
