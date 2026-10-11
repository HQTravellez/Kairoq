'use strict';
// Explicitly enabled, one-shot verification. Uses the normal builder and release gates.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const runtime=require('./app-runtime'),builder=require('./app-builder'),release=require('./app-release');
const REGRESSION='KAIROQ_CONTROLLED_DRAFT_REGRESSION';
const BRIEF='Build Fieldwork, a premium project delivery workspace for a small consulting company. Three linked collections: projects (name, client, budget, status draft/active/completed), tasks (project reference, title, due date, status todo/doing/done), and time entries (task reference, description, hours). Login and private per-user records, dashboard, workspace and insights screens with real navigation, search, filters and forms. Projects are the first collection and have no reference fields. Add a server-enforced internal project activation action and a transactional function to log time against a task; reject hours below 0.25 or above 24. Include business acceptance scenarios covering successful time logging and rejected excessive hours. This is internal project administration only: no payments, bookings, external APIs, teams, billing, scheduled jobs or webhooks. Use the trusted UI components, clear empty states, readable typography and polished mobile layout. No mock metrics; derive summaries from saved data.';
function validateRunId(value){if(!/^[a-z0-9][a-z0-9-]{3,59}$/.test(value||''))throw Error('GENERIC_RELEASE_PROOF must be a unique 4–60 character lowercase run ID');return value;}
function assertContract(project){
 const s=project.schema;
 if(s.collections.length<3||!s.collections.some(c=>c.fields.some(f=>f.type==='reference'))||!s.actions?.length||!s.functions?.length||!s.scenarios?.some(x=>x.expectedError)||!s.scenarios?.some(x=>x.expect))throw Error('Generated app omitted required linked collections, actions, functions or positive/negative business scenarios');
 if(s.teams||s.billing||s.automations||project.orchestration?.plan?.workflows?.length)throw Error('Verification app must have no external side effects or team provisioning');
}
function introduceRegression(id){
 const previous=runtime.getProject(id),version=Math.max(...release.versions(id).map(v=>v.version))+1;
 if(previous.status!=='live'||!previous.deployed_version)throw Error('Deploy the passing app before introducing a draft regression');
 const dir=path.join(runtime.ROOT,id,'versions',String(version));fs.mkdirSync(dir,{recursive:true});
 for(const [name,body]of Object.entries(previous.files))fs.writeFileSync(path.join(dir,name),body+(name==='app.js'?'\nthrow new Error("'+REGRESSION+'");\n':''));
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({schema:previous.schema,orchestration:previous.orchestration,design_plan:previous.design_plan,qa:{passed:false,reason:'Controlled draft regression'}}));
 runtime.saveMetadata({...runtime.metadata(id),version,qa:{passed:false,reason:'Controlled draft regression'}});
 return{version,previousVersion:previous.deployed_version};
}
function assertPassed(report){
 if(!/^[a-f0-9]{40}$/.test(report.source_sha||'')||!report.before?.passed||!report.after?.passed||!report.regression?.detected||!report.repair?.job||!report.saved_record_preserved||report.before.version===report.after.version)throw Error('Incomplete generic release proof');
 for(const phase of ['before','after']){const qa=report[phase];if(qa.scope!=='public deployed URL'||!qa.evidence?.length||!qa.tested?.includes('login')||!qa.tested.includes('mobile390px')||!qa.tested.includes('persistent records after reload')||!qa.tested.some(s=>s.startsWith('business acceptance:')))throw Error('Missing public browser evidence for '+phase);}
}
async function run(model,{runId=process.env.GENERIC_RELEASE_PROOF}={}){
 validateRunId(runId);
 const folder=path.join(__dirname,'public','generated','generic-proof',runId),file=path.join(folder,'report.json');
 // A failed/interrupted run is evidence, not permission to spend again on restart.
 if(fs.existsSync(file)){console.log('[generic-proof] Existing run '+runId+'; no duplicate generation');return JSON.parse(fs.readFileSync(file));}
 fs.mkdirSync(folder,{recursive:true});
 const report={run_id:runId,source_sha:require('./benchmark-gates').provenance().source_sha,status:'running',stage:'build',started_at:new Date().toISOString()};
 const save=()=>{fs.writeFileSync(file+'.tmp',JSON.stringify(report,null,2));fs.renameSync(file+'.tmp',file);console.log('[generic-proof] '+JSON.stringify({run_id:runId,stage:report.stage,status:report.status,app:report.app,error:report.error}));};
 save();let account,id;
 try{
  const origin=release.publicOrigin();if(!origin||!report.source_sha)throw Error('Public origin and source commit are required');
  const job={id:crypto.randomUUID(),operation:'build',projectName:'Fieldwork '+runId,brief:BRIEF,style:'editorial',auto_assets:false,status:'queued',created_at:new Date().toISOString()};
  report.build_job=job.id;save();await builder.run(job,model);if(job.status!=='complete')throw Error(job.error);
  id=job.result.id;report.app={id,url:origin+'/apps/'+id+'/'};assertContract(runtime.getProject(id));
  report.stage='deploy-before';save();const deployed=await release.deploy(id);report.before=deployed.deployed_qa;
  // Retain a real record across the entire repair, beyond the per-check QA fixtures.
  const base=report.app.url+'api/';let cookie='';
  const request=async(route,method='GET',body)=>{const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const data=await r.json();if(!r.ok)throw Error('Persistence check failed at '+route+' ('+r.status+')');return data;};
  const email='kairoq-qa-'+crypto.randomBytes(12).toString('hex')+'@example.com';account=(await request('auth/register','POST',{email,password:crypto.randomBytes(24).toString('hex')})).user;
  const project=runtime.getProject(id),collection=project.schema.collections[0];if(collection.fields.some(f=>f.type==='reference'))throw Error('Primary collection cannot require linked fixtures');
  const values=Object.fromEntries(collection.fields.map(f=>[f.name,f.default??(f.type==='number'?Math.max(f.minimum??0,Math.min(f.maximum??100,1)):f.type==='boolean'?false:f.type==='date'?'2030-10-11':f.type==='email'?'synthetic@example.com':f.type==='select'?runtime.workflowInitial(project.schema,collection,f):'Preserved synthetic '+f.label)]));
  const record=(await request('collections/'+collection.name,'POST',values)).record;
  report.stage='controlled-regression';report.regression=introduceRegression(id);save();
  try{await builder.browserQA(id,runtime.getProject(id),project);throw Error('Controlled regression was not detected');}catch(e){if(!e.message.includes(REGRESSION))throw e;report.regression.detected=true;report.regression.diagnostic=e.message.slice(0,400);}
  if(runtime.metadata(id).deployed_version!==report.before.version)throw Error('Draft regression changed the live app');
  report.stage='automatic-repair';save();
  const repairJob={id:crypto.randomUUID(),operation:'repair',projectId:id,projectName:job.projectName,brief:'Diagnose and repair the startup exception '+REGRESSION+' in the draft. Remove the deliberate throw. Preserve all schemas, business scenarios, styles, screens, auth, CRUD, references, workflows and existing saved data.',reported_issue:false,auto_assets:false,status:'queued',created_at:new Date().toISOString()};
  await builder.run(repairJob,model);if(repairJob.status!=='complete')throw Error(repairJob.error);
  report.repair={job:repairJob.id,version:repairJob.result.version};assertContract(runtime.getProject(id));
  if(runtime.metadata(id).deployed_version!==report.before.version)throw Error('Repair bypassed explicit deployment');
  report.stage='deploy-after';save();const repaired=await release.deploy(id);report.after=repaired.deployed_qa;
  const retained=(await request('collections/'+collection.name)).records.find(r=>r.id===record.id);
  report.saved_record_preserved=!!retained&&Object.entries(record.data).every(([k,v])=>retained.data[k]===v);
  assertPassed(report);
  for(const phase of ['before','after']){const qa=report[phase],dest=path.join(folder,phase);fs.mkdirSync(dest,{recursive:true});for(let i=0;i<qa.evidence.length;i++){const bytes=require('./benchmark-evidence').read({app:{id,deployed_qa:qa}},'app',i+1);fs.writeFileSync(path.join(dest,(i+1)+'.jpg'),bytes);qa.evidence[i].url=origin+'/generated/generic-proof/'+runId+'/'+phase+'/'+(i+1)+'.jpg';}}
  report.status='passed';report.stage='complete';
 }catch(e){report.status='blocked';report.error=String(e.message).slice(0,2000);}
 finally{if(account&&id)try{require('./housing-runtime').removeTestAccount(runtime.ROOT,id,account);}catch(e){report.status='blocked';report.cleanup_error=String(e.message).slice(0,300);}report.finished_at=new Date().toISOString();save();}
 return report;
}
module.exports={run,validateRunId,assertContract,assertPassed,introduceRegression,REGRESSION};
