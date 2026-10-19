"use strict";
// Which service writes the apps: OpenRouter whenever its key is set; Experiential Labs only when
// chosen (KAIROQ_BUILDER_PROVIDER=experiential) or when it is the only key.
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

test('with both keys set and paid models allowed, builds go to OpenRouter',async()=>{
 assert.equal(await providerUsed({OPENROUTER_API_KEY:'test-only',EXPLABS_API_KEY:'test-only'}),'openrouter');
});
test('with only free OpenRouter models allowed, Experiential writes the apps when it is configured',async()=>{
 assert.equal(await providerUsed({OPENROUTER_API_KEY:'test-only',EXPLABS_API_KEY:'test-only',KAIROQ_BUILDER_MODE:'free-first'}),'experiential');
 assert.equal(await providerUsed({OPENROUTER_API_KEY:'test-only',EXPLABS_API_KEY:'test-only',KAIROQ_BUILDER_PAID_APPROVED:'false'}),'experiential');
 assert.equal(await providerUsed({OPENROUTER_API_KEY:'test-only',EXPLABS_API_KEY:'test-only',KAIROQ_BUILDER_MODE:'free-first',KAIROQ_BUILDER_PROVIDER:'openrouter'}),'openrouter','an explicit choice wins');
});
test('Experiential is used when chosen, or when it is the only key',async()=>{
 assert.equal(await providerUsed({OPENROUTER_API_KEY:'test-only',EXPLABS_API_KEY:'test-only',KAIROQ_BUILDER_PROVIDER:'experiential'}),'experiential');
 assert.equal(await providerUsed({OPENROUTER_API_KEY:undefined,EXPLABS_API_KEY:'test-only'}),'experiential');
});
