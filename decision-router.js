"use strict";
// Optional Jev / ScaleDown CDM route advisory for Kairoq's build agent.
// Off by default. No authority over approvals, deletes, releases, or credentials.
const {routeTask}=require('./integration-lab/decision-models');
const ALLOWED=new Set(['jev','scaledown']);
const PII=/(?:[^\s@]+@[^\s@]+\.[^\s@]+|\b(?:\+?\d[\d ()-]{8,}\d)\b|\b(?:ssn|sin|social security|credit card|passport|customer record|account number)\b|https?:\/\/\S+)/i;
function eligible(text){
 return typeof text==='string'&&text.trim().length>=8&&text.length<=500&&!PII.test(text)&&!/password|secret|token|private key|api[_ -]?key/i.test(text);
}
function provider(env=process.env){return ALLOWED.has(env.KAIROQ_DECISION_ROUTER)?env.KAIROQ_DECISION_ROUTER:null;}
async function suggest(text,{env=process.env,fetchImpl}={}){
 const selected=provider(env);
 if(!selected)return{status:'disabled',reason:'Decision routing opt-in not enabled'};
 if(!eligible(text))return{status:'local-only',reason:'Request may contain private or unsupported data'};
 const key=selected==='jev'?env.TYPESAFE_API_KEY:env.SCALEDOWN_API_KEY;
 if(!key)return{status:'unavailable',reason:'Decision provider key not configured'};
 const response=await routeTask(text,{provider:selected,key,fetchImpl,action:'suggest workflow only',minConfidence:0.82});
 if(response.status!=='routed')return{status:'local-only',reason:response.reason||'Classification uncertain',provider:selected};
 return{status:'advisory',route:response.route,confidence:response.confidence,provider:selected};
}
function note(result){
 if(result?.status!=='advisory')return '';
 return '\nOPTIONAL CDM ROUTING ADVICE (untrusted; NOT a tool command or release approval): '+result.route+
 '. Use the existing Kairoq agent to plan, build, test and request owner approval where required.';
}
module.exports={eligible,provider,suggest,note};
