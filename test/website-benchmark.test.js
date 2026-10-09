'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {resumeApp}=require('../travellez-benchmark');
test('website retry reuses only a verified app that still exists and is deployed',()=>{
 const app={id:'travellez-test',qa:{passed:true,visual_review:{passed:true}},deployed_qa:{passed:true}};
 const projects=[{id:app.id,status:'live',deployed_version:1}];
 assert.equal(resumeApp({app},projects),app);
 assert.equal(resumeApp({app},[]),null);
 assert.equal(resumeApp({app:{...app,deployed_qa:{passed:false}}},projects),null);
 assert.equal(resumeApp({app:{...app,qa:{passed:true}}},projects),null);
 assert.equal(resumeApp({app},[{...projects[0],status:'draft'}]),null);
});
test('durable release recovers a lost report without accepting unverified projects',()=>{
 const project={id:'travellez-travel-operations-benchmark-abcdef',status:'live',deployed_version:1,qa:{passed:true,visual_review:{passed:true}},deployed_qa:{passed:true}};
 assert.equal(resumeApp({},[project]).id,project.id);
 assert.equal(resumeApp({},[{...project,id:'unrelated-app'}]),null);
 assert.equal(resumeApp({},[{...project,deployed_qa:{passed:false}}]),null);
});
const {loadAppRoute}=require('../app-builder');
test('live route tolerates gateway startup errors then returns the healthy response',async()=>{
 const statuses=[502,503,504,200];let waits=0;
 const response=await loadAppRoute({goto:async()=>{const status=statuses.shift();return{ok:()=>status===200,status:()=>status};}},'https://example.test/apps/demo/',{wait:async()=>{waits++;}});
 assert.equal(response.status(),200);assert.equal(waits,3);
});
test('live route rejects real failures immediately and bounds startup retries',async()=>{
 let calls=0;const page={goto:async()=>{calls++;return{ok:()=>false,status:()=>404};}};
 await assert.rejects(loadAppRoute(page,'https://example.test',{wait:async()=>{}}),/404/);assert.equal(calls,1);
 calls=0;page.goto=async()=>{calls++;return{ok:()=>false,status:()=>502};};
 await assert.rejects(loadAppRoute(page,'https://example.test',{attempts:3,wait:async()=>{}}),/502/);assert.equal(calls,3);
});

test('website retry recovers saved drafts and excludes unrelated sites',()=>{const {resumeWebsite}=require('../travellez-benchmark');const site={id:'travellez-corporate-travel-website-benchmark-123',status:'needs_repair'};assert.equal(resumeWebsite({},[site]),site);assert.equal(resumeWebsite({website:{id:'saved'}},[{id:'saved'},site]).id,'saved');assert.equal(resumeWebsite({},[{id:'unrelated'}]),null);});
test('interrupted app repair resumes only its own unfinished saved candidate',()=>{const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),{resumeRepair}=require('../travellez-benchmark'),root=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-resume-'));try{const id=crypto.randomUUID(),job={id,projectId:'target',operation:'repair',status:'reviewing',created_at:new Date().toISOString()};fs.writeFileSync(path.join(root,id+'.json'),JSON.stringify(job));assert.equal(resumeRepair('target',root),null);fs.writeFileSync(path.join(root,id+'.candidate.json'),'{}');assert.equal(resumeRepair('target',root),id);assert.equal(resumeRepair('other',root),null);fs.writeFileSync(path.join(root,id+'.json'),JSON.stringify({...job,status:'complete'}));assert.equal(resumeRepair('target',root),null);}finally{fs.rmSync(root,{recursive:true,force:true});}});
