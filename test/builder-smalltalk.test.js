"use strict";
// "hi" is conversation, not a build: a free reply. Questions that ask for no change get an answer.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-smalltalk-'));
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const S=require('../builder-smalltalk');

test('greetings, thanks and "what can you do" are small talk; requests are not',()=>{
 for(const m of ['hi','Hi!','hello there','hey 👋','good morning'])assert.equal(S.smallTalk(m),'greeting',m);
 for(const m of ['thanks!','thank you','ok','looks good'])assert.equal(S.smallTalk(m),'thanks',m);
 assert.equal(S.smallTalk('what can you do?'),'help');
 for(const m of ['hi, add a gallery page','hi can you build a booking page for my yoga studio','Build a booking page','Make it blue'])assert.equal(S.smallTalk(m),null,m);
});

test('a question that asks for no change is answered, a request phrased as a question is built',()=>{
 assert.equal(S.questionOnly('Should bookings be confirmed instantly?'),true);
 assert.equal(S.questionOnly('How do guests pay?'),true);
 for(const m of ['Can you add a gallery?','Add pricing?','Could you make the header smaller?','Build a booking page'])assert.equal(S.questionOnly(m),false,m);
});

test('"hi" in Build gets a free reply and starts no build',async()=>{
 const api=require('../create-api'),builder=require('../react-builder');
 const meta=builder.create({name:'Yoga Studio',owner:'owner'});
 let called=false;
 const job=api.startJob({kind:'owner',owner:'owner',account:null},meta.id,{message:'hi',mode:'build'},{callModel:async()=>{called=true;throw Error('no model')}});
 assert.equal(job.status,'complete');
 assert.equal(job.credits,0);
 assert.equal(called,false);
 const last=builder.loadMeta(meta.id).messages.at(-1);
 assert.match(last.text,/^Hi! I'm ready to work on Yoga Studio\./);
 assert.equal(last.credits,0);
});
