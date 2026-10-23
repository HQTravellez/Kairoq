"use strict";
// Versioned API skill candidates. Persist only sanitized, explicit reusable patterns.
const crypto=require('node:crypto');
const memory=require('./autonomy-store');
const ID=/^[a-zA-Z0-9_-]{1,80}$/;
function checkId(id){if(!ID.test(id||''))throw Error('Invalid ID');return id;}
function cleanPattern(p){
 if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Skill pattern required');
 const fields=['name','description','authentication','requestPattern','responsePattern','failureMode','correction','verification'];
 const out={};
 for(const k of fields){
  if(p[k]!==undefined){
   if(typeof p[k]!=='string'||p[k].length>1500)throw Error('Invalid pattern field: '+k);
   if(/(?:sk-[a-zA-Z0-9]{12,}|Bearer\s+\S+|-----BEGIN|api[_-]?key\s*[:=]\s*\S+)/i.test(p[k]))throw Error('Potential secret in skill');
   out[k]=p[k];
  }
 }
 if(!out.name||!out.verification)throw Error('Skill name and verification required');
 return out;
}
function checksum(pattern){return crypto.createHash('sha256').update(JSON.stringify(pattern)).digest('hex');}
async function candidate({projectId,skillId,pattern,evidenceDigests},store=memory){
 checkId(projectId);checkId(skillId);
 const safe=cleanPattern(pattern);
 if(!Array.isArray(evidenceDigests)||!evidenceDigests.length||evidenceDigests.length>100||evidenceDigests.some(x=>!/^[a-f0-9]{64}$/.test(x)))throw Error('Verified evidence digests required');
 const history=await store.history(projectId);
 const verified=new Set(history.filter(x=>x.type==='api-execution'&&x.passed===true).map(x=>x.responseDigest));
 if(!evidenceDigests.every(x=>verified.has(x)))throw Error('Evidence must be verified and stored');
 const version=1+Math.max(0,...history.filter(x=>x.type==='api-skill-candidate'&&x.skillId===skillId).map(x=>x.version||0));
 const record={type:'api-skill-candidate',skillId,version,pattern:safe,patternDigest:checksum(safe),evidenceDigests:[...new Set(evidenceDigests)],status:'candidate',recordedAt:new Date().toISOString()};
 await store.append(projectId,record);return record;
}
function validateBenchmarks(b){
 if(!b||!Array.isArray(b.cases)||b.cases.length<3||b.cases.length>100)throw Error('At least three benchmark cases required');
 const seen=new Set();let newPass=0,oldPass=0,holdout=0;
 for(const c of b.cases){
  if(!c||typeof c.id!=='string'||!ID.test(c.id)||seen.has(c.id)||typeof c.newPassed!=='boolean'||typeof c.oldPassed!=='boolean'||typeof c.holdout!=='boolean')throw Error('Invalid benchmark case');
  seen.add(c.id);if(c.newPassed)newPass++;if(c.oldPassed)oldPass++;if(c.holdout)holdout++;
  if(c.holdout&&c.oldPassed&&!c.newPassed)throw Error('Holdout regression');
 }
 if(!holdout)throw Error('Independent holdout required');
 if(newPass<=oldPass)throw Error('Candidate did not outperform baseline');
 return {total:b.cases.length,newPass,oldPass,holdout};
}
async function promote({projectId,skillId,version,benchmark},store=memory){
 checkId(projectId);checkId(skillId);
 const history=await store.history(projectId);
 const item=history.find(x=>x.type==='api-skill-candidate'&&x.skillId===skillId&&x.version===version);
 if(!item)throw Error('Candidate not found');
 if(history.some(x=>x.type==='api-skill-promotion'&&x.skillId===skillId&&x.version===version))throw Error('Already promoted');
 // The caller must independently execute and attest these cases. Never expose promotion to a model.
 const metrics=validateBenchmarks(benchmark);
 const record={type:'api-skill-promotion',skillId,version,patternDigest:item.patternDigest,metrics,recordedAt:new Date().toISOString()};
 await store.append(projectId,record);return record;
}
async function active({projectId,skillId},store=memory){
 checkId(projectId);checkId(skillId);
 const history=await store.history(projectId);
 const promoted=history.filter(x=>x.type==='api-skill-promotion'&&x.skillId===skillId).at(-1);
 if(!promoted)return null;
 return history.find(x=>x.type==='api-skill-candidate'&&x.skillId===skillId&&x.version===promoted.version)||null;
}
module.exports={candidate,promote,active,cleanPattern,validateBenchmarks};
