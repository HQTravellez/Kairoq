"use strict";
// A reply that only asks the owner a question is free, in Discuss and in Build.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-question-'));
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_WEB_RESEARCH='off';
const api=require('../create-api'),builder=require('../react-builder'),accounts=require('../builder-accounts');

async function finished(job){for(let i=0;i<200&&!['complete','failed'].includes(job.status);i++)await new Promise(r=>setTimeout(r,25));return job}

test('a Discuss reply that asks a question costs nothing and shows its options',async()=>{
 accounts.signup('question-test@example.test','test-password-123');
 const balance=()=>accounts.login('question-test@example.test','test-password-123').account.credits;
 const id=accounts.login('question-test@example.test','test-password-123').account.id;
 accounts.grant(id,10,'test credits','test-grant');
 const before=balance();
 const meta=builder.create({name:'Hotel',owner:'acct:'+id});
 const v={kind:'customer',owner:'acct:'+id,account:{id}};
 const reply='1. Add a booking form\nQUESTION: Should guests send a request the hotel confirms, or book instantly? | Request the hotel confirms | Instant booking';
 const job=await finished(api.startJob(v,meta.id,{message:'Add booking',mode:'discuss'},{callModel:async(o,parse)=>parse(reply)}));
 assert.equal(job.status,'complete',job.error);
 assert.equal(job.refunded,true);
 assert.equal(balance(),before);
 const last=builder.loadMeta(meta.id).messages.at(-1);
 assert.equal(last.credits,0);
 assert.deepEqual(last.question.options,['Request the hotel confirms','Instant booking']);
});
