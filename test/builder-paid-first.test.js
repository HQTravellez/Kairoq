"use strict";
// Ka's decision (Nov 2026): Auto builds go to the paid models first (Claude Sonnet, then DeepSeek);
// the free pool, Ollama, Experiential and the free OpenRouter models are only the backup.
const test=require('node:test'),assert=require('node:assert/strict');
process.env.NODE_ENV='test';
process.env.OPENROUTER_API_KEY='test-only-not-a-real-key';
delete process.env.ANTHROPIC_API_KEY;
const {callDeveloperCodingModel}=require('../server');
const {starter}=require('../developer-starter');
const files=starter('Build a booking page','Demo','editorial').files;
const content='```html\n'+files['index.html']+'\n```\n```css\n'+files['styles.css']+'\n```\n```js\n'+files['app.js']+'\n```';
const POOL={FREELLMAPI_BASE_URL:'http://127.0.0.1:9/v1',FREELLMAPI_API_KEY:'test-only'};
async function run(env,reply){
 const saved={...process.env},original=global.fetch,calls=[];
 for(const k of ['KAIROQ_BUILDER_MODE','KAIROQ_BUILDER_MODEL','KAIROQ_BUILDER_FALLBACK_MODEL','KAIROQ_BUILDER_FREE_MODEL'])delete process.env[k];
 Object.assign(process.env,env);
 global.fetch=async(url,init)=>{const body=JSON.parse(init.body);const who=String(url).startsWith('http://127.0.0.1:9')?'pool:'+body.model:body.model;calls.push(who);return reply(who)};
 try{await callDeveloperCodingModel({messages:[{role:'user',content:'build'}]}).catch(()=>{});return calls}
 finally{global.fetch=original;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}
}
const good=who=>who.startsWith('pool:')
 ?{ok:true,status:200,text:async()=>JSON.stringify({model:'pool-model',choices:[{message:{content},finish_reason:'stop'}]})}
 :{ok:true,json:async()=>({choices:[{message:{content}}],usage:{cost:who.endsWith(':free')||who==='openrouter/free'?0:0.01}})};
test('with paid builds approved, Auto goes to Claude Sonnet first, not the free pool',async()=>{
 const calls=await run({...POOL,KAIROQ_BUILDER_PAID_APPROVED:'true'},good);
 assert.equal(calls[0],'anthropic/claude-sonnet-5.5',calls.join(','));
 assert.ok(!calls.some(c=>c.startsWith('pool:')),calls.join(','));
});
test('when no paid model can run, the free pool is the backup and paid is not tried twice',async()=>{
 const reply=who=>who.startsWith('pool:')?good(who):{ok:false,status:402,json:async()=>({error:{message:'Insufficient credits. This account never purchased credits.'}})};
 const calls=await run({...POOL,KAIROQ_BUILDER_PAID_APPROVED:'true'},reply);
 assert.ok(calls.some(c=>c.startsWith('pool:')),calls.join(','));
 assert.equal(calls.filter(c=>c==='anthropic/claude-sonnet-5.5').length,1,calls.join(','));
});
test('after OpenRouter says it has no credits, its paid models are skipped on the next call',async()=>{
 const calls=await run({...POOL,KAIROQ_BUILDER_PAID_APPROVED:'true'},good);
 assert.ok(!calls.includes('anthropic/claude-sonnet-5.5')&&!calls.includes('deepseek/deepseek-v3.2'),calls.join(','));
 assert.ok(calls[0].startsWith('pool:'),calls.join(','));
});
test('KAIROQ_BUILDER_MODE=free-first keeps the old order',async()=>{
 const calls=await run({...POOL,KAIROQ_BUILDER_PAID_APPROVED:'true',KAIROQ_BUILDER_MODE:'free-first'},good);
 assert.ok(calls[0].startsWith('pool:'),calls.join(','));
});
