"use strict";
// Evaluation-only decision layer. No customer flows import this module.
// Tokens, passwords, payment details and personal customer data must not be supplied.
const JEV_ENDPOINT="https://api.typesafe.ai/v1/systemone";
const SCALEDOWN_ENDPOINT="https://api.scaledown.xyz/compress/raw/";
const ROUTES=Object.freeze(["auth","api","database","visual","test","build","other"]);
function publicFixture(text){
 if(typeof text!=="string"||text.length>12000)throw Error("Public test fixture must be a string no longer than 12,000 characters");
 if(/(?:sk[-_](?:live|test|proj|)[-_a-z0-9]{10,}|gh[pousr]_[a-z0-9]{12,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|bearer\s+[A-Za-z0-9._~+\/=-]{12,}|password\s*[:=]|api[_-]?key\s*[:=]|secret\s*[:=])/i.test(text))
  throw Error("Potential credential in fixture: refusal to send external request");
 return text;
}
async function call(url,payload,key,headers,fetchImpl){
 if(!key||typeof key!=="string")return {status:"unavailable",reason:"No trial API key configured"};
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),10000);
 try{
  const r=await fetchImpl(url,{method:"POST",headers:{...headers,"content-type":"application/json"},body:JSON.stringify(payload),
   signal:controller.signal,redirect:"error"});
  if(!r.ok)return{status:"unavailable",reason:"Trial provider returned HTTP "+r.status};
  return {status:"ok",body:await r.json()};
 }catch(error){return{status:"unavailable",reason:"Trial provider request failed: "+(error?.name==="AbortError"?"timeout":"network or response error")}}
 finally{clearTimeout(timer)}
}
async function classifyFailure(log,{key=process.env.TYPESAFE_API_KEY,fetchImpl=fetch}={}){
 const state=publicFixture(log);
 const response=await call(JEV_ENDPOINT,{model:"jev-latest",state,questions:{
  cause:{type:"choice",instructions:"Which category best describes the dominant cause of the test failure?",criteria:{
   auth:"Authentication, login, or permissions",api:"Third-party API schema, network or integration",
   database:"Persistence, schema or query",visual:"CSS, responsive layout or appearance",
   test:"Browser test selectors, assertions, fixtures or test harness",
   build:"Syntax, imports, package or bundler",other:"Does not clearly fit the other categories"}},
  human_review:{type:"noul",instructions:"Does the problem appear to require human investigation rather than repeating the same automatic fix?"}
 }} ,key,{"authorization":"Bearer "+(key||"")},fetchImpl);
 if(response.status!=="ok")return {status:"unavailable",route:"review",reason:response.reason};
 const answer=response.body?.answers?.cause,review=response.body?.answers?.human_review;
 const route=answer?.choice,confidence=answer?.confidence,probability=review?.noul;
 if(!ROUTES.includes(route)||typeof confidence!=="number"||confidence<0||confidence>1||
  typeof probability!=="number"||probability<0||probability>1)
  return{status:"unavailable",route:"review",reason:"Invalid structured provider response"};
 if(confidence<0.8||probability>=0.6)return{status:"review",route:"review",candidate:route,confidence,reviewProbability:probability};
 return{status:"classified",route,confidence,reviewProbability:probability};
}
// Never compress system instructions, security policies, or user facts without explicit
// evidence equivalence verification. Only public, reproducible tool-output fixtures.
async function compressToolOutput(context,prompt,{key=process.env.SCALEDOWN_API_KEY,fetchImpl=fetch}={}){
 const input=publicFixture(context),question=publicFixture(prompt);
 if(!input.trim()||!question.trim())throw Error("Compression requires nonempty context and question");
 const response=await call(SCALEDOWN_ENDPOINT,{context:input,prompt:question,scaledown:{rate:"auto"}},
   key,{"x-api-key":key||""},fetchImpl);
 if(response.status!=="ok")return{status:"unavailable",original:input,reason:response.reason};
 const data=response.body?.results,short=data?.compressed_prompt;
 if(data?.success!==true||typeof short!=="string"||!short.trim()||short.length>input.length)
  return{status:"unavailable",original:input,reason:"Compression failed or did not reduce size"};
 return{status:"compressed",text:short,originalLength:input.length,compressedLength:short.length,
  caution:"Informational only. Retrieve original source when exact details are required."};
}
module.exports={JEV_ENDPOINT,SCALEDOWN_ENDPOINT,ROUTES,publicFixture,classifyFailure,compressToolOutput};
