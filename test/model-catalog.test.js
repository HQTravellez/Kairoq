'use strict';
// The chat box lists every free model (the free pool and OpenRouter's ":free" models) and a pick
// by id runs at no credits; paid picks still need paid builds switched on.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kq-catalog-'));
Object.assign(process.env,{NODE_ENV:'test',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'p'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite')});
const C=require('../model-choices');
const CATALOG=[{id:'freellm/auto',name:'Kairoq Free Pool',isFree:true,source:'freellmapi'},{id:'freellm/deepseek/deepseek-r1',name:'deepseek-r1 · Free pool',isFree:true,source:'freellmapi'},{id:'qwen/qwen3-coder:free',name:'Qwen: Qwen3 Coder (free)',isFree:true,context_length:262144,supportsVision:false,source:'openrouter'},{id:'anthropic/claude-sonnet-5.5',name:'Claude Sonnet 5.5',isFree:false,source:'openrouter'}];

test('the free catalogue: provider, label and note per model; paid ones left out',()=>{
 const free=C.remember(CATALOG);
 assert.deepEqual(free.map(m=>m.id),['freellm/auto','freellm/deepseek/deepseek-r1','qwen/qwen3-coder:free']);
 const qwen=free[2];
 assert.equal(qwen.label,'Qwen: Qwen3 Coder');assert.equal(qwen.credits,0);assert.equal(qwen.free,true);
 assert.deepEqual(qwen.provider,{key:'qwen',name:'Qwen'});assert.equal(qwen.note,'Qwen · 262k context');
 assert.deepEqual(free[1].provider,{key:'deepseek',name:'DeepSeek'});
});

test('a free model picked by id runs free; an unknown id or a paid one without paid builds means Auto',()=>{
 C.remember(CATALOG);
 const env={OPENROUTER_API_KEY:'k'};
 assert.equal(C.pick('qwen/qwen3-coder:free',env).credits,0);
 assert.equal(C.pick('qwen/qwen3-coder:free',{}),null,'OpenRouter free models need the key');
 assert.equal(C.pick('freellm/deepseek/deepseek-r1',{FREELLMAPI_BASE_URL:'https://pool.example.com/v1',FREELLMAPI_API_KEY:'k'}).free,true);
 assert.equal(C.pick('nobody/made-this',env),null);
 assert.equal(C.pick('anthropic/claude-sonnet-5.5',env),null,'paid needs KAIROQ_BUILDER_PAID_APPROVED');
});

test('/me lists the free models for the chat box',async()=>{
 const api=require('../create-api');
 const server=http.createServer((req,res)=>api.handle(req,res,{isOwner:()=>true,secure:false,listModels:async()=>CATALOG}).then(h=>{if(!h){res.writeHead(404);res.end()}}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/create/me');const j=await r.json();
  assert.equal(j.free_models.length,3);assert.equal(j.free_models[2].label,'Qwen: Qwen3 Coder');assert.equal(j.free_models[2].provider.name,'Qwen');
  assert.ok(Array.isArray(j.models)&&j.models[0].id==='auto');
 }finally{server.close()}
});
