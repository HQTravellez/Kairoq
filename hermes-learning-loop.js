"use strict";
// Hermes-inspired learning loop. This is procedural learning from verified runs,
// NOT neural-network weight training. Never promote a failed or unverified run.
const crypto=require('node:crypto');
const defaultStore=require('./autonomy-store');
const apiSkills=require('./api-skill-memory');
const VALID_ID=/^[a-zA-Z0-9_-]{1,80}$/;
const SECRET=/(?:sk-[a-zA-Z0-9]{12,}|Bearer\s+\S+|-----BEGIN|api[_-]?key\s*[:=]\s*\S+|password\s*[:=]\s*\S+)/i;
function identifier(value){if(typeof value!=='string'||!VALID_ID.test(value))throw Error('Invalid project ID');return value;}
function safeText(value,max=1200){
 if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('Invalid lesson text');
 if(SECRET.test(value))throw Error('Potential secret in lesson');
 return value.trim();
}
function digest(value){return crypto.createHash('sha256').update(value).digest('hex');}
function fingerprint({task,diagnostic,correction}){return digest(JSON.stringify([task,diagnostic,correction]));}
// Capture the observation and its provenance. A success flag must come from a test result
// supplied by the executor; this module cannot invent or independently verify the result.
async function observe({projectId,task,diagnostic,correction,passed,evidenceDigest},store=defaultStore){
 identifier(projectId);
 if(typeof passed!=='boolean')throw Error('Explicit test result required');
 if(!/^[a-f0-9]{64}$/.test(evidenceDigest||''))throw Error('SHA-256 test evidence required');
 const record={type:'agent-lesson',task:safeText(task,240),diagnostic:safeText(diagnostic),
  correction:safeText(correction),passed,evidenceDigest,recordedAt:new Date().toISOString()};
 record.fingerprint=fingerprint(record);
 await store.append(projectId,record);
 return record;
}
// Recall only lessons associated with passing evidence, not untrusted or failed guesses.
// The caller must continue treating recalled text as data, never a privileged instruction.
async function recall({projectId,query,limit=5},store=defaultStore){
 identifier(projectId);const q=new Set((safeText(query,240).toLowerCase().match(/[a-z0-9_-]{3,}/g)||[]));
 const rows=await store.history(projectId,{limit:1000}),unique=new Set();
 return rows.filter(r=>r.type==='agent-lesson'&&r.passed===true&&/^[a-f0-9]{64}$/.test(r.evidenceDigest||''))
  .reverse().filter(r=>{if(unique.has(r.fingerprint))return false;unique.add(r.fingerprint);return true;})
  .map(r=>({...r,score:[...q].filter(t=>(r.task+' '+r.diagnostic+' '+r.correction).toLowerCase().includes(t)).length}))
  .filter(r=>r.score>0).sort((a,b)=>b.score-a.score)
  .slice(0,Math.min(10,Math.max(1,limit))).map(({task,diagnostic,correction,evidenceDigest,score})=>({task,diagnostic,correction,evidenceDigest,score}));
}
// API skills use the repository's existing evidence and holdout gates.
async function proposeApiSkill({projectId,skillId,pattern,evidenceDigests},store=defaultStore){
 return apiSkills.candidate({projectId,skillId,pattern,evidenceDigests},store);
}
async function approveApiSkill({projectId,skillId,version,benchmark},store=defaultStore){
 return apiSkills.promote({projectId,skillId,version,benchmark},store);
}
async function recalledApiSkill({projectId,skillId},store=defaultStore){
 return apiSkills.active({projectId,skillId},store);
}
module.exports={observe,recall,proposeApiSkill,approveApiSkill,recalledApiSkill,fingerprint};
