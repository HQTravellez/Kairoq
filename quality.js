"use strict";
// One Railway variable for the best builds: KAIROQ_QUALITY=top. It fills in the model settings
// that are not set yet, so every step uses a top model:
// - Claude Sonnet 5.5 writes and edits the code (Standard), Claude Opus 5.5 on Pro and Max,
// - Claude Opus 5.5 writes the design brief and reviews the screenshots (craft check, polish),
// - the build engine is the agent (OpenCode with Kairoq's check tool), when it is installed,
// - the cheaper shortcuts (the fast Ollama model, Muse, Experiential Labs) are skipped for builds.
// A variable Ka set himself always wins. Paid builds still need KAIROQ_BUILDER_PAID_APPROVED=true,
// and the spending caps (DAILY_COST_LIMIT_USD, MONTHLY_COST_LIMIT_USD,
// KAIROQ_BUILDER_MONTHLY_LIMIT_USD) stay his decision: this file never changes them.
const SONNET='anthropic/claude-sonnet-5.5',OPUS='anthropic/claude-opus-5.5';
const TOP={
 KAIROQ_BUILDER_MODE:'paid-first',
 KAIROQ_BUILDER_PROVIDER:'openrouter',
 KAIROQ_BUILDER_FAST:'off',
 KAIROQ_BUILDER_MODEL:SONNET,
 KAIROQ_BUILDER_FALLBACK_MODEL:OPUS,
 KAIROQ_FAST_MODELS:SONNET,
 KAIROQ_PRO_MODELS:OPUS+','+SONNET,
 KAIROQ_MAX_MODELS:OPUS,
 KAIROQ_VISION_MODELS:SONNET+','+OPUS,
 KAIROQ_DESIGN_MODELS:OPUS,
 KAIROQ_LOOK_MODELS:OPUS+','+SONNET,
 KAIROQ_OPENCODE_MODEL:SONNET,
 KAIROQ_BUILD_ENGINE:'opencode',
};
function top(env=process.env){return String(env.KAIROQ_QUALITY||'').trim().toLowerCase()==='top'}
// Fills in the unset variables; returns their names (logged once at start).
function apply(env=process.env){
 if(!top(env))return[];
 const set=[];
 for(const [k,v] of Object.entries(TOP))if(!String(env[k]??'').trim()){env[k]=v;set.push(k)}
 return set;
}
// A short name people know: "anthropic/claude-sonnet-5.5" -> "Claude Sonnet 5.5".
function label(model){
 const id=String(model||'').trim();if(!id)return'';
 if(id==='openrouter/free')return'a free model';
 const free=/:free$/.test(id),name=id.replace(/:[a-z]+$/,'').split('/').pop().replace(/-/g,' ').replace(/\b([a-z])/g,c=>c.toUpperCase()).replace(/\bGpt\b/,'GPT').replace(/\bAi\b/,'AI');
 return name+(free?' (free)':'');
}
// A model below the standard Ka asked for: a free model, or (with KAIROQ_QUALITY=top) any model
// that is not one of the top ones.
function cheap(model,env=process.env){
 const id=String(model||'');if(!id)return false;
 if(id==='openrouter/free'||/:free$/.test(id))return true;
 if(top(env)){const good=new Set([SONNET,OPUS,...String(env.KAIROQ_BUILDER_MODEL||'').split(','),...String(env.KAIROQ_PRO_MODELS||'').split(','),...String(env.KAIROQ_MAX_MODELS||'').split(','),...String(env.KAIROQ_OPENCODE_MODEL||'').split(',')].map(s=>s.trim()).filter(Boolean));return!good.has(id)}
 return false;
}
// What the owner sees under a build: which model wrote it, and a warning when it was a cheaper one.
function builtBy({engine,model,fallback}={},env=process.env){
 if(!model)return null;
 const low=cheap(model,env);
 return{engine:engine||'kairoq',model:String(model),label:label(model),agent:engine==='opencode',...(low?{cheap:true}:{}),...(fallback?{fallback:true}:{})};
}
module.exports={TOP,SONNET,OPUS,top,apply,label,cheap,builtBy};
