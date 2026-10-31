"use strict";
// One public-web transport for Kairoq research. It follows ordinary HTTPS redirects while
// re-validating every destination at connect time, so website reading does not depend on the LLM
// knowing a "final URL" and redirects cannot hop into a private network.
const https=require("https"),net=require("net");
const {guardedLookup}=require("./react-functions");
const REDIRECTS=new Set([301,302,303,307,308]);
const SENSITIVE=/^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)$/i;

function publicUrl(raw){
 const u=new URL(String(raw||"").trim());
 const h=u.hostname.replace(/^\[|\]$/g,"").toLowerCase();
 if(u.protocol!=="https:")throw Object.assign(Error("Only public HTTPS websites are supported."),{status:400});
 if(u.username||u.password)throw Object.assign(Error("Credentials in website URLs are not allowed."),{status:400});
 if(u.port&&u.port!=="443")throw Object.assign(Error("Public website URLs must use HTTPS port 443."),{status:400});
 if(!h||h==="localhost"||h.endsWith(".localhost")||h.endsWith(".local")||h.endsWith(".internal")||!h.includes(".")||net.isIP(h))
  throw Object.assign(Error("Private or direct-IP website destinations are blocked."),{status:400});
 u.hash="";
 return u;
}
function cleanHeaders(headers={}){
 const out={};
 for(const [k,v] of Object.entries(headers||{})){
  if(SENSITIVE.test(k))continue;
  if(/^[A-Za-z0-9-]{1,64}$/.test(k))out[k]=String(v).slice(0,4000);
 }
 if(!Object.keys(out).some(k=>k.toLowerCase()==="user-agent"))out["User-Agent"]="KairoqPublicWeb/1.0";
 return out;
}
function one(u,{headers,timeoutMs,maxBytes,requestImpl=https.request,lookup=guardedLookup}){
 return new Promise((resolve,reject)=>{
  const req=requestImpl(u,{method:"GET",headers,lookup,timeout:timeoutMs,agent:false,maxHeaderSize:16384},res=>{
   const status=Number(res.statusCode)||0,location=res.headers.location||"";
   if(REDIRECTS.has(status)&&location){res.resume();return resolve({status,location,headers:res.headers,body:""})}
   const parts=[];let bytes=0,done=false;
   const fail=e=>{if(done)return;done=true;req.destroy();reject(e)};
   res.on("data",part=>{
    if(done)return;
    bytes+=part.length;
    if(bytes>maxBytes)return fail(Object.assign(Error("Website response is larger than "+Math.round(maxBytes/1024)+" KB."),{status:413}));
    parts.push(part);
   });
   res.on("end",()=>{if(done)return;done=true;resolve({status,location:"",headers:res.headers,body:Buffer.concat(parts).toString("utf8")})});
   res.on("error",fail);
  });
  req.on("timeout",()=>req.destroy(Object.assign(Error("Website request timed out."),{status:504})));
  req.on("error",e=>{
   if(e.code==="EBLOCKED")return reject(Object.assign(Error("Private network destinations are blocked."),{status:400}));
   reject(e);
  });
  req.end();
 });
}
async function fetchPublic(raw,{maxRedirects=5,timeoutMs=15000,maxBytes=2*1024*1024,headers={},accept="text/html,application/xhtml+xml,application/json,text/plain,text/markdown",allowHost,requestImpl=https.request,lookup=guardedLookup}={}){
 let current=publicUrl(raw),requestHeaders=cleanHeaders({...headers,Accept:headers.Accept||headers.accept||accept});
 const seen=new Set(),redirects=[];
 for(let hop=0;hop<=maxRedirects;hop++){
  if(seen.has(current.href))throw Object.assign(Error("Website redirect loop detected."),{status:508});
  seen.add(current.href);
  if(typeof allowHost==="function")await allowHost(current);
  const response=await one(current,{headers:requestHeaders,timeoutMs,maxBytes,requestImpl,lookup});
  if(REDIRECTS.has(response.status)&&response.location){
   if(hop>=maxRedirects)throw Object.assign(Error("Website redirected too many times."),{status:508});
   let next;try{next=publicUrl(new URL(response.location,current).href)}catch(e){throw Object.assign(Error("Website redirected to an unsafe destination: "+e.message),{status:e.status||400})}
   redirects.push({status:response.status,from:current.href,to:next.href});
   // This reader is intentionally anonymous. Never forward credentials/cookies between hops.
   requestHeaders=cleanHeaders(requestHeaders);
   current=next;continue;
  }
  const outHeaders={};for(const [k,v] of Object.entries(response.headers||{}))outHeaders[k]=Array.isArray(v)?v.join(", "):String(v??"");
  return{url:current.href,status:response.status,headers:outHeaders,body:response.body,redirects};
 }
 throw Object.assign(Error("Website redirected too many times."),{status:508});
}
module.exports={publicUrl,fetchPublic,cleanHeaders,REDIRECTS};
