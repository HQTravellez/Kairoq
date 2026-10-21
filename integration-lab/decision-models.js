"use strict";
// Optional Jev + ScaleDown trial. Not imported by live Kairoq code.
// Official Jev API: https://docs.typesafe.ai/introduction/quickstart
// ScaleDown endpoints: https://docs.scaledown.ai/
// No arbitrary URL, shell or credentials in generated applications.
const ENDPOINTS=Object.freeze({
  jev:"https://api.typesafe.ai/v1/systemone",
  scaledown:"https://api.scaledown.xyz/v1/scaledown",
  compress:"https://api.scaledown.xyz/compress/raw/"
});
const HANDLERS=Object.freeze({
  coding:"Kairoq/OpenCode writes application code",
  api:"Existing Kairoq API analyzer and adapter",
  design:"Kairoq visual editor and design review",
  qa:"Kairoq isolated browser and regression checks",
  discussion:"Kairoq Discuss mode"
});
const RULES=Object.freeze({
  coding:"Requests to write, change or repair application source files",
  api:"Requests that require learning API documentation, schemas, auth or SDKs",
  design:"Requests about visual design, appearance, responsive layout or visual edits",
  qa:"Requests to test, reproduce, benchmark or verify app behavior",
  discussion:"Requests to explain, discuss or plan without editing source"
});
function sanitizedState(value){
  if(typeof value!=="string"&&(!value||typeof value!=="object"||Array.isArray(value)))throw Error("Expected an explicit text or object state");
  const encoded=typeof value==="string"?value:JSON.stringify(value);
  if(!encoded.trim()||Buffer.byteLength(encoded)>24000)throw Error("Decision state must contain 1–24000 UTF-8 bytes");
  return value;
}
function isSensitiveAction(action){
  return /(^|[\s_-])(delete|deploy|publish|charge|payment|refund|send|email|outreach|oauth|permission|billing|secret|credential|production|database.?drop|transfer)([\s_-]|$)/i.test(String(action||""));
}
function probability(value){
  return typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=1?value:null;
}
function parseRouting(response,minConfidence=0.82){
  const a=response?.answers?.route;
  const permitted=Object.keys(HANDLERS);
  if(a?.type!=="choice"||!permitted.includes(a.choice))return{status:"fallback",reason:"Invalid or unexpected typed answer"};
  const confidence=probability(a.confidence);
  const selected=probability(a.probabilities?.[a.choice]);
  if(confidence===null||selected===null||confidence<minConfidence||selected<minConfidence)
    return{status:"review",reason:"Low-confidence decision",confidence,probability:selected};
  return{status:"routed",route:a.choice,handler:HANDLERS[a.choice],confidence,probability:selected};
}
async function requestJson(url,key,payload,{fetchImpl=globalThis.fetch,timeoutMs=7000,scaledown=false}={}){
  if(typeof fetchImpl!=="function")throw Error("fetch implementation missing");
  if(typeof key!=="string"||!key.trim())return{status:"unavailable",reason:"Decision API key not configured"};
  // URL is always chosen by this module; never trust an external document as an endpoint.
  if(!Object.values(ENDPOINTS).includes(url))throw Error("Untrusted decision endpoint");
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const result=await fetchImpl(url,{
      method:"POST",
      headers:{"Content-Type":"application/json",...(scaledown?{"x-api-key":key}:{Authorization:"Bearer "+key})},
      body:JSON.stringify(payload),redirect:"error",signal:controller.signal
    });
    if(!result.ok)throw Error("Decision provider HTTP "+result.status);
    const txt=await result.text();
    if(txt.length>256000)throw Error("Decision provider response exceeds limit");
    return JSON.parse(txt);
  }finally{clearTimeout(timer)}
}
async function routeTask(state,{
  provider="jev",key,fetchImpl,minConfidence=0.82,timeoutMs=7000,action=""
}={}){
  sanitizedState(state);
  if(isSensitiveAction(action))return{status:"review",reason:"High-impact action always requires existing Kairoq approval"};
  if(!["jev","scaledown"].includes(provider))throw Error("Unknown decision provider");
  if(!Number.isFinite(minConfidence)||minConfidence<0.6||minConfidence>1)throw Error("Invalid confidence threshold");
  const credential=key||(provider==="jev"?process.env.TYPESAFE_API_KEY:process.env.SCALEDOWN_API_KEY);
  const payload={state:typeof state==="string"?state:JSON.stringify(state),
    model:provider==="jev"?"jev-1.13.0":"classify-1",
    questions:{route:{type:"choice",instructions:"Choose the ONE Kairoq specialist needed for this request. Never grant permissions or execute actions.",criteria:RULES}}};
  try{
    const response=await requestJson(ENDPOINTS[provider],credential,payload,{fetchImpl,timeoutMs,scaledown:provider==="scaledown"});
    if(response.status==="unavailable")return response;
    return{...parseRouting(response,minConfidence),provider};
  }catch(error){
    return{status:"fallback",reason:"Provider unavailable or malformed response",provider,
      detail:String(error?.message||error).slice(0,140)};
  }
}
function parseCompressed(text,original){
  const x=text?.results?.compressed_prompt??text?.compressed_prompt;
  if(typeof x!=="string"||!x.trim())return{status:"fallback",content:original,reason:"Invalid compressed content"};
  // Compression is optional context; caller retains the source for subsequent re-read.
  if(x.length>=original.length)return{status:"unchanged",content:original,reason:"Compression did not reduce text"};
  return{status:"compressed",content:x,originalLength:original.length,compressedLength:x.length};
}
async function compressToolResult(original,question,{
  key=process.env.SCALEDOWN_API_KEY,fetchImpl,timeoutMs=7000,minChars=4000
}={}){
  if(typeof original!=="string"||typeof question!=="string")throw Error("Text result and query required");
  if(original.length>200000||question.length>1000)throw Error("Compression input too large");
  if(original.length<minChars)return{status:"unchanged",content:original,reason:"Below compression threshold"};
  try{
    const result=await requestJson(ENDPOINTS.compress,key,{
      context:original,prompt:question,compression_rate:"auto"
    },{fetchImpl,timeoutMs,scaledown:true});
    if(result.status==="unavailable")return{...result,content:original};
    return parseCompressed(result,original);
  }catch(error){return{status:"fallback",content:original,reason:"Compression service unavailable"}}
}
module.exports={ENDPOINTS,HANDLERS,RULES,sanitizedState,isSensitiveAction,parseRouting,routeTask,compressToolResult,parseCompressed};
