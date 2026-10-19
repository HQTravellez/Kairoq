"use strict";
// Project memory: facts read from the current code and every request the owner made go with
// every AI request, so long projects keep their early decisions.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-memory-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const builder=require('../react-builder'),memory=require('../project-memory');

test('facts come from the code: pages, data, SQL, server functions and what the app uses',()=>{
 const f=memory.facts({'src/backend.json':JSON.stringify({collections:{contacts:{access:'shared'},deals:{}}}),'src/App.jsx':"import {auth,payments,referrals} from 'kairoq';auth.signIn();payments.checkout();referrals.mine();<Route path=\"/deals\" />",'sql/001_init.sql':'CREATE TABLE IF NOT EXISTS invoices(id INTEGER);','functions/stripe-hook.js':'x','src/pages/Contacts.jsx':'x'});
 assert.deepEqual(f.collections,['contacts (shared)','deals (private)']);assert.deepEqual(f.sql_tables,['invoices']);assert.deepEqual(f.server_functions,['stripe-hook']);
 assert.deepEqual(f.pages,['Contacts','/deals']);assert.deepEqual(f.uses,['sign-in','payments','invite a friend']);
});

test('the first decision is still in the AI request after 70 changes, and the note stays short',async()=>{
 const meta=builder.create({name:'Agency CRM',owner:'owner'});await builder.initialize(meta);
 const m=builder.loadMeta(meta.id);
 m.messages.push({role:'user',text:'A CRM for my agency. Prices in EUR. Only staff sign in.'},...Array.from({length:70},(_,i)=>({role:'user',text:'Change number '+i+' '+'x'.repeat(400)})));
 builder.saveMeta(m);
 let system='';
 await builder.edit(meta.id,'Add a notes field',{callModel:(o,parse)=>{system=o.messages[0].content;return Promise.resolve(parse(JSON.stringify({message:'ok',files:{'src/App.jsx':'export default function App(){return <h1>CRM</h1>}\n'}})))}});
 assert.match(system,/Project memory/);
 assert.match(system,/1\. A CRM for my agency\. Prices in EUR\. Only staff sign in\./,'the first request is kept whole');
 assert.match(system,/Change number 69 x{400}/,'the latest requests are kept whole');
 assert.match(system,/earlier requests left out/);
 const note=memory.note(builder.loadMeta(meta.id),builder.loadFiles(meta.id,builder.loadMeta(meta.id).current_version));
 assert.ok(note.length<=6000,note.length);
});

test('a new project has no memory yet',()=>{
 assert.equal(memory.note({name:'x',messages:[]},{}),'');
});
