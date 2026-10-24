"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const loop=require('../hermes-learning-loop');
const DIGEST='a'.repeat(64);
function store(){const records=[];return {records,append:async(projectId,r)=>{records.push({...r,projectId});return r;},history:async(projectId)=>records.filter(r=>r.projectId===projectId)};}
test('verified learnings persist across independent calls and failed attempts never enter recall',async()=>{
 const db=store();
 await loop.observe({projectId:'demo',task:'Generate app',diagnostic:'Registration button missed POST request',correction:'Use trusted registration runtime',passed:false,evidenceDigest:DIGEST},db);
 await loop.observe({projectId:'demo',task:'Generate app',diagnostic:'Registration button missed POST request',correction:'Use trusted registration runtime',passed:true,evidenceDigest:DIGEST},db);
 const recall=await loop.recall({projectId:'demo',query:'registration runtime'},db);
 assert.equal(recall.length,1);assert.equal(recall[0].correction,'Use trusted registration runtime');
 assert.deepEqual(await loop.recall({projectId:'another',query:'registration'},db),[]);
});
test('rejects unverified results and possible secrets',async()=>{
 const db=store();
 await assert.rejects(loop.observe({projectId:'demo',task:'foo',diagnostic:'failed',correction:'fix',passed:true,evidenceDigest:'invalid'},db),/SHA-256/);
 await assert.rejects(loop.observe({projectId:'demo',task:'foo',diagnostic:'failed',correction:'Bearer verysecrettoken123',passed:true,evidenceDigest:DIGEST},db),/secret/);
});
test('API learning requires verified executions and holdout improvement',async()=>{
 const db=store(),pattern={name:'List records',verification:'HTTP 200 and schema validated',requestPattern:'GET /records'};
 await assert.rejects(loop.proposeApiSkill({projectId:'demo',skillId:'records',pattern,evidenceDigests:[DIGEST]},db),/verified/);
 db.records.push({projectId:'demo',type:'api-execution',passed:true,responseDigest:DIGEST});
 const candidate=await loop.proposeApiSkill({projectId:'demo',skillId:'records',pattern,evidenceDigests:[DIGEST]},db);
 assert.equal(candidate.version,1);
 assert.equal(await loop.recalledApiSkill({projectId:'demo',skillId:'records'},db),null);
 const benchmark={cases:[{id:'one',oldPassed:true,newPassed:true,holdout:true},{id:'two',oldPassed:false,newPassed:true,holdout:false},{id:'three',oldPassed:false,newPassed:true,holdout:false}]};
 await loop.approveApiSkill({projectId:'demo',skillId:'records',version:1,benchmark},db);
 assert.equal((await loop.recalledApiSkill({projectId:'demo',skillId:'records'},db)).version,1);
});
