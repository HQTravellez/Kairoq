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

test('lessons survive a fresh Node process and remain isolated on disk',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-hermes-durable-'));
 const modulePath=path.resolve(__dirname,'../hermes-learning-loop.js');
 const env={...process.env,KAIROQ_AUTONOMY_DIR:root};
 const run=source=>{const child=cp.spawnSync(process.execPath,['-e',source],{env,encoding:'utf8',timeout:12000,cwd:path.resolve(__dirname,'..')});assert.equal(child.status,0,child.stderr||child.stdout);return child.stdout.trim();};
 try{
  run(`const loop=require(${JSON.stringify(modulePath)});(async()=>{await loop.observe({projectId:'tenant_A',task:'Housing API forms',diagnostic:'Form submission returned 422',correction:'Correct the documented required fields',passed:true,evidenceDigest:'${DIGEST}'});await loop.observe({projectId:'tenant_A',task:'Housing API forms',diagnostic:'Unverified payment update',correction:'Skip payment validation',passed:false,evidenceDigest:'${DIGEST}'});})().catch(e=>{console.error(e);process.exitCode=1})`);
  const observed=JSON.parse(run(`const loop=require(${JSON.stringify(modulePath)});(async()=>{console.log(JSON.stringify({own:await loop.recall({projectId:'tenant_A',query:'Housing API forms'}),other:await loop.recall({projectId:'tenant_B',query:'Housing API forms'})}))})().catch(e=>{console.error(e);process.exitCode=1})`));
  assert.equal(observed.own.length,1);
  assert.equal(observed.own[0].correction,'Correct the documented required fields');
  assert.deepEqual(observed.other,[]);
  assert.ok(fs.existsSync(path.join(root,'tenant_A.jsonl')),'A real append-only memory file must exist');
  assert.ok(!fs.existsSync(path.join(root,'tenant_B.jsonl')),'Recall must not create a tenant memory file');
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
