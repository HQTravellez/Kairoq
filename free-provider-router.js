"use strict";
// Credentialed, explicitly configured free-tier inference routes. Provider quotas apply.
// No arbitrary hosts or model IDs derived from chat messages.
const PROVIDERS=[
 {id:"gemini",key:"GEMINI_API_KEY",model:"KAIROQ_GEMINI_FREE_MODEL",fallback:"gemini-2.5-flash-lite",url:"https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"},
 {id:"groq",key:"GROQ_API_KEY",model:"KAIROQ_GROQ_FREE_MODEL",fallback:"llama-3.1-8b-instant",url:"https://api.groq.com/openai/v1/chat/completions"},
 {id:"nvidia",key:"NVIDIA_API_KEY",model:"KAIROQ_NVIDIA_FREE_MODEL",fallback:"",url:"https://integrate.api.nvidia.com/v1/chat/completions"},
 {id:"huggingface",key:"HF_TOKEN",model:"KAIROQ_HF_FREE_MODEL",fallback:"",url:"https://router.huggingface.co/v1/chat/completions"}
];
function candidates(env=process.env){
 return PROVIDERS.filter(p=>Boolean(env[p.key])&&env["KAIROQ_"+p.id.toUpperCase()+"_FREE_ENABLED"]==="true"&&Boolean(env[p.model]||p.fallback)).map(p=>({...p,selectedModel:env[p.model]||p.fallback}));
}
async function complete(messages,{env=process.env,fetchImpl=fetch,temperature=0.2,onAttempt=()=>{}}={}){
 const errors=[];
 for(const p of candidates(env)){
  onAttempt(p.id);
  try{
   const response=await fetchImpl(p.url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+env[p.key]},body:JSON.stringify({model:p.selectedModel,messages,temperature,max_tokens:1024,stream:false}),signal:AbortSignal.timeout(20000)});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error("HTTP "+response.status+" "+String(data?.error?.message||"provider unavailable").slice(0,100));
   const answer=data?.choices?.[0]?.message?.content;
   if(typeof answer!=="string"||!answer.trim())throw Error("Empty response");
   return {text:answer,provider:p.id,model:p.selectedModel};
  }catch(e){errors.push(p.id+": "+String(e.message||e).slice(0,120))}
 }
 throw Error("No configured free-tier provider succeeded"+(errors.length?": "+errors.join("; "):"; configure an authorized provider or Ollama"));
}
module.exports={PROVIDERS,candidates,complete};
