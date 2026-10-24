'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-concurrent-'));
process.env.KAIROQ_REACT_PROJECTS_DIR=root;process.env.KAIROQ_MEMORY='off';process.env.KAIROQ_WEB_RESEARCH='off';
const builder=require('../react-builder'),api=require('../create-api');
test('read-only concept discussion completes while an app build remains active',async()=>{
 const meta=builder.create({name:'Guest booking',owner:'owner'}),owner={kind:'owner',owner:'owner'};
 builder.addMessages(meta.id,[{role:'user',text:'Build a guest booking app for our hotel',mode:'build'}]);
 const active={id:'synthetic-active',projectId:meta.id,owner:'owner',status:'building'};api.jobs.set(active.id,active);
 try{
  const job=api.startJob(owner,meta.id,{message:'What should hotel guests see first?',mode:'discuss'},{callModel:async(opts,parse)=>{
   assert.match(opts.messages[0].content,/APP CONCEPT/);assert.match(opts.messages[0].content,/guest booking app/);
   return parse('Suggest showing available rooms first, so guests can start booking.');}});
  for(let i=0;i<100&&!['complete','failed'].includes(job.status);i++)await new Promise(r=>setTimeout(r,10));
  assert.equal(job.status,'complete',job.error);assert.equal(active.status,'building');
  assert.match(job.result.message,/available rooms/);assert.equal(builder.loadMeta(meta.id).current_version,0);
  assert.throws(()=>api.startJob(owner,meta.id,{message:'Add rooms',mode:'build'},{}),/already/);
 }finally{api.jobs.clear();fs.rmSync(root,{recursive:true,force:true});}
});
test('background preference learning does not delay completion',async()=>{
 const meta=builder.create({name:'Preferences',owner:'owner'}),mem=require('../account-memory');
 const originalEdit=builder.edit,originalLearn=mem.learnPreferences;
 let release,started=false;const pending=new Promise(r=>release=r);
 builder.edit=async()=>({message:'Saved.',unchanged:true,changed:[]});
 mem.learnPreferences=async()=>{started=true;return pending;};
 try {
  const job=api.startJob({kind:'owner',owner:'owner'},meta.id,{message:'Always use blue in my apps',mode:'build'},{callModel:async()=>''});
  for(let i=0;i<100&&!['complete','failed'].includes(job.status);i++)await new Promise(r=>setTimeout(r,10));
  assert.equal(started,true);assert.equal(job.status,'complete',job.error);
 }finally{release([]);await mem.settled();builder.edit=originalEdit;mem.learnPreferences=originalLearn;api.jobs.clear();fs.rmSync(root,{recursive:true,force:true});}
});
test('injected guarded browser reaches research and its API documentation reaches Discuss',async()=>{
 const meta=builder.create({name:'API docs',owner:'owner'}),runtime=require('../runtime-check'),original=runtime.checkSite;
 const old=process.env.KAIROQ_WEB_RESEARCH;process.env.KAIROQ_WEB_RESEARCH='on';runtime.checkSite=async u=>u;
 let opened=false,closed=false;
 try{
  const job=api.startJob({kind:'owner',owner:'owner'},meta.id,{message:'Read https://api.example.com/docs',mode:'discuss'},{browseSite:async(url,opts)=>{
   opened=true;assert.equal(url,'https://api.example.com/docs');assert.equal(opts.site,true);
   return {observe:async()=>({title:'Food API',text:'GET /foods returns food names and macros',elements:[]}),close:async()=>{closed=true;},url:()=>url};},callModel:async(opts,parse)=>{
   if(opts.maxOutputTokens===600)return parse(JSON.stringify({web:[{open:'https://api.example.com/docs'}]}));
   if(opts.maxOutputTokens===400)return parse('{"web":[]}');
   assert.match(JSON.stringify(opts.messages),/GET \/foods returns food names and macros/);
   return parse('The documentation lists GET /foods for food names and macros.');}});
  for(let i=0;i<100&&!['complete','failed'].includes(job.status);i++)await new Promise(r=>setTimeout(r,10));
  assert.equal(job.status,'complete',job.error);assert.equal(opened,true);assert.equal(closed,true);
 }finally{runtime.checkSite=original;if(old===undefined)delete process.env.KAIROQ_WEB_RESEARCH;else process.env.KAIROQ_WEB_RESEARCH=old;api.jobs.clear();fs.rmSync(root,{recursive:true,force:true});}
});
