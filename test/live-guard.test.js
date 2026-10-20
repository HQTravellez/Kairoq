"use strict";
// The live guard (live-guard.js): a broken live app is checked twice, then put back to the last
// version that worked, else repaired (the fix must pass before it is published), else a person
// is emailed once; and they hear when it works again. Unpublished changes never go live.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-guard-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_OWNER_EMAIL='owner@cafe.test';
process.env.KAIROQ_ALERT_EMAIL='help@kairoq.test';
const builder=require('../react-builder'),hosting=require('../react-hosting'),guard=require('../live-guard');
test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));

const MAIN="import { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<App />);\n";
const app=t=>({'src/main.jsx':MAIN,'src/App.jsx':'export default function App(){return <h1>'+t+'</h1>}\n'});
// The browser: versions in `broken` show a blank page; the live address shows the published one.
const broken=new Set();let looks=0;
function versionOf(id,url){if(url.startsWith('/sites/'))return builder.loadMeta(id).published.version;return Number((/\/v\/(\d+)\//.exec(url)||[])[1])}
let mails=[];
function deps(id,extra={}){return{checkRuntime:async url=>{looks++;return{errors:broken.has(id+':'+versionOf(id,url))?['Blank page: nothing rendered']:['Console error: a warning']}},inspect:null,retryMs:0,send:async(to,subject,text)=>mails.push({to,subject,text}),callModel:()=>{},exclusive:async(_id,fn)=>fn(),busy:()=>false,...extra}}

test('a healthy live app is left alone; a stray console message is not a problem',async()=>{
 const meta=builder.create({name:'Cafe Sol',owner:'owner'});
 await builder.initializeFrom(meta,app('Sol'),'Start');
 hosting.publish(meta.id,{slug:'cafe-sol'});
 mails=[];looks=0;
 assert.deepEqual(await guard.guardOne(meta.id,deps(meta.id)),{ok:true});
 assert.equal(looks,1);
 const g=guard.view(builder.loadMeta(meta.id));
 assert.equal(g.ok,true);assert.equal(g.last_good,1);assert.equal(g.incident,null);assert.equal(mails.length,0);
});

test('a newer publish that broke the app is replaced by the version that worked',async()=>{
 const meta=builder.create({name:'Bakery',owner:'owner'});
 await builder.initializeFrom(meta,app('Bread'),'Start');
 hosting.publish(meta.id,{slug:'bakery-guard'});
 await guard.guardOne(meta.id,deps(meta.id));
 const v2=(await builder.saveSource(meta.id,app('Bread 2'),{summary:'new'})).version;
 hosting.publish(meta.id,{version:v2});broken.add(meta.id+':'+v2);
 mails=[];looks=0;
 const r=await guard.guardOne(meta.id,deps(meta.id));
 assert.equal(r.rolled_back,1);assert.ok(looks>=3,'checked twice, then the old version');
 const m=builder.loadMeta(meta.id);
 assert.equal(m.published.version,1);assert.equal(m.current_version,v2,'the owner\'s change is kept');
 assert.equal(mails.length,1);assert.match(mails[0].subject,/put back the version that worked/);assert.match(mails[0].text,/Blank page/);
 assert.equal(guard.view(m).history[0].kind,'rolled_back');
});

test('a break with nothing to go back to is repaired, tested, then published; a repair that fails goes to a person',async()=>{
 const meta=builder.create({name:'Florist',owner:'owner'});
 await builder.initializeFrom(meta,app('Flowers'),'Start');
 hosting.publish(meta.id,{slug:'florist-guard'});
 await guard.guardOne(meta.id,deps(meta.id));
 broken.add(meta.id+':1');// something outside the app broke the published version
 const realEdit=builder.edit;let asked='',fixWorks=true;
 builder.edit=async(id,message)=>{asked=message;const v=(await builder.saveSource(id,app('Flowers fixed'),{summary:'fix'})).version;if(!fixWorks)broken.add(id+':'+v);return{version:v}};
 try{
  mails=[];
  const r=await guard.guardOne(meta.id,deps(meta.id));
  assert.match(asked,/Blank page/);
  assert.equal(r.repaired,2);assert.equal(builder.loadMeta(meta.id).published.version,2);
  assert.match(mails[0].subject,/fixed a problem/);assert.equal(mails[0].to,'owner@cafe.test');
  // The next break: the repair does not pass, so it is not published and a person is told once.
  broken.add(meta.id+':2');fixWorks=false;mails=[];
  const r2=await guard.guardOne(meta.id,deps(meta.id));
  assert.equal(r2.escalated,true);assert.match(r2.why,/still failed/);
  assert.equal(builder.loadMeta(meta.id).published.version,2,'a failing repair never goes live');
  assert.deepEqual(mails.map(m=>m.to).sort(),['help@kairoq.test','owner@cafe.test']);assert.match(mails[0].subject,/needs attention/);
  mails=[];
  const r3=await guard.guardOne(meta.id,deps(meta.id));
  assert.match(r3.why,/repairs? today|unpublished/);assert.equal(mails.length,0,'one email per problem');
  // It works again (the outside problem went away): the owner hears it.
  broken.delete(meta.id+':2');mails=[];
  await guard.guardOne(meta.id,deps(meta.id));
  assert.match(mails[0].subject,/works again/);assert.equal(guard.view(builder.loadMeta(meta.id)).incident,null);
 }finally{builder.edit=realEdit}
});

test('unpublished changes or the owner\'s switch stop automatic repairs; a hiccup is not a break',async()=>{
 const meta=builder.create({name:'Gym',owner:'owner'});
 await builder.initializeFrom(meta,app('Gym'),'Start');
 hosting.publish(meta.id,{slug:'gym-guard'});
 const realEdit=builder.edit;let edits=0;builder.edit=async()=>{edits++;return{version:1}};
 try{
  // A hiccup: broken on the first look only.
  let first=true;
  const flaky=deps(meta.id,{checkRuntime:async()=>{if(first){first=false;return{errors:['Page did not load: timeout']}}return{errors:[]}}});
  assert.deepEqual(await guard.guardOne(meta.id,flaky),{ok:true});
  await builder.saveSource(meta.id,app('Gym draft'),{summary:'draft'});
  broken.add(meta.id+':1');mails=[];
  let r=await guard.guardOne(meta.id,deps(meta.id));
  assert.match(r.why,/unpublished changes/);assert.equal(edits,0);
  assert.equal(guard.settings(meta.id,{autofix:false}).autofix,false);
  const m=builder.loadMeta(meta.id);m.current_version=1;builder.saveMeta(m);
  r=await guard.guardOne(meta.id,deps(meta.id));
  assert.match(r.why,/switched off/);assert.equal(edits,0);
 }finally{builder.edit=realEdit}
});
