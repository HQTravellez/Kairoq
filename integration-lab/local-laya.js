"use strict";
// Isolated self-hosted Laya trial: no TypeSafe API and no hosted ScaleDown calls.
// No production code imports this file; never grants execution or publishing rights.
const {RULES,HANDLERS,sanitizedState,isSensitiveAction}=require("./decision-models");
const {performance}=require("node:perf_hooks");
const DEFAULT_PORT=8000;
const DEFAULT_THRESHOLD=0.8; // provisional until evaluated on labelled Kairoq decisions
const QUESTION=Object.freeze({
 type:"choice",
 instructions:"Choose the ONE Kairoq specialist for this task, without executing actions or granting permissions.",
 criteria:RULES
});
function portNumber(port=DEFAULT_PORT){
 if(!/^[0-9]{1,5}$/.test(String(port)))throw Error("Invalid local Laya port");
 const n=Number(port);
 if(!Number.isSafeInteger(n)||n<1||n>65535)throw Error("Invalid local Laya port");
 return n;
}
function layaEndpoint(port=DEFAULT_PORT){return "http://127.0.0.1:"+portNumber(port)+"/v1/systemone"}
function score(x){return typeof x==="number"&&Number.isFinite(x)&&x>=0&&x<=1?x:null}
function parseLaya(result,{threshold=DEFAULT_THRESHOLD}={}){
 if(!Number.isFinite(threshold)||threshold<0||threshold>1)throw Error("Threshold must be 0-1");
 const answer=result?.answers?.route;
 if(!answer||answer.type!=="choice"||!Object.hasOwn(HANDLERS,answer.choice))
  return{status:"fallback",reason:"Invalid Laya answer or handler"};
 const answerConfidence=score(answer.answer_confidence);
 const chosen=score(answer.probabilities?.[answer.choice]);
 const confidence=answerConfidence??chosen; // never use entropy-based answer.confidence
 if(confidence===null)return{status:"review",reason:"Laya answer probability unavailable"};
 if(confidence<threshold||answer.low_confidence||answer.abstention==="abstained")
  return{status:"review",candidate:answer.choice,confidence,reason:"Below provisional answer-confidence gate"};
 return{status:"routed",route:answer.choice,handler:HANDLERS[answer.choice],confidence};
}
async function routeLocal(state,{
 action="",port=DEFAULT_PORT,threshold=DEFAULT_THRESHOLD,fetchImpl=globalThis.fetch,
 timeoutMs=20000,authKey=process.env.LAYA_API_KEY
}={}){
 sanitizedState(state);
 if(isSensitiveAction(action))return{status:"review",reason:"Sensitive actions require existing Kairoq approval"};
 const url=layaEndpoint(port);
 if(typeof fetchImpl!=="function")throw Error("fetch required");
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>120000)throw Error("Invalid timeout");
 const started=performance.now(),controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const res=await fetchImpl(url,{method:"POST",redirect:"error",signal:controller.signal,
   headers:{"content-type":"application/json",...(authKey?{authorization:"Bearer "+authKey}:{})},
   body:JSON.stringify({state:typeof state==="string"?state:JSON.stringify(state),model:"english",questions:{route:QUESTION}})});
  if(!res.ok)return{status:"unavailable",reason:"Local Laya HTTP "+res.status,elapsedMs:performance.now()-started};
  // Reject oversized responses before JSON parsing; do not reflect raw model output.
  const content=await res.text();
  if(content.length>64000)throw Error("Oversized Laya response");
  return{...parseLaya(JSON.parse(content),{threshold}),provider:"laya-local",
   elapsedMs:performance.now()-started,
   inputTokens:JSON.parse(content)?.usage?.input_tokens??null};
 }catch(e){
  return{status:"unavailable",reason:"Local Laya offline or invalid response",elapsedMs:performance.now()-started};
 }finally{clearTimeout(timer)}
}
module.exports={layaEndpoint,parseLaya,routeLocal,QUESTION,DEFAULT_THRESHOLD};
