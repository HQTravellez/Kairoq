"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),skills=require('../api-skill-memory');
const digest='a'.repeat(64);
function store(){const records=[{type:'api-execution',passed:true,responseDigest:digest}];return{records,history:async()=>records,append:async(_,r)=>{records.push(r);return r;}};}
const pattern={name:'List records',verification:'HTTP 200 and schema validated',requestPattern:'GET /records'};
test('candidate stores versioned pattern backed by verified evidence',async()=>{
 const db=store(),first=await skills.candidate({projectId:'demo',skillId:'records',pattern,evidenceDigests:[digest]},db);
 const second=await skills.candidate({projectId:'demo',skillId:'records',pattern,evidenceDigests:[digest]},db);
 assert.equal(first.version,1);assert.equal(second.version,2);
 assert.equal(await skills.active({projectId:'demo',skillId:'records'},db),null);
});
test('rejects missing evidence and possible secrets',async()=>{
 const db=store();
 await assert.rejects(()=>skills.candidate({projectId:'demo',skillId:'records',pattern,evidenceDigests:['b'.repeat(64)]},db),/verified/);
 assert.throws(()=>skills.cleanPattern({...pattern,authentication:'Bearer abcdefghijklmnopqrstuvwxyz'}),/secret/);
});
test('promotion requires improvement and holdout with no regression',async()=>{
 const db=store(),v=await skills.candidate({projectId:'demo',skillId:'records',pattern,evidenceDigests:[digest]},db);
 await assert.rejects(()=>skills.promote({projectId:'demo',skillId:'records',version:v.version,benchmark:{cases:[{id:'one',oldPassed:true,newPassed:true,holdout:true},{id:'two',oldPassed:true,newPassed:true,holdout:false},{id:'three',oldPassed:false,newPassed:false,holdout:false}]}},db),/outperform/);
 const benchmark={cases:[{id:'one',oldPassed:true,newPassed:true,holdout:true},{id:'two',oldPassed:false,newPassed:true,holdout:false},{id:'three',oldPassed:false,newPassed:true,holdout:false}]};
 await skills.promote({projectId:'demo',skillId:'records',version:v.version,benchmark},db);
 assert.equal((await skills.active({projectId:'demo',skillId:'records'},db)).version,1);
});
