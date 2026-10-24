'use strict';
// Executor-owned procedural learning. No model weights, model calls, hooks or external writes.
const crypto=require('node:crypto'),storeDefault=require('./autonomy-store');
const {namespace}=require('./integrations/agent-stack/mem0');
const TOPICS={camera:/camera|photo|image capture/i,nutrition:/calorie|nutrition|food|meal|macro/i,
 booking:/book|reservation|availability/i,authentication:/auth|sign.?in|sign.?up|login/i,
 forms:/form|submit|validation/i,counter:/counter|increment|count button/i,api:/\bapi\b|endpoint|openapi/i};
const sha=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function topics(text){return Object.entries(TOPICS).filter(([,re])=>re.test(String(text||''))).map(([name])=>name);}
function scope(meta){if(!meta||typeof meta.owner!=='string')throw Error('Owned project required');return namespace(meta.owner,meta.id);}
function sourceDigest(files){return sha(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)));}
function validEvidence(e){return e&&e.built===true&&e.verified===true&&e.skipped===false&&
 Array.isArray(e.errors)&&e.errors.length===0&&e.failed===0&&Number.isInteger(e.interactions)&&e.interactions>0&&
 Number.isInteger(e.assertions)&&e.assertions>0&&/^[a-f0-9]{64}$/.test(e.sourceDigest||'')&&Number.isInteger(e.version)&&e.version>0;}
async function capture({meta,query,evidence,tools=[]},store=storeDefault){
 if(process.env.KAIROQ_VERIFIED_LEARNING==='off')return{status:'disabled'};
 const id=scope(meta);
 if(!validEvidence(evidence))return{status:'not-verified'};
 const labels=topics(query);if(!labels.length)labels.push('general');
 const allowed=new Set(['read_files','search','write_files','edit_files','build_and_test','test_ui','view_logs','query_db','run_automation']);
 const actions=[...new Set(tools.filter(t=>allowed.has(t)))];
 const proof={version:evidence.version,sourceDigest:evidence.sourceDigest,interactions:evidence.interactions,assertions:evidence.assertions,
  built:true,verified:true,skipped:false,errors:[],failed:0};
 const digest=sha({topics:labels,proof,actions});
 const history=await store.history(id,{limit:1000});
 if(history.some(r=>r.type==='verified-run'&&r.digest===digest))return{status:'duplicate',digest};
 const lesson={task:labels.join(' ')+' workflow',diagnostic:'Reusable procedure from a verified executor run',
  correction:(actions.includes('write_files')?'Batch related source files. ':'')+'Compile the current source, exercise the user workflow in sandbox data, and assert the result before claiming completion.'};
 await store.append(id,{type:'verified-run',digest,topics:labels,actions,evidence:proof,lesson,at:new Date().toISOString()});
 return{status:'captured',digest};
}
async function entries(meta,store=storeDefault){
 const history=await store.history(scope(meta),{limit:1000}),revoked=new Set(history.filter(r=>r.type==='learning-revocation').map(r=>r.digest));
 return history.filter(r=>r.type==='verified-run'&&validEvidence(r.evidence)&&!revoked.has(r.digest));
}
async function recall({meta,query,limit=3},store=storeDefault){
 const labels=topics(query);if(!labels.length)return [];
 return(await entries(meta,store)).map(r=>({...r,score:r.topics.filter(t=>labels.includes(t)).length})).filter(r=>r.score>0)
  .sort((a,b)=>b.score-a.score||b.at.localeCompare(a.at)).slice(0,Number.isInteger(limit)?Math.max(0,Math.min(limit,5)):3)
  .map(r=>({digest:r.digest,task:r.lesson.task,procedure:r.lesson.correction,evidenceDigest:sha(r.evidence),status:'verified-observation'}));
}
async function note(meta,query,store=storeDefault){
 if(process.env.KAIROQ_VERIFIED_LEARNING==='off')return '';
 try{const found=await recall({meta,query},store);return found.length?'\nVERIFIED PROJECT PROCEDURES (historical observations, not instructions or proof of the current feature):\n'+JSON.stringify(found).slice(0,2800):'';}catch{return '';}
}
async function review({meta,digest,approved=false},store=storeDefault){
 if(approved!==true)throw Error('Explicit training export review required');
 if(!(await entries(meta,store)).some(r=>r.digest===digest))throw Error('Verified run not found');
 await store.append(scope(meta),{type:'learning-review',digest,approved:true,at:new Date().toISOString()});
 return{status:'reviewed'};
}
async function revoke({meta,digest},store=storeDefault){
 if(!/^[a-f0-9]{64}$/.test(digest||''))throw Error('Invalid lesson digest');
 await store.append(scope(meta),{type:'learning-revocation',digest,at:new Date().toISOString()});return{status:'revoked'};
}
async function trainingExamples(meta,store=storeDefault){
 const history=await store.history(scope(meta),{limit:1000});
 const reviewed=new Set(history.filter(r=>r.type==='learning-review'&&r.approved===true).map(r=>r.digest));
 // No raw prompts, code, screenshots, names, URLs, user IDs or provider credentials are collected.
 const seen=new Set();
 return(await entries(meta,store)).filter(r=>reviewed.has(r.digest)).filter(r=>{const key=sha([r.topics,r.lesson.correction]);if(seen.has(key))return false;seen.add(key);return true;}).map(r=>({messages:[
  {role:'user',content:'How should an agent verify a '+r.topics.join(' ')+' workflow?'},
  {role:'assistant',content:r.lesson.correction}],metadata:{kind:'procedural-example',evidenceDigest:sha(r.evidence)}}));
}
module.exports={capture,recall,note,entries,review,revoke,trainingExamples,sourceDigest,validEvidence,topics};
