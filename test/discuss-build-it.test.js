'use strict';
// In Ka's chat, "ok build it" and "can you bild thi" in Discuss only got the plan again.
const test=require('node:test'),assert=require('node:assert/strict');
const r=require('../conversation-routing');
test('a short yes in front of a build instruction still builds',()=>{
 for(const t of ['ok build it','Ok, build it','yes build it','great then make it blue','okay go ahead','ok, go ahead'])assert.equal(r.explicitExecution(t),true,t);
 for(const t of ['ok build it','yes, build it','okay do it'])assert.equal(r.proposalApproval(t),true,t);
});
test('common typos of "build" still build',()=>{
 for(const t of ['can you bild thi','buld it','bild it now'])assert.equal(r.explicitExecution(t),true,t);
});
test('questions and chat stay in Discuss',()=>{
 for(const t of ['ok what do you think','why did the build fail','i want more classy','hi','ok','what is this','so how does it work'])assert.equal(r.explicitExecution(t),false,t);
});
