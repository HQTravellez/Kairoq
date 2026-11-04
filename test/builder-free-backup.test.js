"use strict";
// The free backup must keep working when OpenRouter retires a named free model: the log showed
// "nvidia/nemotron-3-super-120b-a12b:free This model is unavailable for free" on every build.
const test=require('node:test'),assert=require('node:assert/strict');
process.env.NODE_ENV='test';
process.env.OPENROUTER_API_KEY='test-only-not-a-real-key';
const {callDeveloperCodingModel}=require('../server');
const {starter}=require('../developer-starter');
const files=starter('Build a booking page','Demo','editorial').files;
const content='```html\n'+files['index.html']+'\n```\n```css\n'+files['styles.css']+'\n```\n```js\n'+files['app.js']+'\n```';
const RETIRED='nvidia/nemotron-3-super-120b-a12b:free';
async function run(env,reply){
 const saved={...process.env},original=global.fetch,calls=[];
 Object.assign(process.env,env);
 global.fetch=async(_url,init)=>{const model=JSON.parse(init.body).model;calls.push(model);return reply(model)};
 try{await callDeveloperCodingModel({messages:[]}).catch(()=>{});return calls}
 finally{global.fetch=original;for(const k of Object.keys(env))if(k in saved)process.env[k]=saved[k];else delete process.env[k]}
}
const ok=()=>({ok:true,json:async()=>({choices:[{message:{content}}],usage:{cost:0}})});
const retired=()=>({ok:false,status:404,json:async()=>({error:{message:'This model is unavailable for free. The paid version is available now'}})});
test('without settings the free backup starts with openrouter/free, not a retired model',async()=>{
 const calls=await run({KAIROQ_BUILDER_PAID_APPROVED:'false'},ok);
 assert.equal(calls[0],'openrouter/free');
 assert.ok(!calls.includes(RETIRED),calls.join(','));
});
test('a named free model that OpenRouter retired is tried once, then skipped',async()=>{
 const env={KAIROQ_BUILDER_PAID_APPROVED:'false',KAIROQ_BUILDER_FREE_MODEL:RETIRED};
 const first=await run(env,m=>m===RETIRED?retired():{ok:false,status:503,json:async()=>({error:{message:'busy'}})});
 assert.ok(first.includes(RETIRED));
 const second=await run(env,ok);
 assert.ok(!second.includes(RETIRED),second.join(','));
 assert.equal(second[0],'openrouter/free');
});
test('a free-pool reply cut off at its length limit is continued, not handed over half-written',async()=>{
 const env={FREELLMAPI_BASE_URL:'http://127.0.0.1:9/v1',FREELLMAPI_API_KEY:'test-only',KAIROQ_BUILDER_PAID_APPROVED:'false'};
 const saved={...process.env},original=global.fetch,bodies=[];
 Object.assign(process.env,env);
 const half=Math.floor(content.length/2);
 global.fetch=async(url,init)=>{
  const body=JSON.parse(init.body);bodies.push({url:String(url),body});
  const first=bodies.length===1;
  return{ok:true,status:200,text:async()=>JSON.stringify({model:'pool-model',choices:[{message:{content:first?content.slice(0,half):content.slice(half)},finish_reason:first?'length':'stop'}]})};
 };
 try{
  const r=await callDeveloperCodingModel({messages:[{role:'user',content:'build'}]});
  assert.equal(bodies.length,2,'one continuation request');
  assert.ok(bodies.every(b=>b.url.startsWith('http://127.0.0.1:9/v1')),'both went to the pool');
  assert.equal(bodies[1].body.model,'pool-model','the continuation asks the same model');
  assert.ok(r&&r.files&&Object.keys(r.files).length,'the joined reply is usable');
 }finally{global.fetch=original;for(const k of Object.keys(env))if(k in saved)process.env[k]=saved[k];else delete process.env[k]}
});
