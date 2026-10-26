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

test('everyday messages get an answer, not a build that reports "Updated the app."',()=>{
 const S=require('../builder-smalltalk');
 for(const m of ['hi how are you doing today','hello, are you there','good morning Kairoq how is everything'])assert.equal(S.smallTalk(m),'greeting',m);
 for(const m of ['what happened','why is it so slow','is anyone there','how are you'])assert.equal(S.conversation(m),true,m);
 for(const m of ['a booking page for my yoga studio','add a gallery page','hi, add a gallery page','make the header blue','what if we add a pricing page','https://example.com what is this'])assert.equal(S.conversation(m),false,m);
 const api=require('fs').readFileSync(require('path').join(__dirname,'../create-api.js'),'utf8');
 assert.match(api,/S\.questionOnly\(message\)\|\|S\.conversation\(message\)/);
});

test('"what can you do" with a topic gets a real answer, not the help menu',()=>{
 const S=require('../builder-smalltalk');
 for(const m of ['what can you do 3d int his','what can you do with 3d?','what can you do with payments','help with the booking form']){
  assert.equal(S.smallTalk(m),null,m);
 }
 for(const m of ['what can you do 3d int his','what can you do with 3d?'])assert.equal(S.conversation(m),true,m);
 for(const m of ['what can you do','what can you do for me?','hi, what can you do','help please','help'])assert.equal(S.smallTalk(m),'help',m);
});
