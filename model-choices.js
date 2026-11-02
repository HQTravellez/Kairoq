'use strict';
// The models an owner can pick in the builder's chat box. "Auto" is the default builder
// (Experiential Labs when its key is set); a named model sends that one message through
// OpenRouter, and falls back to Auto when it cannot run.
//
// KAIROQ_MODEL_CHOICES replaces the list: entries separated by ";", each
//   openrouter/model-id=Label:credits
// e.g. "anthropic/claude-opus-5.5=Claude Opus 5.5:10;deepseek/deepseek-v3.2=DeepSeek V3.2:2".
// Set it to "off" to show Auto only.
const DEFAULTS=[
 {id:'anthropic/claude-fable-5.1',label:'Claude Fable 5.1',credits:15,note:'Highest intelligence, best for whole apps and hard fixes',top:true},
 {id:'anthropic/claude-opus-5.5',label:'Claude Opus 5.5',credits:10,note:'Very strong at code and design'},
 {id:'anthropic/claude-sonnet-5.5',label:'Claude Sonnet 5.5',credits:5,note:'Fast and capable for most changes'},
 {id:'openai/gpt-6',label:'GPT-6',credits:5,note:'OpenAI\'s strongest model'},
 {id:'meta/muse-spark',label:'Muse Spark',credits:3,note:'Meta\'s model: strong at code, reads screenshots, low cost',provider:'meta'},
 {id:'deepseek/deepseek-v3.2',label:'DeepSeek V3.2',credits:2,note:'Low cost, good for small edits'}
];
const NOTES=Object.fromEntries(DEFAULTS.map(m=>[m.id,m]));

function parse(raw){
 return String(raw).split(';').map(s=>s.trim()).filter(Boolean).map(entry=>{
  const eq=entry.indexOf('=');if(eq<1)return null;
  const id=entry.slice(0,eq).trim(),rest=entry.slice(eq+1),colon=rest.lastIndexOf(':');
  const label=(colon>0?rest.slice(0,colon):rest).trim()||id,credits=colon>0?Math.max(1,parseInt(rest.slice(colon+1),10)||1):5;
  if(!/^[\w.-]+\/[\w.:-]+$/.test(id))return null;
  const known=NOTES[id];
  return{id,label,credits,note:known?known.note:'',top:Boolean(known&&known.top),...(known&&known.provider?{provider:known.provider}:{})};
 }).filter(Boolean);
}
// Named models need OpenRouter and paid builds switched on; without them they are listed but off.
// Claude models can instead go straight to Anthropic (ANTHROPIC_API_KEY, see anthropic.js).
// Muse Spark goes to Meta's own API: it needs only META_MODEL_API_KEY (it has its own monthly cap).
function ready(env=process.env){return Boolean(env.OPENROUTER_API_KEY)&&env.KAIROQ_BUILDER_PAID_APPROVED==='true'}
function modelReady(m,env=process.env){
 if(m.provider==='meta')return require('./muse').configured(env);
 const a=require('./anthropic');
 if(a.isClaude(m.id)&&a.configured(env))return env.KAIROQ_BUILDER_PAID_APPROVED==='true';
 return ready(env);
}
function named(env=process.env){
 const raw=String(env.KAIROQ_MODEL_CHOICES||'').trim();
 if(raw.toLowerCase()==='off')return[];
 return raw?parse(raw):DEFAULTS.map(m=>({...m}));
}
function list(env=process.env){
 const max=Math.max(0,...named(env).map(m=>m.credits));
 return[{id:'auto',label:'Auto',note:'Kairoq picks the model for you',enabled:true},
  ...named(env).map(m=>({...m,enabled:modelReady(m,env),costlier:m.credits>=max&&max>=10,provider:m.provider||providerOf(m.id)}))];
}
// The free models (the free pool and OpenRouter's ":free" models), as the server's catalogue lists
// them (server.js getModels). Kept here so a pick can be checked without another fetch.
const PROVIDERS={anthropic:'Anthropic',openai:'OpenAI',google:'Google',meta:'Meta','meta-llama':'Meta',deepseek:'DeepSeek',mistralai:'Mistral',mistral:'Mistral',qwen:'Qwen',nvidia:'NVIDIA',microsoft:'Microsoft','x-ai':'xAI',xai:'xAI',cohere:'Cohere',perplexity:'Perplexity',amazon:'Amazon',moonshotai:'Moonshot',moonshot:'Moonshot','z-ai':'Z.ai',zai:'Z.ai',minimax:'MiniMax',baidu:'Baidu',tencent:'Tencent',bytedance:'ByteDance',ai21:'AI21',inception:'Inception',liquid:'Liquid',nousresearch:'Nous',arcee:'Arcee',openrouter:'OpenRouter',freellm:'Free pool',local:'Local'};
function providerOf(id){
 const head=String(id||'').split('/')[0].toLowerCase();
 if(head==='freellm'||head==='local'){const rest=String(id||'').split('/').slice(1).join('/');const inner=rest.includes('/')?rest.split('/')[0].toLowerCase():'';return{key:inner||head,name:PROVIDERS[inner]||(inner?inner.charAt(0).toUpperCase()+inner.slice(1):PROVIDERS[head])}}
 return{key:head,name:PROVIDERS[head]||(head?head.charAt(0).toUpperCase()+head.slice(1):'')};
}
let freeCatalog=[];
function remember(models){
 const seen=new Set();
 freeCatalog=(Array.isArray(models)?models:[]).filter(m=>m&&m.id&&m.isFree&&!seen.has(m.id)&&seen.add(m.id)).map(m=>{
  const id=String(m.id),p=providerOf(id),ctx=Number(m.context_length)||0;
  const label=String(m.name||id).replace(/\s*·.*$/,'').replace(/\s*\((free)\)\s*$/i,'').replace(/:free$/,'').trim()||id;
  return{id,label,credits:0,free:true,enabled:true,provider:p,note:[p.name,ctx?Math.round(ctx/1000)+'k context':'',m.supportsVision?'reads images':''].filter(Boolean).join(' · '),source:m.source||''};
 });
 return freeCatalog;
}
function free(){return freeCatalog.slice()}
// A free catalogue id runs at no credits: ":free" OpenRouter models need the OpenRouter key; the
// free pool's models need the pool; a local model needs the local server.
function freeReady(m,env=process.env){
 if(/^freellm\//.test(m.id))return require('./freellmapi').enabled(env);
 if(/^local\//.test(m.id))return true;
 return Boolean(env.OPENROUTER_API_KEY);
}
// The named model for a request, or null for Auto (unknown or unavailable ids mean Auto).
function pick(id,env=process.env){
 if(!id||id==='auto')return null;
 const m=named(env).find(x=>x.id===id);
 if(m)return modelReady(m,env)?m:null;
 const f=freeCatalog.find(x=>x.id===id);
 return f&&freeReady(f,env)?f:null;
}
module.exports={list,pick,named,ready,modelReady,DEFAULTS,providerOf,remember,free,freeReady};
