#!/usr/bin/env node
"use strict";
/* Provider-neutral, opt-in benchmark: no fallback, no retries, no secrets printed.
 * Requires Node 20+ and a compatible streaming Chat Completions endpoint.
 * Compare model names only after configuring their documented API endpoints.
 */
const fs=require("node:fs"),path=require("node:path"),{performance}=require("node:perf_hooks");
const scenarios=require("./model-speed-cases.json");
const specs=JSON.parse(process.env.KAIROQ_BENCH_MODELS||"[]");
const out=process.env.KAIROQ_BENCH_OUTPUT||"model-speed-results.json";
const system="You are Kairoq's project-aware planning assistant. Do not claim to have built or tested anything. Give a specific and concise answer. Do not invent browser evidence.";
const timeoutMs=Math.max(1000,Math.min(120000,Number(process.env.KAIROQ_BENCH_TIMEOUT_MS||30000)));
function settings(s){
 if(!s.label||!s.model||!s.baseUrl||!s.keyEnv)throw Error("Each model requires label, model, baseUrl, keyEnv");
 if(!/^https:\/\//.test(s.baseUrl))throw Error("baseUrl must be HTTPS");
 const key=process.env[s.keyEnv];if(!key)throw Error("Missing API key environment variable for "+s.label);
 return{key,url:s.baseUrl.replace(/\/$/,"")+"/chat/completions"};
}
async function run(s,c){
 const {key,url}=settings(s),start=performance.now();
 let first=null,body="",usage=null,finish=null,err=null;
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),timeoutMs);
 try{
  const res=await fetch(url,{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json",...s.headers},body:JSON.stringify({model:s.model,messages:[{role:"system",content:system},{role:"user",content:c.prompt}],temperature:0.2,max_tokens:450,stream:true,stream_options:{include_usage:true}}),signal:ac.signal});
  if(!res.ok)throw Error("HTTP "+res.status);
  if(!res.body)throw Error("No streaming body");
  const dec=new TextDecoder();let pending="";let done=false;
  for await(const chunk of res.body){
   pending+=dec.decode(chunk,{stream:true});
   let pos;while((pos=pending.indexOf("\n"))!==-1){
    const line=pending.slice(0,pos).trim();pending=pending.slice(pos+1);
    if(!line.startsWith("data:"))continue;const raw=line.slice(5).trim();
    if(raw==="[DONE]"){done=true;break}
    let event;try{event=JSON.parse(raw)}catch{continue}
    if(event.usage)usage=event.usage;
    const delta=event.choices?.[0]?.delta?.content;
    if(typeof delta==="string"&&delta){if(first===null)first=performance.now()-start;body+=delta}
    if(event.choices?.[0]?.finish_reason)finish=event.choices[0].finish_reason;
   }if(done)break;
  }
  if(!body)throw Error("Empty streaming response");
 }catch(e){err=e.name==="AbortError"?"Timed out":String(e.message||e).slice(0,160)}
 finally{clearTimeout(timer)}
 return {case:c.id,category:c.category,model:s.label,modelId:s.model,ttftMs:first===null?null:Math.round(first),totalMs:Math.round(performance.now()-start),outputChars:body.length,usage:usage||null,finish,error:err,answer:body.slice(0,3000)};
}
(async()=>{
 if(!Array.isArray(specs)||!specs.length)throw Error("Set KAIROQ_BENCH_MODELS to a JSON array of configured model specs");
 if(specs.some(s=>!s.label||!s.model))throw Error("Malformed model specs");
 const results=[];
 for(const s of specs){for(const c of scenarios){
  const r=await run(s,c);results.push(r);
  console.log(JSON.stringify({case:r.case,model:r.model,ttftMs:r.ttftMs,totalMs:r.totalMs,error:r.error}));
 }}
 fs.writeFileSync(out,JSON.stringify({createdAt:new Date().toISOString(),questions:scenarios.length,results},null,2)+"\n");
 console.log("Wrote "+path.resolve(out));
})().catch(e=>{console.error(String(e.message||e));process.exitCode=1});
