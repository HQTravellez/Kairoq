"use strict";
// The owner's setup checklist: what is set up, and where to fix what is missing, without values.
const test=require('node:test'),assert=require('node:assert/strict');
process.env.NODE_ENV='test';
const setup=require('../setup-status');

test('the checklist says what is missing and where to fix it, never the values',()=>{
 const none=setup.items({env:{NODE_ENV:'production'}});
 const by=id=>none.items.find(i=>i.id===id);
 assert.equal(by('storage').ok,false);assert.equal(by('ai').ok,false);
 assert.ok(none.missing_required>=2);
 for(const i of none.items)if(!i.ok)assert.match(i.fix,/Railway|Dockerfile/);
 const saved={...process.env};
 Object.assign(process.env,{OPENROUTER_API_KEY:'sk-or-secret-value',KAIROQ_RESEND_API_KEY:'re_secret',KAIROQ_EMAIL_FROM:'hi@example.com'});
 try{
  const some=setup.items({env:{...process.env,KAIROQ_PERSISTENT:'1'}});
  const s=id=>some.items.find(i=>i.id===id);
  assert.equal(s('storage').ok,true);assert.equal(s('ai').ok,true);assert.equal(s('email').ok,true);
  assert.ok(!JSON.stringify(some).includes('secret'),'no values in the checklist');
 }finally{process.env=saved}
});
