'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),guard=require('../model-output-guard');
test('provider safety classifiers and unexecuted tool dumps cannot be shown as completed work',()=>{
 for(const text of ['User Safety: unsafe Response Safety: safe Safety Categories: PII/Privacy','1. User Safety: unsafe Response Safety: safe','Let me implement it.<|tool_call_start|>[edit(file="src/a.js")]<|tool_call_end|>'])assert.throws(()=>guard.conversation(text),/Provider/);
 assert.equal(guard.conversation('Send the public API documentation URL so I can inspect the endpoints.'),'Send the public API documentation URL so I can inspect the endpoints.');
});
