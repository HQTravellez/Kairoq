'use strict';
// Like Lovable: after a build, two short next steps sit as pills above the message box, and the
// "<project>: Understanding your idea" bar above the box is gone (the chat already shows progress).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const reply=require('../agent-reply');
test('IDEA lines become suggestions and leave the message',async()=>{
 const {text,ideas}=reply.splitIdeas('Your tip calculator is in place.\nIDEA: Test calculation edge cases\nIDEA: Verify currency formatting.');
 assert.equal(text,'Your tip calculator is in place.');
 assert.deepEqual(ideas,['Test calculation edge cases','Verify currency formatting']);
 const facts=reply.facts({request:'tip calculator',outcome:'verified',changed:['src/App.jsx'],steps:3});
 const out=await reply.write({facts,callModel:async()=>'Your tip calculator is in place: enter the bill and pick a tip.\nIDEA: Test calculation edge cases\nIDEA: Add a currency picker'});
 assert.equal(out.source,'model');
 assert.doesNotMatch(out.text,/IDEA/);
 assert.deepEqual(out.ideas,['Test calculation edge cases','Add a currency picker']);
 assert.match(reply.SYSTEM,/IDEA: Test calculation edge cases/);
});
test('the build message keeps its ideas and the status bar above the box stays off',()=>{
 const agent=fs.readFileSync(path.join(__dirname,'..','react-agent.js'),'utf8'),js=fs.readFileSync(path.join(__dirname,'..','public','create.js'),'utf8');
 assert.match(agent,/\.\.\.\(written\.ideas&&written\.ideas\.length\?\{ideas:written\.ideas\}:\{\}\)/);
 assert.match(js,/function liveStrip\(j\)\{\n const s=\$\('ks-strip'\);if\(!s\)return;\n[^\n]*\n s\.classList\.add\('hidden'\);return;/);
});
