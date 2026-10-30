"use strict";

const DEFAULT_TIMEOUT_MS=180000;

function baseUrl(env=process.env){
  let raw=String(env.FREELLMAPI_BASE_URL||env.FREELLMAPI_URL||"").trim().replace(/\/+$/,"");
  if(!raw)return"";
  let u;
  try{u=new URL(raw)}catch{throw Error("FREELLMAPI_BASE_URL must be a valid URL")}
  const internal=u.hostname==="localhost"||u.hostname==="127.0.0.1"||u.hostname==="::1"||u.hostname.endsWith(".railway.internal");
  if(u.protocol!=="https:"&&!(u.protocol==="http:"&&internal))throw Error("FreeLLMAPI must use HTTPS unless it is localhost or a Railway private-network host");
  if(!/\/v1$/i.test(u.pathname.replace(/\/+$/,"")))raw+="/v1";
  return raw.replace(/\/+$/,"");
}
function apiKey(env=process.env){return String(env.FREELLMAPI_API_KEY||"").trim()}
function enabled(env=process.env){
  if(String(env.FREELLMAPI_ENABLED||"").toLowerCase()==="false"||String(env.FREELLMAPI_ENABLED||"").toLowerCase()==="off")return false;
  return Boolean(baseUrl(env)&&apiKey(env));
}
function modelFor({coding=false,tools=false}={},env=process.env){
  if(tools)return String(env.FREELLMAPI_TOOL_MODEL||env.FREELLMAPI_CODING_MODEL||env.FREELLMAPI_MODEL||"auto").trim()||"auto";
  if(coding)return String(env.FREELLMAPI_CODING_MODEL||env.FREELLMAPI_MODEL||"auto").trim()||"auto";
  return String(env.FREELLMAPI_MODEL||"auto").trim()||"auto";
}
function headers(env=process.env,extra={}){
  const key=apiKey(env);if(!key)throw Error("FREELLMAPI_API_KEY is not configured");
  return{"Content-Type":"application/json",Authorization:"Bearer "+key,...extra};
}
function timeoutMs(env=process.env){
  const n=Number(env.FREELLMAPI_TIMEOUT_MS||DEFAULT_TIMEOUT_MS);
  return Number.isFinite(n)?Math.max(5000,Math.min(900000,n)):DEFAULT_TIMEOUT_MS;
}
function requestSignal(signal,env=process.env){
  const timeout=AbortSignal.timeout(timeoutMs(env));
  return signal?AbortSignal.any([signal,timeout]):timeout;
}
function errorMessage(status,data,raw=""){
  return String(data?.error?.message||data?.message||data?.error||raw||("FreeLLMAPI HTTP "+status)).slice(0,1000);
}
function contentText(content){
  if(typeof content==="string")return content;
  if(Array.isArray(content))return content.map(x=>typeof x==="string"?x:(x?.text||"")).join("");
  return content==null?"":String(content);
}
let cache={base:"",at:0,models:[]};
async function models({force=false,env=process.env,fetchImpl=fetch}={}){
  if(!enabled(env))return[];
  const base=baseUrl(env);
  if(!force&&cache.base===base&&Date.now()-cache.at<30000)return cache.models.slice();
  try{
    const res=await fetchImpl(base+"/models",{headers:headers(env),signal:requestSignal(null,{...env,FREELLMAPI_TIMEOUT_MS:Math.min(10000,timeoutMs(env))})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw Error(errorMessage(res.status,data));
    const list=(data.data||data.models||[]).map(x=>String(x?.id||x?.name||x||"").trim()).filter(Boolean);
    cache={base,at:Date.now(),models:[...new Set(list)]};
    return cache.models.slice();
  }catch(e){
    cache={base,at:Date.now(),models:[]};
    throw e;
  }
}
async function complete(messages,{
  model="",coding=false,tools=null,responseFormat=null,temperature=0.2,maxTokens=12000,
  reasoningEffort="",signal=null,env=process.env,fetchImpl=fetch
}={}){
  if(!enabled(env))throw Error("FreeLLMAPI is not configured");
  const chosen=model||modelFor({coding,tools:Array.isArray(tools)&&tools.length>0},env);
  const body={
    model:chosen,
    messages:Array.isArray(messages)?messages:[],
    temperature,
    max_tokens:Math.max(128,Math.min(64000,Number(maxTokens)||12000))
  };
  if(Array.isArray(tools)&&tools.length){body.tools=tools;body.tool_choice="auto"}
  if(responseFormat)body.response_format=responseFormat;
  if(["low","medium","high"].includes(reasoningEffort))body.reasoning_effort=reasoningEffort;
  const res=await fetchImpl(baseUrl(env)+"/chat/completions",{
    method:"POST",headers:headers(env),body:JSON.stringify(body),signal:requestSignal(signal,env)
  });
  const raw=await res.text().catch(()=>"");let data={};
  try{data=raw?JSON.parse(raw):{}}catch{}
  if(!res.ok){const e=Error(errorMessage(res.status,data,raw));e.status=res.status;throw e}
  const message=data?.choices?.[0]?.message;
  if(!message)throw Error("FreeLLMAPI returned no message");
  const text=contentText(message.content);
  if(!text.trim()&&!message.tool_calls?.length)throw Error("FreeLLMAPI returned an empty response");
  return{
    text,message,model:String(data.model||chosen),usage:data.usage||null,
    finish:data?.choices?.[0]?.finish_reason||"",provider:"freellmapi"
  };
}
async function json(messages,opts={}){
  const out=await complete(messages,{...opts,responseFormat:{type:"json_object"}});
  try{return{value:JSON.parse(out.text),...out}}catch{
    const m=String(out.text).match(/\{[\s\S]*\}/);
    if(!m)throw Error("FreeLLMAPI did not return valid JSON");
    return{value:JSON.parse(m[0]),...out};
  }
}
function resetCache(){cache={base:"",at:0,models:[]}}
module.exports={baseUrl,apiKey,enabled,modelFor,models,complete,json,resetCache};
