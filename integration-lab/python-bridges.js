"use strict";
// Opt-in Python interoperability probes. Never send user prompts or credentials to a
// browser automation service; Kairoq's native guarded Playwright is the default.
const {validateLocalSpec}=require('./bridges');
function localService(input){
 let u;try{u=new URL(String(input));}catch{throw Error('Invalid local service URL');}
 if(u.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.username||u.password||u.search||u.hash)
  throw Error('Only credential-free loopback HTTP service URLs are allowed');
 if(!/^\/$/.test(u.pathname))throw Error('Provide the service root only');
 return u.origin;
}
async function readJson(base,path,{fetchImpl=fetch,timeoutMs=4000}={}){
 const origin=localService(base);
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetchImpl(origin+path,{method:'GET',headers:{accept:'application/json'},redirect:'error',signal:controller.signal});
  if(!response.ok)throw Error('Local service returned HTTP '+response.status);
  const body=await response.text();if(body.length>1_000_000)throw Error('Local service response too large');
  return JSON.parse(body);
 }finally{clearTimeout(timeout)}
}
async function fastApiOpenApi(base,{fetchImpl,timeoutMs}={}){
 const spec=await readJson(base,'/openapi.json',{fetchImpl,timeoutMs});
 const result=validateLocalSpec(spec);
 return{status:'openapi-validated',title:result.spec.info?.title||'',operations:result.plan.operations.length,
  notice:'Discovery only; authentication and SDK behavior require separate sandbox tests'};
}
async function browserUseHealth(base,{fetchImpl,timeoutMs}={}){
 // A standalone user-installed Browser Use service may not expose /health.
 // Never infer that it is usable or safe from GitHub install alone.
 const body=await readJson(base,'/health',{fetchImpl,timeoutMs});
 if(body.status!=='ok'&&body.status!=='healthy')throw Error('Browser Use compatibility service did not report healthy');
 return{status:'available-for-explicit-sandbox-trial',canControlBrowser:false,
  notice:'No browsing actions performed. Kairoq native guarded browser QA remains authoritative'};
}
module.exports={localService,readJson,fastApiOpenApi,browserUseHealth};
