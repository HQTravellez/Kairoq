'use strict';
const crypto=require('node:crypto');
const CONTRACT_VERSION=4;
const REQUIRED_SCREENS=['dashboard','trips','approvals','spend','travelers','controls','workspace'];
function provenance(env=process.env){
 let sha=env.RAILWAY_GIT_COMMIT_SHA||env.GITHUB_SHA||env.KAIROQ_SOURCE_SHA;
 if(!sha)try{sha=require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:__dirname,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
 return{source_sha:/^[a-f0-9]{40}$/i.test(sha||'')?sha:null,contract_version:CONTRACT_VERSION};
}
function currentPass(report,current=provenance()){
 return !!current.source_sha&&report?.status==='passed'&&report.stage==='complete'&&report.source_sha===current.source_sha&&report.contract_version===current.contract_version&&report.app?.deployed_qa?.passed===true&&report.website?.deployed_qa?.passed===true&&validPublicQA(report.app.deployed_qa)&&validPublicQA(report.website.deployed_qa);
}
function validVisual(visual){return visual?.passed===true&&visual.coverage?.complete===true&&visual.coverage.mode==='ai-screenshot-review';}
function validPublicQA(qa){return validVisual(qa?.visual_review)&&Array.isArray(qa.evidence)&&qa.evidence.length>0&&qa.visual_review.evidence?.length===qa.evidence.length&&new Set(qa.evidence.map(e=>e.screen)).size===qa.evidence.length&&qa.evidence.every(e=>qa.visual_review.evidence.some(v=>v.screen===e.screen&&v.sha256===e.sha256));}
function evidenceManifest(shots){return shots.map(s=>({screen:s.label,sha256:crypto.createHash('sha256').update(s.bytes).digest('hex')}));}
function matchesEvidence(visual,shots){
 const expected=evidenceManifest(shots),actual=visual?.evidence;
 return validVisual(visual)&&expected.length>0&&Array.isArray(actual)&&actual.length===expected.length&&new Set(actual.map(s=>s.screen)).size===actual.length&&expected.every(s=>actual.some(a=>a.screen===s.screen&&a.sha256===s.sha256));
}
async function reviewEvidence(model,plan,shots,cached,checks=[]){
 if(!shots?.length)throw Error('Public screenshot evidence is missing');
 if(!checks.length&&matchesEvidence(cached,shots))return cached;
 const visual=await require('./design-pipeline').review(model,plan||{},shots,checks);
 if(!validVisual(visual)){const error=Error('Public screenshots require complete passing AI review: '+(visual.findings||[]).map(f=>f.issue).join('; '));error.visual_review=visual;throw error;}
 return visual;
}
function assertAppContract(candidate){
 const collections=candidate.schema?.collections||[];
 const required={trips:['traveler','destination','departure_date','status'],approvals:['requester','status'],expenses:['description','amount','category','status'],travelers:['name','email','department','status']};
 for(const [name,fields]of Object.entries(required)){
  const c=collections.find(c=>c.name===name);if(!c)throw Error('Travellez contract: missing collection '+name);
  for(const field of fields)if(!c.fields.some(f=>f.name===field))throw Error('Travellez contract: missing '+name+'.'+field);
  if(['approvals','expenses'].includes(name)&&!c.fields.some(f=>f.type==='reference'&&f.collection==='trips'))throw Error('Travellez contract: '+name+' must reference trips');
 }
 for(const [collection,from,to]of [['trips','requested','approved'],['trips','approved','booked'],['expenses','draft','submitted'],['expenses','submitted','paid']]){
  if(!candidate.schema.actions?.some(a=>a.collection===collection&&a.field==='status'&&a.to===to&&a.from?.length===1&&a.from[0]===from))throw Error('Travellez contract: missing guarded '+collection+' '+from+' → '+to);
 }
 return true;
}
module.exports={validPublicQA,CONTRACT_VERSION,REQUIRED_SCREENS,provenance,currentPass,validVisual,evidenceManifest,matchesEvidence,reviewEvidence,assertAppContract};
