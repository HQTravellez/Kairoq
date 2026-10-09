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
