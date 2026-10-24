'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const policy=require('../builder-response-policy');
test('attached screenshots retain vision routing and ordinary text uses chat',()=>{
 assert.equal(policy.discussionTier([], 'pro'),'chat');
 assert.equal(policy.discussionTier([{}],'standard'),'vision');
 assert.equal(policy.discussionTier([{}],'vision'),'vision');
 assert.equal(policy.discussionTier([{}],'pro'),'pro');
});
test('text-chat attempts have bounded defaults, configurable deadlines and propagate cancellation',async()=>{
 for(const value of ['bad','0','30001','-1'])assert.equal(policy.chatTimeout({KAIROQ_CHAT_ATTEMPT_TIMEOUT_MS:value}),12000);
 const signal=policy.requestSignal({tier:'chat'},{env:{KAIROQ_CHAT_ATTEMPT_TIMEOUT_MS:'250'}});
 await new Promise(r=>setTimeout(r,270));assert.equal(signal.aborted,true);
 const controller=new AbortController(),combined=policy.requestSignal({tier:'chat',signal:controller.signal});
 controller.abort();assert.equal(combined.aborted,true);
});
