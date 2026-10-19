"use strict";
// Tests the app writes for itself: the AI sends browser checks with the change that builds a
// flow; Kairoq keeps only the ones that pass on the new version, never overwrites the owner's,
// and they then protect that flow in every later change.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-aichecks-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const builder=require('../react-builder'),checks=require('../react-checks');
const APP='export default function App(){return <main><h1>Contacts</h1></main>}\n';
const reply=obj=>(_o,parse)=>Promise.resolve(parse(JSON.stringify(obj)));
// A test browser: a step fails when it looks for the text "Missing".
const inspect=async(url,{steps})=>({skipped:false,errors:[],steps:(steps||[]).map(s=>({step:JSON.stringify(s),ok:s.text!=='Missing'}))});
const add={name:'Add a contact',steps:[{action:'click',text:'Add contact'},{action:'fill',label:'Name',value:'Test Ana'},{action:'click',text:'Save'},{action:'expect',text:'Test Ana'}]};
const broken={name:'Delete a contact',steps:[{action:'click',text:'Missing'},{action:'expect',text:'Deleted'}]};

test('checks sent with a change are kept only when they pass on the new version',async()=>{
 const meta=builder.create({name:'Crm',owner:'owner'});await builder.initialize(meta);
 const r=await builder.edit(meta.id,'contacts',{inspect,callModel:reply({message:'v',files:{'src/App.jsx':APP},checks:[add,broken,{name:'No expect',steps:[{action:'click',text:'x'}]}]})});
 assert.deepEqual(r.tests_added,['Add a contact']);
 const saved=checks.list(builder.loadMeta(meta.id));
 assert.deepEqual(saved.map(c=>[c.name,c.source]),[['Add a contact','kairoq']]);
 assert.deepEqual(builder.loadMeta(meta.id).messages.at(-1).tests_added,['Add a contact']);
 // The next change runs it, like any saved check.
 let ran=0;
 await builder.edit(meta.id,'colour',{inspect:async(u,o)=>{ran++;return inspect(u,o)},callModel:reply({message:'v',files:{'src/App.jsx':APP.replace('Contacts','People')}})});
 assert.ok(ran>=1,'the kept check ran on the next change');
});

test('an owner check with the same name is never replaced, and Kairoq keeps at most 10',async()=>{
 const meta=builder.create({name:'Crm2',owner:'owner'});await builder.initialize(meta);
 checks.save(meta.id,{...add,steps:[...add.steps,{action:'expect',text:'Owner step'}]},{source:'user'});
 const r=await builder.edit(meta.id,'contacts',{inspect,callModel:reply({message:'v',files:{'src/App.jsx':APP},checks:[add]})});
 assert.equal(r.tests_added,undefined);
 const c=checks.list(builder.loadMeta(meta.id))[0];assert.equal(c.source,'user');assert.equal(c.steps.length,5);
 const m3=builder.create({name:'Crm3',owner:'owner'});await builder.initialize(m3);
 for(let i=0;i<10;i++)checks.save(m3.id,{...add,name:'Kairoq '+i},{source:'kairoq'});
 const r3=await builder.edit(m3.id,'more',{inspect,callModel:reply({message:'v',files:{'src/App.jsx':APP},checks:[{...add,name:'Eleventh'}]})});
 assert.equal(r3.tests_added,undefined,'no more than 10 of Kairoq\'s own');
});

test('no browser, or a change that still shows errors: nothing is kept',async()=>{
 const meta=builder.create({name:'Crm4',owner:'owner'});await builder.initialize(meta);
 const r=await builder.edit(meta.id,'contacts',{callModel:reply({message:'v',files:{'src/App.jsx':APP},checks:[add]})});
 assert.equal(r.tests_added,undefined);assert.equal(checks.list(builder.loadMeta(meta.id)).length,0);
});
