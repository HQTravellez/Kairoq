"use strict";
// Which service writes the apps: Experiential Labs whenever its key is set; OpenRouter when chosen
// (KAIROQ_BUILDER_PROVIDER=openrouter) or when it is the only key.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-provider-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const {callBuilderModel}=require('../server');

async function providerUsed(env){
 const saved={...process.env},original=global.fetch,urls=[];
 Object.assign(process.env,{KAIROQ_BUILDER_MODE:'paid-first',KAIROQ_BUILDER_PAID_APPROVED:'true'},env);
 for(const k of Object.keys(env))if(env[k]===undefined)delete process.env[k];
 global.fetch=async(url)=>{urls.push(String(url));return new Response(JSON.stringify({choices:[{message:{content:'{"ok":true}'}}],usage:{cost:0}}),{status:200,headers:{'Content-Type':'application/json'}})};
 try{await callBuilderModel({messages:[{role:'user',content:'x'}]},c=>JSON.parse(c))}finally{global.fetch=original;process.env=saved}
 return urls.some(u=>u.includes('experientiallabs'))?'experiential':urls.some(u=>u.includes('openrouter'))?'openrouter':'none';
}

test('with the Experiential key set, it writes the apps (the default for now)',async()=>{
 assert.equal(await providerUsed({OPENROUTER_API_KEY:'test-only',EXPLABS_API_KEY:'test-only'}),'experiential');
 assert.equal(await providerUsed({OPENROUTER_API_KEY:undefined,EXPLABS_API_KEY:'test-only'}),'experiential');
});
test('OpenRouter writes the apps when chosen, or when it is the only key',async()=>{
 assert.equal(await providerUsed({OPENROUTER_API_KEY:'test-only',EXPLABS_API_KEY:'test-only',KAIROQ_BUILDER_PROVIDER:'openrouter'}),'openrouter');
 assert.equal(await providerUsed({OPENROUTER_API_KEY:'test-only',EXPLABS_API_KEY:undefined}),'openrouter');
});

// A Claude model the owner picks by name goes straight to Anthropic when ANTHROPIC_API_KEY is set
// (anthropic.js), even in the default free-first mode and without an OpenRouter key.
async function claudeCall(env){
 const saved={...process.env},original=global.fetch,calls=[];
 Object.assign(process.env,{KAIROQ_BUILDER_PAID_APPROVED:'true'},env);
 for(const k of Object.keys(env))if(env[k]===undefined)delete process.env[k];
 global.fetch=async(url,o)=>{calls.push({url:String(url),body:JSON.parse(o&&o.body||'{}')});
  const anthropic=String(url).includes('api.anthropic.com');
  return new Response(JSON.stringify(anthropic?{content:[{type:'text',text:'{"ok":true}'}],stop_reason:'end_turn',usage:{input_tokens:10,output_tokens:3}}:{choices:[{message:{content:'{"ok":true}'}}],usage:{cost:0}}),{status:200,headers:{'Content-Type':'application/json'}})};
 let fellBack=null;
 try{await callBuilderModel({model:'anthropic/claude-opus-5.5',onFallback:e=>{fellBack=e},messages:[{role:'system',content:'Rules'},{role:'user',content:'x'}]},c=>JSON.parse(c))}finally{global.fetch=original;process.env=saved}
 return{calls,fellBack};
}
test('a chosen Claude model goes straight to Anthropic when its key is set',async()=>{
 for(const env of [{ANTHROPIC_API_KEY:'test-only',OPENROUTER_API_KEY:undefined,EXPLABS_API_KEY:undefined,KAIROQ_BUILDER_MODE:undefined},{ANTHROPIC_API_KEY:'test-only',OPENROUTER_API_KEY:'test-only',EXPLABS_API_KEY:undefined}]){
  const {calls,fellBack}=await claudeCall(env);
  assert.equal(fellBack,null);
  assert.equal(calls.length,1);assert.match(calls[0].url,/api\.anthropic\.com\/v1\/messages/);
  assert.equal(calls[0].body.model,'claude-opus-5-5');assert.equal(calls[0].body.system[0].text,'Rules');
 }
 // Without the Anthropic key the same choice goes through OpenRouter, as before.
 const {calls}=await claudeCall({ANTHROPIC_API_KEY:undefined,OPENROUTER_API_KEY:'test-only',EXPLABS_API_KEY:undefined});
 assert.match(calls[0].url,/openrouter\.ai/);assert.equal(calls[0].body.model,'anthropic/claude-opus-5.5');
});
