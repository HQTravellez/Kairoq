"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
process.env.NODE_ENV='test';
process.env.OPENROUTER_API_KEY='test-only-not-a-real-key';
const {callDeveloperCodingModel}=require('../server');
const {starter}=require('../developer-starter');
const files=starter('Build corporate travel website','Demo','editorial').files;
const content='```html\n'+files['index.html']+'\n```\n```css\n'+files['styles.css']+'\n```\n```js\n'+files['app.js']+'\n```';
async function firstModel(env){
 const saved={...process.env},original=global.fetch,calls=[];
 Object.assign(process.env,env);
 global.fetch=async(_url,init)=>{const model=JSON.parse(init.body).model;calls.push(model);return{ok:true,json:async()=>({choices:[{message:{content}}],usage:{cost:model.endsWith(':free')||model==='openrouter/free'?0:0.000001,prompt_tokens:1,completion_tokens:1}})}};
 try{const result=await callDeveloperCodingModel({messages:[]});return{calls,summary:result.summary};}
 finally{global.fetch=original;for(const k of Object.keys(env))if(k in saved)process.env[k]=saved[k];else delete process.env[k];}
}
test('paid-first uses the paid coding model before free models when approved',async()=>{
 const {calls}=await firstModel({KAIROQ_BUILDER_MODE:'paid-first',KAIROQ_BUILDER_PAID_APPROVED:'true',KAIROQ_BUILDER_MODEL:'deepseek/deepseek-v3.2',KAIROQ_BUILDER_MONTHLY_LIMIT_USD:'20'});
 assert.equal(calls[0],'deepseek/deepseek-v3.2');
});
test('paid-first stays on free models without explicit paid approval',async()=>{
 const {calls}=await firstModel({KAIROQ_BUILDER_MODE:'paid-first',KAIROQ_BUILDER_PAID_APPROVED:'false'});
 assert.ok(calls[0].endsWith(':free')||calls[0]==='openrouter/free');
});
test('paid-first falls back to free models once the builder monthly budget is spent',async()=>{
 await firstModel({KAIROQ_BUILDER_MODE:'paid-first',KAIROQ_BUILDER_PAID_APPROVED:'true',KAIROQ_BUILDER_MONTHLY_LIMIT_USD:'20'});
 const {calls}=await firstModel({KAIROQ_BUILDER_MODE:'paid-first',KAIROQ_BUILDER_PAID_APPROVED:'true',KAIROQ_BUILDER_MONTHLY_LIMIT_USD:'0.0000001'});
 assert.ok(calls.every(m=>m.endsWith(':free')||m==='openrouter/free'),calls.join(','));
});
