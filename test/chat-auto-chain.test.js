"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const chain=require("../chat-auto-chain");

const step=(id,{ready=true,fail=null,partial=false,calls}={})=>({id,label:id,ready:()=>ready,run:async()=>{calls&&calls.push(id);if(fail){const e=Object.assign(Error(fail),partial?{afterPartial:true}:{});if(/credits/.test(fail))e.status=402;throw e}return{provider:id}}});

test("tries steps in order, skips ones not set up, and answers from the first that works",async()=>{
 const calls=[];
 const out=await chain.run([step("freellmapi",{ready:false,calls}),step("local",{fail:"timeout",calls}),step("claude",{calls}),step("openrouter",{calls})]);
 assert.equal(out.provider,"claude");
 assert.deepEqual(calls,["local","claude"]);
 assert.deepEqual(out.tried,["freellmapi (not set up)","local (timeout)"]);
});

test("a step that already wrote part of the answer ends the chain",async()=>{
 const calls=[];
 await assert.rejects(chain.run([step("local",{fail:"stream cut",partial:true,calls}),step("claude",{calls})]),/stream cut/);
 assert.deepEqual(calls,["local"]);
});

test("when nothing answers, the error lists what was tried in plain words",async()=>{
 chain.resetOpenRouter();
 await assert.rejects(chain.run([step("freellmapi",{ready:false}),step("openrouter",{fail:"your OpenRouter account has no credits"})]),
  e=>e.status===503&&/No model could answer right now\. Tried: freellmapi \(not set up\); openrouter \(no credits\)\./.test(e.message)&&!/hermes/i.test(e.message));
});

test("OpenRouter is skipped for an hour after it says it has no credits",()=>{
 chain.resetOpenRouter();
 assert.equal(chain.openRouterSkipped(),false);
 chain.markOpenRouter(Object.assign(Error("x"),{status:402}),1000);
 assert.equal(chain.openRouterSkipped(1000+chain.SKIP_MS-1),true);
 assert.equal(chain.openRouterSkipped(1000+chain.SKIP_MS),false);
 chain.resetOpenRouter();
 chain.markOpenRouter(Error("rate limited"),1000);
 assert.equal(chain.openRouterSkipped(1001),false);
});

test("Auto chat in server.js uses the chain with OpenRouter last and Claude before it",()=>{
 const src=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
 const i=src.indexOf('require("./chat-auto-chain")');
 assert.ok(i>0,"chain is wired into the chat route");
 const block=src.slice(i,i+6000);
 const order=["freellmapi","local","free-keys","claude","opencode","openrouter"].map(id=>block.indexOf('{id:"'+id+'"'));
 assert.ok(order.every(n=>n>0),"every step is present");
 assert.deepEqual([...order].sort((a,b)=>a-b),order,"steps run in the planned order");
 assert.match(block,/chain\.openRouterSkipped\(\)/);
 assert.match(block,/KAIROQ_CLAUDE_CHAT_MONTHLY_USD\?\?30/);
 // Kairoq Agent runs before the chain.
 assert.ok(src.indexOf("Kairoq Agent unavailable")<i);
});

test("live route: free pool down → Ollama Cloud answers; nothing set up → plain error, no OpenRouter",{timeout:60000},async()=>{
 const http=require("node:http"),{spawn}=require("node:child_process");
 const fake=(handler)=>new Promise(r=>{const s=http.createServer(handler);s.listen(0,"127.0.0.1",()=>r(s))});
 const pool=await fake((req,res)=>{res.writeHead(500,{"Content-Type":"application/json"});res.end(JSON.stringify({error:{message:"all providers cooling down"}}))});
 const local=await fake((req,res)=>{
  if(req.url.endsWith("/models"))return res.end(JSON.stringify({data:[{id:"gemma4:31b"}]}));
  let b="";req.on("data",c=>b+=c);req.on("end",()=>{res.writeHead(200,{"Content-Type":"text/event-stream"});res.end(`data: ${JSON.stringify({model:"gemma4:31b",choices:[{index:0,delta:{content:"pong"}}]})}\n\ndata: [DONE]\n\n`)});
 });
 const start=async env=>{const port=39000+Math.floor(Math.random()*900);const p=spawn(process.execPath,["server.js"],{cwd:path.join(__dirname,".."),env:{...process.env,PORT:String(port),KAIROQ_HERMES_URL:"",KAIROQ_HERMES_KEY:"",ANTHROPIC_API_KEY:"",OPENROUTER_API_KEY:"",KAIROQ_OPENCODE_ZEN_KEY:"",GEMINI_API_KEY:"",NVIDIA_API_KEY:"",GROQ_API_KEY:"",HF_TOKEN:"",...env},stdio:"ignore"});
  const end=Date.now()+20000;while(Date.now()<end){try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok)break}catch{}await new Promise(r=>setTimeout(r,250))}
  return{p,ask:async()=>(await fetch(`http://127.0.0.1:${port}/api/chat/stream`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"openrouter/free",messages:[{role:"user",content:"ping"}]})})).text()}};
 const a=await start({FREELLMAPI_BASE_URL:`http://127.0.0.1:${pool.address().port}/v1`,FREELLMAPI_API_KEY:"test-pool-key",LOCAL_LLM_BASE_URL:`http://127.0.0.1:${local.address().port}/v1`,LOCAL_LLM_MODEL:"gemma4:31b"});
 const b=await start({FREELLMAPI_BASE_URL:"",FREELLMAPI_API_KEY:"",LOCAL_LLM_BASE_URL:"http://127.0.0.1:9/v1",LOCAL_LLM_MODEL:""});
 try{
  const out=await a.ask();
  assert.match(out,/Kairoq Free Pool…/);
  assert.match(out,/Ollama Cloud…/);
  assert.match(out,/"text":"pong"/);
  const none=await b.ask();
  assert.match(none,/No model could answer right now\. Tried: Kairoq Free Pool \(not set up\)/);
  assert.doesNotMatch(none,/OpenRouter turned this down|hermes/i);
 }finally{a.p.kill();b.p.kill();pool.close();local.close()}
});
