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
// Muse Spark goes to Meta's own API: it needs only META_MODEL_API_KEY (it has its own monthly cap).
function ready(env=process.env){return Boolean(env.OPENROUTER_API_KEY)&&env.KAIROQ_BUILDER_PAID_APPROVED==='true'}
function modelReady(m,env=process.env){return m.provider==='meta'?require('./muse').configured(env):ready(env)}
function named(env=process.env){
 const raw=String(env.KAIROQ_MODEL_CHOICES||'').trim();
 if(raw.toLowerCase()==='off')return[];
 return raw?parse(raw):DEFAULTS.map(m=>({...m}));
}
function list(env=process.env){
 const max=Math.max(0,...named(env).map(m=>m.credits));
 return[{id:'auto',label:'Auto',note:'Kairoq picks the model for you',enabled:true},
  ...named(env).map(m=>({...m,enabled:modelReady(m,env),costlier:m.credits>=max&&max>=10}))];
}
// The named model for a request, or null for Auto (unknown or unavailable ids mean Auto).
function pick(id,env=process.env){
 if(!id||id==='auto')return null;
 const m=named(env).find(x=>x.id===id);
 return m&&modelReady(m,env)?m:null;
}
module.exports={list,pick,named,ready,modelReady,DEFAULTS};
