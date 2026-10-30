"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const free=require("../freellmapi");

function env(extra={}){return{
 FREELLMAPI_ENABLED:"true",
 FREELLMAPI_BASE_URL:"http://freellmapi.railway.internal:3001/v1",
 FREELLMAPI_API_KEY:"secret",
 ...extra
}}

test("FreeLLMAPI accepts Railway private HTTP and requires HTTPS for public hosts",()=>{
 assert.equal(free.baseUrl(env()),"http://freellmapi.railway.internal:3001/v1");
 assert.equal(free.baseUrl(env({FREELLMAPI_BASE_URL:"https://free.example.com"})),"https://free.example.com/v1");
 assert.throws(()=>free.baseUrl(env({FREELLMAPI_BASE_URL:"http://free.example.com"})),/must use HTTPS/);
 assert.equal(free.enabled(env()),true);
 assert.equal(free.enabled(env({FREELLMAPI_API_KEY:""})),false);
});

test("FreeLLMAPI picks separate general, coding and tool profiles",()=>{
 const e=env({FREELLMAPI_MODEL:"auto",FREELLMAPI_CODING_MODEL:"auto:coding",FREELLMAPI_TOOL_MODEL:"auto:tools"});
 assert.equal(free.modelFor({},e),"auto");
 assert.equal(free.modelFor({coding:true},e),"auto:coding");
 assert.equal(free.modelFor({tools:true},e),"auto:tools");
});

test("FreeLLMAPI discovers models and completes through the OpenAI-compatible surface",async()=>{
 free.resetCache();
 const calls=[];
 const fetchImpl=async(url,opts={})=>{
  calls.push({url:String(url),opts});
  if(String(url).endsWith("/models"))return new Response(JSON.stringify({data:[{id:"model-a"},{id:"model-b"}]}),{status:200,headers:{"content-type":"application/json"}});
  return new Response(JSON.stringify({model:"served-model",choices:[{message:{role:"assistant",content:"hello"},finish_reason:"stop"}],usage:{prompt_tokens:10,completion_tokens:2}}),{status:200,headers:{"content-type":"application/json"}});
 };
 const list=await free.models({env:env(),fetchImpl});
 assert.deepEqual(list,["model-a","model-b"]);
 const out=await free.complete([{role:"user",content:"hi"}],{env:env(),fetchImpl,coding:true,maxTokens:2000});
 assert.equal(out.text,"hello");
 assert.equal(out.model,"served-model");
 assert.equal(out.provider,"freellmapi");
 const body=JSON.parse(calls.at(-1).opts.body);
 assert.equal(body.model,"auto");
 assert.equal(body.max_tokens,2000);
 assert.equal(calls.at(-1).opts.headers.Authorization,"Bearer secret");
});

test("FreeLLMAPI JSON mode returns parsed structured output",async()=>{
 const fetchImpl=async()=>new Response(JSON.stringify({model:"m",choices:[{message:{content:'{"ok":true}'},finish_reason:"stop"}]}),{status:200});
 const out=await free.json([{role:"user",content:"json"}],{env:env(),fetchImpl});
 assert.deepEqual(out.value,{ok:true});
});

test("Kairoq routes free chat and Standard builds through FreeLLMAPI without hijacking Pro/Max",()=>{
 const server=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
 assert.match(server,/freePool\.complete\(opts\.messages/);
 assert.match(server,/FREELLMAPI_BUILDS/);
 assert.match(server,/\(!opts\.tier\|\|opts\.tier==="standard"\)/);
 assert.match(server,/FreeLLMAPI pool failed, continuing/);
 const registry=fs.readFileSync(path.join(__dirname,"..","capability-registry.js"),"utf8");
 assert.match(registry,/freellmapi_pool/);
 assert.match(registry,/Internal FreeLLMAPI multi-provider inference pool/);
});
