"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-edits-'));
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'acc.sqlite');
process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_BUILD_WORKERS='0';
const edits=require('../react-edits'),builder=require('../react-builder'),agent=require('../react-agent');
test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));

const PAGE=['import React from \'react\';','export default function App() {','  return (','    <main>',...Array.from({length:120},(_,i)=>'      <p className="row">Room '+(i+1)+'</p>'),'      <button className="btn">Book now</button>','    </main>','  );','}',''].join('\n');

test('find/replace edits: exact, indentation-tolerant, unique, and clear errors',()=>{
 let r=edits.apply({'src/App.jsx':PAGE},{'src/App.jsx':[{find:'<button className="btn">Book now</button>',replace:'<button className="btn">Reserve</button>'}]});
 assert.deepEqual(r.errors,[]);assert.deepEqual(r.changed,['src/App.jsx']);assert.match(r.files['src/App.jsx'],/Reserve<\/button>/);
 r=edits.apply({'src/App.jsx':PAGE},{'src/App.jsx':[{find:'<button className="btn">Book now</button>\n    </main>',replace:'<button className="btn">Book now</button>\n      <p>Free cancellation</p>\n    </main>'}]});
 assert.deepEqual(r.errors,[],'indentation differences are tolerated');assert.match(r.files['src/App.jsx'],/Free cancellation/);
 assert.match(edits.apply({'src/App.jsx':PAGE},{'src/App.jsx':[{find:'className="row"',replace:'x'}]}).errors[0],/matches 120 places/);
 assert.match(edits.apply({'src/App.jsx':PAGE},{'src/App.jsx':[{find:'<h1>Nope</h1>',replace:'x'}]}).errors[0],/was not found/);
 assert.match(edits.apply({},{'src/Missing.jsx':[{find:'a',replace:'b'}]}).errors[0],/does not exist/);
 r=edits.apply({'src/App.jsx':PAGE},{'src/App.jsx':[{find:'      <p className="row">Room 7</p>\n',replace:''}]});
 assert.ok(!r.files['src/App.jsx'].includes('Room 7<'),'"" deletes text');
 // A failed edit leaves the whole file unchanged.
 r=edits.apply({'src/App.jsx':PAGE},{'src/App.jsx':[{find:'Book now',replace:'Reserve'},{find:'nope',replace:'x'}]});
 assert.equal(r.files['src/App.jsx'],PAGE);
 assert.throws(()=>edits.normalize({'src/App.jsx':[{find:'',replace:'x'}]}),/non-empty "find"/);
 assert.throws(()=>edits.normalize([]),/must be an object/);
});

test('a one-line change as an edit is a small fraction of rewriting the file',()=>{
 const full=JSON.stringify({message:'Renamed the button.',files:{'src/App.jsx':PAGE.replace('Book now','Reserve')}});
 const small=JSON.stringify({message:'Renamed the button.',edits:{'src/App.jsx':[{find:'<button className="btn">Book now</button>',replace:'<button className="btn">Reserve</button>'}]}});
 assert.ok(small.length<full.length/20,small.length+' vs '+full.length+' characters of output');
});

test('build mode applies edits, and a failed edit goes back to the model without applying anything',async()=>{
 const meta=builder.create({name:'Edits'});await builder.initialize(meta);
 await builder.saveSource(meta.id,{...builder.loadFiles(meta.id,1),'src/App.jsx':PAGE},{summary:'Page'});
 const calls=[],queue=[
  {message:'Renamed.',edits:{'src/App.jsx':[{find:'<button className="btn">Book now</button>',replace:'<button className="btn">Reserve</button>'},{find:'<h1>Missing</h1>',replace:'x'}]}},
  {message:'Renamed.',edits:{'src/App.jsx':[{find:'<button className="btn">Book now</button>',replace:'<button className="btn">Reserve</button>'}]}}
 ];
 const callModel=async(opts,parse)=>{calls.push(opts);return parse(JSON.stringify(queue.shift()))};
 assert.match(builder.SYSTEM_PROMPT,/prefer small edits over rewriting it/);
 const r=await builder.edit(meta.id,'Rename the button',{callModel});
 assert.equal(r.attempts,2);assert.deepEqual(r.changed,['src/App.jsx']);
 const retry=calls[1].messages.filter(m=>m.role==='user').at(-1).content;
 assert.match(retry,/nothing was applied[\s\S]*edit 2 \(find "<h1>Missing<\/h1>"\) was not found/);
 const files=builder.loadFiles(meta.id,r.version);
 assert.match(files['src/App.jsx'],/Reserve<\/button>/);assert.match(files['src/App.jsx'],/Room 120/);
 assert.throws(()=>builder.parseEdit('{"message":"x"}'),/"files" object or "edits"/);
 assert.deepEqual(Object.keys(builder.parseEdit('{"message":"x","edits":{"src/App.jsx":[{"find":"a","replace":"b"}]}}').edits),['src/App.jsx']);
});

test('agent mode has an edit_files tool',async()=>{
 const meta=builder.create({name:'Agent edits'});await builder.initialize(meta);
 await builder.saveSource(meta.id,{...builder.loadFiles(meta.id,1),'src/App.jsx':PAGE},{summary:'Page'});
 const queue=[
  {thought:'Bad find first.',actions:[{tool:'edit_files',edits:{'src/App.jsx':[{find:'nope',replace:'x'}]}}]},
  {thought:'Rename it.',actions:[{tool:'edit_files',edits:{'src/App.jsx':[{find:'Book now',replace:'Reserve'}]}},{tool:'finish',message:'Renamed.'}]}
 ],calls=[];
 const r=await agent.run(meta.id,'Rename the button',{callModel:async(o,parse)=>{calls.push(o);return parse(JSON.stringify(queue.shift()))}});
 assert.match(calls[0].messages[0].content,/"tool":"edit_files"/);
 const step1=calls[1].messages.filter(m=>m.role==='user').at(-1).content;
 assert.match(typeof step1==='string'?step1:step1[0].text,/edit_files: nothing was changed[\s\S]*was not found/);
 assert.match(builder.loadFiles(meta.id,r.version)['src/App.jsx'],/Reserve<\/button>/);
 assert.equal(agent.describe({tool:'edit_files',edits:{'src/App.jsx':[]}}),'Edited src/App.jsx');
});
