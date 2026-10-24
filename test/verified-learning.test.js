'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),learning=require('../verified-learning');
function store(){const rows=[];return {rows,append:async(id,r)=>rows.push({...r,projectId:id}),history:async(id)=>rows.filter(r=>r.projectId===id)};}
const meta={owner:'owner_A',id:'project_A'},proof={built:true,verified:true,skipped:false,errors:[],failed:0,interactions:2,assertions:1,version:2,sourceDigest:'a'.repeat(64)};
const input={meta,query:'Add a camera for meals. owner@example.com secret-key=do-not-store',evidence:proof,tools:['write_files','build_and_test','test_ui','deploy']};
test('capture stores evidence and safe procedural categories, never raw customer input or arbitrary tools',async()=>{
 const db=store(),result=await learning.capture(input,db);assert.equal(result.status,'captured');
 const text=JSON.stringify(db.rows);assert.doesNotMatch(text,/owner@example|secret-key|deploy/);
 assert.deepEqual(db.rows[0].topics,['camera','nutrition']);assert.equal(db.rows[0].evidence.assertions,1);
 assert.equal((await learning.capture(input,db)).status,'duplicate');assert.equal(db.rows.length,1);
});
test('failed, skipped, screenshot-only and unasserted runs cannot become reusable successes',async()=>{
 const db=store();for(const change of [{verified:false},{skipped:true},{errors:['crash']},{failed:1},{interactions:0},{assertions:0},{sourceDigest:'invalid'},{built:false}]){
  assert.equal((await learning.capture({...input,evidence:{...proof,...change}},db)).status,'not-verified');
 }assert.equal(db.rows.length,0);
});
test('lessons remain scoped to both owner and project, bounded and revocable',async()=>{
 const db=store(),r=await learning.capture(input,db);
 assert.equal((await learning.recall({meta,query:'meal camera'},db)).length,1);
 assert.deepEqual(await learning.recall({meta:{...meta,owner:'owner_B'},query:'meal camera'},db),[]);
 assert.deepEqual(await learning.recall({meta:{...meta,id:'project_B'},query:'meal camera'},db),[]);
 assert.deepEqual(await learning.recall({meta,query:'a question about nothing'},db),[]);
 assert.deepEqual(await learning.recall({meta,query:'meal',limit:0},db),[]);
 await learning.revoke({meta,digest:r.digest},db);assert.deepEqual(await learning.recall({meta,query:'meal'},db),[]);
});
test('training export requires explicit review, and revocation overrides earlier review',async()=>{
 const db=store(),r=await learning.capture(input,db);
 assert.deepEqual(await learning.trainingExamples(meta,db),[]);
 await assert.rejects(learning.review({meta,digest:r.digest},db),/review/);
 await assert.rejects(learning.review({meta:{...meta,id:'other'},digest:r.digest,approved:true},db),/not found/);
 await learning.review({meta,digest:r.digest,approved:true},db);
 const rows=await learning.trainingExamples(meta,db);assert.equal(rows.length,1);assert.equal(rows[0].messages.length,2);
 assert.doesNotMatch(JSON.stringify(rows),/owner@example|secret-key|owner_A|project_A/);
 await learning.revoke({meta,digest:r.digest},db);assert.deepEqual(await learning.trainingExamples(meta,db),[]);
});
test('disable flag suppresses capture and recall notes without provider calls',async()=>{
 const old=process.env.KAIROQ_VERIFIED_LEARNING;process.env.KAIROQ_VERIFIED_LEARNING='off';
 try{const db=store();assert.equal((await learning.capture(input,db)).status,'disabled');assert.equal(await learning.note(meta,'meal',db),'');assert.equal(db.rows.length,0);}
 finally{if(old===undefined)delete process.env.KAIROQ_VERIFIED_LEARNING;else process.env.KAIROQ_VERIFIED_LEARNING=old;}
});
test('sorted source digest follows actual content, independent of file map order',()=>{
 assert.equal(learning.sourceDigest({b:'2',a:'1'}),learning.sourceDigest({a:'1',b:'2'}));
 assert.notEqual(learning.sourceDigest({a:'1'}),learning.sourceDigest({a:'2'}));
});
test('evidence survives a fresh process and reviewed exports deduplicate the same procedure',async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-learning-disk-'));
 const modulePath=path.resolve(__dirname,'../verified-learning.js');
 const env={...process.env,KAIROQ_AUTONOMY_DIR:root};
 try{
  cp.execFileSync(process.execPath,['-e',`const l=require(${JSON.stringify(modulePath)});(async()=>{for(const version of [2,3]){const r=await l.capture(${JSON.stringify(input)});if(version===2)await l.review({meta:${JSON.stringify(meta)},digest:r.digest,approved:true});}})().catch(e=>{console.error(e);process.exitCode=1})`],{env});
  const raw=cp.execFileSync(process.execPath,['-e',`const l=require(${JSON.stringify(modulePath)});l.recall({meta:${JSON.stringify(meta)},query:'photo meal'}).then(x=>console.log(JSON.stringify(x)))`],{env,encoding:'utf8'});
  assert.equal(JSON.parse(raw).length,1);
  assert.equal(fs.readdirSync(root).filter(n=>n.endsWith('.jsonl')).length,1);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
 const db=store(),first=await learning.capture(input,db),second=await learning.capture({...input,evidence:{...proof,version:3}},db);
 for(const r of [first,second])await learning.review({meta,digest:r.digest,approved:true},db);
 assert.equal((await learning.trainingExamples(meta,db)).length,1);
});
