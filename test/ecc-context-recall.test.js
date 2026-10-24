"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const memory=require('../ecc-context-recall');
test('retrieves older relevant owner requests beyond short model history',()=>{
 const messages=[{role:'user',text:'Please add camera nutrition label scanning to Platewise',at:'2026-10-10'}];
 for(let i=0;i<25;i++)messages.push({role:'assistant',text:'Working on other interface components '+i});
 const m=memory.recall({messages},'Where is the camera nutrition label?',{limit:2});
 assert.equal(m.length,1);assert.match(m[0].text,/camera nutrition label/);
 assert.equal(m[0].verified,false);
});
test('remembers correction in chronological order and does not treat assistant assertions as evidence',()=>{
 const msgs=[{role:'user',text:'Please include camera scanning'},{role:'assistant',text:'Camera has been implemented'},{role:'user',text:'Camera scanning is missing and inaccessible'}];
 const found=memory.recall({messages:msgs},'camera scanning');
 assert.equal(found.length,2);
 assert.match(found[1].text,/missing/);
 assert.doesNotMatch(memory.note({messages:msgs},'camera'),/Camera has been implemented/);
});
test('never scans other projects implicitly',()=>{
 assert.deepEqual(memory.recall({messages:[]},'guest portal'),[]);
});
test('integrated builder and agent receive project-scoped ECC recall',()=>{
 const fs=require('fs'),path=require('path');
 const b=fs.readFileSync(path.join(__dirname,'../react-builder.js'),'utf8');
 const a=fs.readFileSync(path.join(__dirname,'../react-agent.js'),'utf8');
 assert.match(b,/ecc-context-recall'\)\.note\(meta,text/);
 assert.match(a,/ecc-context-recall'\)\.note\(meta,text/);
});
