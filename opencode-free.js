"use strict";
// OpenCode legacy Zen adapter, disabled unless operator confirms third-party entitlement.\n// Current V2 docs restrict free-tier chat models to OpenCode itself; do not enable\n// this in Kairoq based solely on a Zen key or free-designated model name.
// Free-designated models are not a promise of unlimited/no-account access.
const ENDPOINT="https://opencode.ai/zen/v1/chat/completions";
const ALLOWED=new Set(["space-bunny-free","longcat-2.5-preview-free","exo-free","fledge-alpha-free","mimo-v2.6-flash-free","mimo-v2.5-free","ling-3.1-flash-free","ling-3.0-flash-fin-free","nemotron-3-ultra-free","nemotron-3.5-lightning-free"]);
function configured(env=process.env){return Boolean(env.KAIROQ_OPENCODE_ZEN_KEY)&&env.KAIROQ_OPENCODE_ZEN_FREE_ENABLED==="true"&&env.KAIROQ_OPENCODE_THIRD_PARTY_APPROVED==="true";}
function choose(env=process.env){const id=env.KAIROQ_OPENCODE_ZEN_FREE_MODEL||"space-bunny-free";if(!ALLOWED.has(id))throw Error("OpenCode model is not an approved free chat model");return id;}
async function complete(messages,{temperature=0.2,env=process.env,fetchImpl=fetch}={}){
 if(!configured(env))throw Error("OpenCode Zen free adapter is not configured");
 const model=choose(env);
 const response=await fetchImpl(ENDPOINT,{method:"POST",headers:{"Authorization":"Bearer "+env.KAIROQ_OPENCODE_ZEN_KEY,"Content-Type":"application/json"},body:JSON.stringify({model,messages,temperature,stream:false}),signal:AbortSignal.timeout(20000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error("OpenCode Zen free route unavailable ("+response.status+"): "+String(data?.error?.message||"provider error").slice(0,160));
 const answer=data?.choices?.[0]?.message?.content;
 if(typeof answer!=="string"||!answer.trim())throw Error("OpenCode Zen returned no text");
 return {text:answer,model,provider:"opencode-zen"};
}
module.exports={ENDPOINT,ALLOWED,configured,choose,complete};
