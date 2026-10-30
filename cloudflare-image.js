"use strict";
// Explicit no-paid-fallback image provider for Kairoq's single-brain / separate-tools setup.
// Cloudflare Workers AI Free allocation: 10,000 Neurons/day; requests above quota fail closed.
const MODEL="@cf/black-forest-labs/flux-1-schnell";
function configured(env=process.env){return Boolean(String(env.CLOUDFLARE_ACCOUNT_ID||"").trim()&&String(env.CLOUDFLARE_API_TOKEN||"").trim());}
async function generate({prompt,aspect="16:9",signal,env=process.env,fetchImpl=fetch}={}){
 if(!configured(env))throw Error("Cloudflare image provider is not configured (CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN).");
 const account=String(env.CLOUDFLARE_ACCOUNT_ID).trim();
 if(!/^[a-zA-Z0-9_-]+$/.test(account))throw Error("Invalid Cloudflare account ID");
 const text=String(prompt||"").trim().slice(0,2048);
 if(!text)throw Error("Image prompt required");
 const url="https://api.cloudflare.com/client/v4/accounts/"+account+"/ai/run/"+MODEL;
 const timeout=AbortSignal.timeout(60000);
 const response=await fetchImpl(url,{
  method:"POST",headers:{"Authorization":"Bearer "+env.CLOUDFLARE_API_TOKEN,"Content-Type":"application/json"},
  body:JSON.stringify({prompt:text,steps:4}),signal:signal?AbortSignal.any([signal,timeout]):timeout
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.success===false){
  const errors=(data.errors||[]).map(e=>e.message||"").filter(Boolean).join("; ");
  throw Error("Cloudflare image tool failed ("+response.status+"): "+String(errors||"provider unavailable; check free allocation and token").slice(0,220));
 }
 const base64=data.result?.image||data.image;
 if(typeof base64!=="string"||!/^[A-Za-z0-9+/=]+$/.test(base64))throw Error("Cloudflare image tool returned no valid image");
 return{mime:"image/jpeg",data:base64};
}
module.exports={MODEL,configured,generate};
