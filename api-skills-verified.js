"use strict";
// Verified, per-project API skills. No self-reported model scores can promote revisions.
const crypto=require('node:crypto'),store=require('./autonomy-store');
const actions={'schema-mismatch':'inspect-response-schema','status-mismatch':'verify-documented-status','transport-failure':'retry-safe-read-only','verified-success':'reuse-verified-contract'};
const reasons={'schema-mismatch':'Inspect the actual response against the documented response schema and repair field mappings.','status-mismatch':'Compare actual HTTP status with documented expected statuses.','transport-failure':'Inspect network error and retry GET or HEAD with a strict bound, never repeat writes.','verified-success':'Reuse the documented and verified operation contract.'};
const valid=s=>/^[a-zA-Z0-9_-]{1,80}$/.test(s||'');
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function classify(e){if(e.passed===true&&e.responseDigest)return'verified-success';if(e.assessment?.schemaMatched===false)return'schema-mismatch';if(e.assessment?.validStatus===false)return'status-mismatch';if(e.passed===false&&e.reason==='Execution failed')return'transport-failure';return null;}
function choose(rules,kind){return (rules||[]).find(r=>r.kind===kind)?.action||null;}
function evaluate(before,after){
 const cases=Object.entries(actions).flatMap(([kind,expected])=>[{kind,expected,split:'train'},{kind,expected,split:'holdout'}]);
 const run=(rules,split)=>cases.filter(x=>x.split===split&&choose(rules,x.kind)===x.expected).length;
 return {kind:'guidance-routing-only',train:{before:run(before,'train'),after:run(after,'train'),total:4},holdout:{before:run(before,'holdout'),after:run(after,'holdout'),total:4}};
}
const improves=s=>s.train.after>s.train.before&&s.holdout.after>=s.holdout.before;
function selected(h,id){const last=h.filter(x=>x.type==='api-skill-verified-promotion'&&x.operationId===id).at(-1);return last?{version:last.version,rules:last.rules}:{version:0,rules:[]};}
function check(projectId,operationId){if(!valid(projectId)||!valid(operationId))throw Error('Invalid project or operation ID');}
async function candidate({projectId,operationId},{persistence=store}={}){
 check(projectId,operationId);
 const h=await persistence.history(projectId,{limit:1000}),prior=selected(h,operationId);
 const records=h.filter(x=>x.type==='api-execution'&&x.operationId===operationId&&classify(x));
 if(!records.length)throw Error('No stored API execution evidence for this operation');
 const rules=prior.rules.map(x=>({...x}));
 for(const kind of new Set(records.map(classify)))if(!rules.some(x=>x.kind===kind))rules.push({kind,action:actions[kind],reason:reasons[kind]});
 rules.sort((a,b)=>a.kind.localeCompare(b.kind));
 if(digest(rules)===digest(prior.rules))return {status:'unchanged',version:prior.version,operationId};
 const existing=h.filter(x=>x.type==='api-skill-verified-candidate'&&x.operationId===operationId);
 const version=1+Math.max(prior.version,...existing.map(x=>x.version));
 const item={type:'api-skill-verified-candidate',operationId,version,priorVersion:prior.version,rules,rulesHash:digest(rules),evidenceCount:records.length,createdAt:new Date().toISOString()};
 await persistence.append(projectId,item);
 return {status:'candidate',operationId,version,rules,priorVersion:prior.version};
}
async function benchmark({projectId,operationId,version},{persistence=store}={}){
 check(projectId,operationId);
 const h=await persistence.history(projectId,{limit:1000}),old=selected(h,operationId);
 const item=h.find(x=>x.type==='api-skill-verified-candidate'&&x.operationId===operationId&&x.version===version);
 if(!item||item.priorVersion!==old.version)throw Error('Candidate missing or outdated');
 const scored=evaluate(old.rules,item.rules);
 const result={type:'api-skill-verified-benchmark',operationId,version,rulesHash:item.rulesHash,priorVersion:old.version,...scored,improved:improves(scored),createdAt:new Date().toISOString()};
 await persistence.append(projectId,result);return result;
}
async function promote({projectId,operationId,version},{persistence=store}={}){
 check(projectId,operationId);
 const h=await persistence.history(projectId,{limit:1000}),old=selected(h,operationId);
 const item=h.find(x=>x.type==='api-skill-verified-candidate'&&x.operationId===operationId&&x.version===version);
 if(!item||item.priorVersion!==old.version)throw Error('Candidate missing or outdated');
 const verified=h.some(x=>x.type==='api-skill-verified-benchmark'&&x.operationId===operationId&&x.version===version&&x.rulesHash===item.rulesHash&&x.priorVersion===old.version&&x.improved);
 if(!verified||!improves(evaluate(old.rules,item.rules)))throw Error('Verified benchmark improvement required');
 const revision={type:'api-skill-verified-promotion',operationId,version,rules:item.rules,rulesHash:item.rulesHash,benchmarkKind:'guidance-routing-only',createdAt:new Date().toISOString()};
 await persistence.append(projectId,revision);
 return {status:'promoted',operationId,version,rules:revision.rules,benchmarkKind:revision.benchmarkKind};
}
async function active({projectId,operationId},{persistence=store}={}){
 check(projectId,operationId);return selected(await persistence.history(projectId,{limit:1000}),operationId);
}
async function learn({projectId,operationId},options={}){
 const c=await candidate({projectId,operationId},options);
 if(c.status==='unchanged')return c;
 const b=await benchmark({projectId,operationId,version:c.version},options);
 return b.improved?{...await promote({projectId,operationId,version:c.version},options),benchmark:b}:{status:'rejected',version:c.version,benchmark:b};
}
module.exports={actions,classify,choose,evaluate,candidate,benchmark,promote,active,learn};
