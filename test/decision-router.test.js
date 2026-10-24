"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const m=require('../decision-router');
const answer={answers:{route:{type:'choice',choice:'api',confidence:.94,probabilities:{api:.95}}}};
test('opt-in is disabled unless Jev or CDM explicitly selected',async()=>{
 assert.equal((await m.suggest('Build an API integration',{env:{}})).status,'disabled');
});
test('customer emails and personal data are not sent to decision providers',async()=>{
 let calls=0;
 const out=await m.suggest('Remove account jane@example.com',{env:{KAIROQ_DECISION_ROUTER:'jev',TYPESAFE_API_KEY:'fake'},fetchImpl:async()=>{calls++;throw Error('should not send')}});
 assert.equal(out.status,'local-only');assert.equal(calls,0);
});
test('Jev is advisory at high confidence and never approves actions',async()=>{
 const r=await m.suggest('Implement a food nutrition API integration',{env:{KAIROQ_DECISION_ROUTER:'jev',TYPESAFE_API_KEY:'fake'},fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify(answer)})});
 assert.equal(r.route,'api');assert.equal(r.status,'advisory');
 assert.match(m.note(r),/NOT a tool command/);
});
test('uncertain ScaleDown CDM decisions do not route',async()=>{
 const r=await m.suggest('Build an appointment calendar',{env:{KAIROQ_DECISION_ROUTER:'scaledown',SCALEDOWN_API_KEY:'fake'},fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify({answers:{route:{type:'choice',choice:'coding',confidence:.3,probabilities:{coding:.5}}}})})});
 assert.equal(r.status,'local-only');
});
