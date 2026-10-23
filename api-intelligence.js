"use strict";
// Optional, advisory AI assistance for Kairoq's verified API workflow.
// CDM classifies documentation; Jev suggests investigation priorities.
// Never grants permissions, invents operations, changes a contract, or executes code.
const crypto=require("node:crypto");
const {performance}=require("node:perf_hooks");
const ENDPOINTS=Object.freeze({
 classify:"https://api.scaledown.xyz/classify",
 jev:"https://api.typesafe.ai/v1/systemone"
});
const LABELS=Object.freeze([
 {name:"authentication",rubric:"Is this about API access tokens, OAuth, client credentials, signatures, or authorization?"},
 {name:"dependencies",rubric:"Does this describe multiple dependent API calls, supplier orchestration, or workflow state?"},
 {name:"mapping",rubric:"Does this describe mapping, translating or normalizing request or response fields?"},
 {name:"errors",rubric:"Does this describe failed requests, retries, timeouts, rate limits or error handling?"},
 {name:"other",rubric:"Is this unrelated to authentication, workflow dependencies, field mapping or errors?"}
]);
const NEXT=Object.freeze({
 contract:"Recover the real versioned API contract or required fields",
 auth:"Inspect provider authentication and required grants or headers",
 mapping:"Verify request and response transformations against source contracts",
 workflow:"Verify dependencies, fanout, correlation identifiers and ordering",
 validation:"Investigate contract validation and known provider error responses",
 review:"Escalate: there is inadequate evidence or an unrecognized failure"
});
const SECRET_PATTERN=/(?:sk[-_](?:live|test|proj)[-_a-z0-9]{8,}|gh[pousr]_[A-Za-z0-9_]{12,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|bearer\s+[A-Za-z0-9._~+\/=-]{12,}|(?:password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|client_secret)\s*[:=]\s*\S+)/i;
const MAX_INPUT=9000;
function publicText(value){
 if(typeof value!=="string"||!value.trim()||Buffer.byteLength(value,"utf8")>MAX_INPUT)
  throw Error("Advisory AI requires 1-9000 bytes of explicit public test text");
 if(SECRET_PATTERN.test(value))throw Error("Potential private credential in advisory input");
 return value;
}
function metadata(text){
 const bytes=Buffer.byteLength(text,"utf8");
 return {bytes,sha256:crypto.createHash("sha256").update(text).digest("hex").slice(0,16)};
}
function confidence(x){return typeof x==="number"&&Number.isFinite(x)&&x>=0&&x<=1?x:null}
function parseClassify(data,minConfidence=.75){
 const label=data?.top_label,score=confidence(data?.scores?.[label]);
 if(!LABELS.some(x=>x.name===label)||score===null)return{status:"review",reason:"Invalid CDM output"};
 if(label==="other"||score<minConfidence)return{status:"review",reason:"Uncertain or unrelated documentation",candidate:label,confidence:score};
 return{status:"classified",label,confidence:score};
}
function parseJev(data,minConfidence=.82){
 const answer=data?.answers?.next;
 const p=confidence(answer?.probabilities?.[answer?.choice]);
 const c=confidence(answer?.confidence);
 if(answer?.type!=="choice"||!Object.hasOwn(NEXT,answer.choice)||p===null||c===null)
  return{status:"review",reason:"Invalid Jev typed decision"};
 if(answer.choice==="review"||p<minConfidence||c<minConfidence)
  return{status:"review",reason:"Low-confidence or escalate decision",candidate:answer.choice,confidence:c};
 return{status:"advisory",next:answer.choice,confidence:c,probability:p};
}
async function request(url,payload,key,{fetchImpl=globalThis.fetch,timeoutMs=7000}={}){
 if(![ENDPOINTS.classify,ENDPOINTS.jev].includes(url))throw Error("Unapproved inference endpoint");
 if(typeof key!=="string"||!key)return{status:"unavailable",reason:"Provider credential missing"};
 if(typeof fetchImpl!=="function"||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>20000)
  throw Error("Invalid inference transport settings");
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 const started=performance.now();
 try{
  const response=await fetchImpl(url,{method:"POST",redirect:"error",signal:controller.signal,
   headers:{"Content-Type":"application/json",...(url===ENDPOINTS.jev?{Authorization:"Bearer "+key}:{"x-api-key":key})},
   body:JSON.stringify(payload)});
  if(!response.ok)return{status:"unavailable",reason:"Provider rejected request",httpStatus:response.status};
  const raw=await response.text();
  if(raw.length>100000)throw Error("Oversized provider output");
  return{status:"ok",data:JSON.parse(raw),latencyMs:Math.round((performance.now()-started)*100)/100};
 }catch(e){
  return{status:"unavailable",reason:e?.name==="AbortError"?"Request timed out":"Transport or response parsing failed"};
 }finally{clearTimeout(timer)}
}
function countTokens(data){
 const u=data?.usage;
 if(!u||!Number.isFinite(u.input_tokens)||!Number.isFinite(u.output_tokens))return null;
 return{input:u.input_tokens,output:u.output_tokens};
}
async function classifyDocumentation(text,{
 enabled=false,key=process.env.SCALEDOWN_API_KEY,fetchImpl,minConfidence=.75
}={}){
 publicText(text);
 const info=metadata(text);
 if(!enabled)return{status:"disabled",source:info};
 if(!Number.isFinite(minConfidence)||minConfidence<.5||minConfidence>1)throw Error("Invalid CDM confidence threshold");
 const r=await request(ENDPOINTS.classify,{text,labels:LABELS,reasoning:false},key,{fetchImpl});
 if(r.status!=="ok")return{status:"unavailable",source:info,reason:r.reason,httpStatus:r.httpStatus??null};
 return{...parseClassify(r.data,minConfidence),source:info,latencyMs:r.latencyMs,
  usage:countTokens(r.data)}; // do not return raw provider data or source
}
async function chooseInvestigation(state,{
 enabled=false,key=process.env.TYPESAFE_API_KEY,fetchImpl,minConfidence=.82
}={}){
 publicText(state);
 const info=metadata(state);
 if(!enabled)return{status:"disabled",source:info};
 if(!Number.isFinite(minConfidence)||minConfidence<.5||minConfidence>1)throw Error("Invalid Jev confidence threshold");
 const r=await request(ENDPOINTS.jev,{
  model:"jev-latest",state,questions:{next:{type:"choice",
   instructions:"Choose one next investigation task based only on observed API integration evidence. Never create permissions, change an API contract, or execute network actions.",criteria:NEXT}}
 },key,{fetchImpl});
 if(r.status!=="ok")return{status:"unavailable",source:info,reason:r.reason,httpStatus:r.httpStatus??null};
 return{...parseJev(r.data,minConfidence),source:info,latencyMs:r.latencyMs,
  usage:countTokens(r.data)};
}
function estimateCost(usage,rates){
 // Prices are intentionally user-supplied: no fabricated provider billing information.
 if(!usage||!rates||!Number.isFinite(rates.inputPerMillion)||!Number.isFinite(rates.outputPerMillion))
  return null;
 if(rates.inputPerMillion<0||rates.outputPerMillion<0)return null;
 return Math.round((usage.input*rates.inputPerMillion+usage.output*rates.outputPerMillion)/1e6*1e8)/1e8;
}
module.exports={ENDPOINTS,LABELS,NEXT,publicText,parseClassify,parseJev,request,
 classifyDocumentation,chooseInvestigation,estimateCost};
