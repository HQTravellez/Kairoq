"use strict";
// The first build asks for a whole, designed product; later changes do not get that note.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-firstbuild-'));
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_BUILD_ENGINE='kairoq';
const builder=require('../react-builder');

// Records what the model is asked, then stops the build.
async function askedFor(id,message){
 const asked=[];
 await assert.rejects(builder.edit(id,message,{callModel:async o=>{asked.push(o.messages.at(-1).content);throw Error('stop')}}),/stop/);
 return asked.map(c=>typeof c==='string'?c:JSON.stringify(c)).join('\n');
}

test('the first build is asked for the whole product; a later change is not',{timeout:120000},async()=>{
 const meta=builder.create({name:'Yoga Studio',owner:'owner'});
 await builder.initialize(builder.loadMeta(meta.id));
 const first=await askedFor(meta.id,'A booking page for my yoga studio');
 assert.match(first,/This is the first build/);
 assert.match(first,/5 to 7 distinct sections/);
 const files={...builder.loadFiles(meta.id,builder.loadMeta(meta.id).current_version),'src/App.jsx':'export default function App(){return <main>Yoga</main>}'};
 await builder.saveSource(meta.id,files,{summary:'Owner edit'});
 assert.doesNotMatch(await askedFor(meta.id,'Make the header blue'),/This is the first build/);
});
