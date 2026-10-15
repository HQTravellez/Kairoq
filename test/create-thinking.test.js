"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-thinking-'));
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'acc.sqlite');
process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_BUILD_WORKERS='0';
const builder=require('../react-builder'),{streamSnapshot}=require('../create-api');
test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));

test('the plan streams item by item, before the code',()=>{
 assert.deepEqual(streamSnapshot('{"plan":["Add a bo','build').plan,['Add a bo']);
 assert.deepEqual(streamSnapshot('{"plan":["Add a booking form","Save it to \\"bookings\\""','build').plan,['Add a booking form','Save it to "bookings"']);
 const done=streamSnapshot('{"plan":["A","B"],"message":"Done","files":{"src/App.jsx":"export default 1"}}','build');
 assert.deepEqual(done.plan,['A','B']);assert.equal(done.message,'Done');assert.deepEqual(done.files,['src/App.jsx']);
 assert.deepEqual(streamSnapshot('{"message":"No plan","files":{}}','build').plan,[]);
});

test('a change keeps its plan, the model\'s reasoning and how long it thought',async()=>{
 const meta=builder.create({name:'Thinking'});await builder.initialize(meta);
 const files=builder.loadFiles(meta.id,1),live=[];let seen;
 const callModel=async(opts,parse)=>{
  seen=opts;
  opts.onReasoning('The user','The user');opts.onReasoning(' wants a title.','The user wants a title.');
  await new Promise(r=>setTimeout(r,30));
  const reply=JSON.stringify({plan:['Add a title to the page','  ',''],message:'Added a title.',files:{'src/App.jsx':files['src/App.jsx'].replace(/<\/main>|<\/div>\s*\);\s*}\s*$/,m=>'<h1>Hello</h1>'+m)}});
  opts.onToken(reply,reply);
  return parse(reply);
 };
 const r=await builder.edit(meta.id,'Add a title',{callModel,onStream:()=>{},onThinking:t=>live.push(t)});
 assert.equal(typeof seen.onReasoning,'function');
 assert.deepEqual(live,['The user','The user wants a title.']);
 assert.deepEqual(r.plan,['Add a title to the page'],'empty plan items are dropped');
 const m=builder.loadMeta(meta.id).messages.at(-1);
 assert.deepEqual(m.plan,['Add a title to the page']);
 assert.equal(m.thinking,'The user wants a title.');
 assert.ok(m.thought_ms>=25,'time until the first word of the answer: '+m.thought_ms);
 assert.equal(m.attempts,undefined,'first-try changes do not say "fixed"');
 assert.match(builder.SYSTEM_PROMPT,/"plan":\[/);
});
