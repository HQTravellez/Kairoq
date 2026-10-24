"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),qa=require('../feature-acceptance');
const req=[{id:'calorie',label:'Calorie tracking'},{id:'weight',label:'Weight tracking'}];
const valid={feature_id:'calorie',name:'Food diary',steps:[{action:'fill',label:'Food',value:'Apple'},{action:'click',text:'Save food'},{action:'expect',text:'Apple'}]};
test('requires interaction, assertion and feature identity',()=>{
 assert.equal(qa.validCheck(valid,'calorie'),true);
 assert.equal(qa.validCheck({...valid,feature_id:'weight'},'calorie'),false);
 assert.equal(qa.validCheck({feature_id:'calorie',steps:[{action:'expect',text:'Welcome back'}]},'calorie'),false);
 assert.match(qa.instructions(req),/one \*separate\* check per requirement/);
});
test('unsubmitted flows remain unverified even with passing login screenshots',async()=>{
 const r=await qa.verify({requirements:req,proposed:[],id:'demo',url:'http://example.test',inspect:async()=>({}),checksModule:{}});
 assert.equal(r.passed,0);assert.equal(r.allPassed,false);
});
test('only executed passing feature journeys are verified',async()=>{
 let executed=0;
 const checksModule={normalize:c=>c,run:async()=>{executed++;return{ran:1,skipped:false,failed:[]}}};
 const r=await qa.verify({requirements:req,proposed:[valid],id:'demo',url:'http://example.test',inspect:async()=>({}),checksModule});
 assert.equal(executed,1);assert.equal(r.passed,1);assert.equal(r.results[1].status,'unverified');
});
test('failed browser assertion never becomes passed',async()=>{
 const r=await qa.verify({requirements:[req[0]],proposed:[valid],id:'demo',url:'http://example.test',inspect:async()=>({}),checksModule:{normalize:c=>c,run:async()=>({ran:1,failed:[{error:'Food not in diary'}]})}});
 assert.equal(r.allPassed,false);assert.match(r.results[0].reason,/Food not in diary/);
});

test('React builder actually feeds the owner requirements to browser acceptance',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const source=fs.readFileSync(path.join(__dirname,'../react-builder.js'),'utf8');
 assert.match(source,/featureQA\.instructions\(ownerRequirements\)/);
 assert.match(source,/featureQA\.verify\(\{requirements:ownerRequirements/);
 assert.match(source,/last\.feature_acceptance=acceptance/);
});

test('successful React feature repair records evidence and recalls project lessons',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const src=fs.readFileSync(path.join(__dirname,'../react-builder.js'),'utf8');
 assert.match(src,/hermes-learning-loop'\)\.recall/);
 assert.match(src,/acceptance\?\.allPassed&&attempt>1&&lastError/);
 assert.match(src,/hermes-learning-loop'\)\.observe/);
});
