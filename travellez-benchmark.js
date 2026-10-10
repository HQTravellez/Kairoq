'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const builder=require('./app-builder'),web=require('./developer-agent'),gates=require('./benchmark-gates');
const root=path.join(__dirname,'workspace'),marker=path.join(root,'.travellez-benchmark-v3.json'),proof=path.join(root,'generated','travellez-benchmark'),reportFile=path.join(proof,'report.json');
async function run(model){
 const current=gates.provenance();
 if(gates.currentPass(status(),current)){console.log('[travellez-benchmark] Current commit already verified; no new build');return status();}
 fs.mkdirSync(proof,{recursive:true});
 const previous=status(),checkpoint=resumeApp(previous,builder.listProjects());
 const report={...current,started_at:new Date().toISOString(),status:'running',stage:'starting',app:checkpoint,website:previous.website||null};
 const save=()=>fs.writeFileSync(reportFile,JSON.stringify(report,null,2));const stage=value=>{report.stage=value;report.updated_at=new Date().toISOString();save();console.log('[travellez-benchmark] STAGE '+value);};
 save();
 try{
  const job={id:crypto.randomUUID(),operation:'build',projectName:'Travellez Travel Operations Benchmark',style:'tech',effects:{motion:'cinematic',threeD:'interactive',models:true},brief:'Build an exceptional premium full-stack corporate travel operations application named Travellez. Use multiple distinct responsive screens: dashboard, trips, approvals, spend, travelers, and controls, plus the required workspace screen for CRUD. Include real collections for trips (traveler, destination, departure_date, status requested/approved/booked), approvals (trip reference, requester, status pending/approved/rejected), expenses (trip reference, description, amount, category, status draft/submitted/paid), and travelers (name, email, department, status active/inactive). Declare real server workflow actions so a trip can be approved only from requested and booked only from approved, and an expense can be submitted only from draft and paid only from submitted. Use record references between approvals/expenses and trips. Give users a visually distinctive premium sidebar, clear KPI dashboard, excellent search/filter, polished empty/saving/error/populated states, and responsive mobile/tablet/desktop layouts. Use cinematic but restrained motion, product-card tilt, and one tasteful interactive WebGL travel scene such as routes/globe that never contains essential controls. Use the managed authenticated backend and real persistence. Do not add unsupported payments, GDS integrations, fabricated results, or fake actions.',status:'queued',created_at:new Date().toISOString()};
  if(!checkpoint){
  console.log('[travellez-benchmark] Fresh app generation started '+job.id);stage('app_generation');
  await builder.run(job,model);
  if(job.status!=='complete'||!job.result?.qa?.passed||!job.result?.qa?.visual_review?.passed)throw Error('App generation/QA failed: '+(job.error||JSON.stringify(job.result?.qa)));
  }else console.log('[travellez-benchmark] Rechecking published app checkpoint '+checkpoint.id);
  stage('app_publish');let released;
  try{released=await builder.publish(checkpoint?.id||job.result.id);}catch(error){
   console.warn('[travellez-benchmark] APP PUBLISH CHECK FAILED '+String(error.message).slice(0,1500));
   if(!checkpoint)throw error;stage('app_repair');const repair={...job,id:crypto.randomUUID(),operation:'repair',projectId:checkpoint.id,reported_issue:true,resume_job:resumeRepair(checkpoint.id),brief:job.brief+'\nPublic deployment check failed: '+error.message+(previous.app?.qa?.visual_review?require('./design-pipeline').repairInstructions(previous.app.qa.visual_review):'')};report.app.repair_job_id=repair.id;save();
   await builder.run(repair,model);if(repair.status!=='complete'||!repair.result?.qa?.passed)throw Error('App deployment repair failed: '+repair.error);released=await builder.publish(checkpoint.id);
  }
  if(!released?.deployed_qa?.passed)throw Error('Deployed app QA failed');
  report.app={id:released.id,live_url:released.live_url,qa:released.qa,deployed_qa:released.deployed_qa};
  stage('app_visual_review');
  const runtime=require('./app-runtime'),pipeline=require('./design-pipeline');
  async function reviewReleased(release,cached){
   const candidate=runtime.readVersion(release.id,release.deployed_version);
   const shots=release.deployed_qa.evidence.map((entry,index)=>({label:entry.screen,bytes:fs.readFileSync(path.join(runtime.ROOT,release.id,'release-evidence',String(release.deployed_version),'design-evidence',String(index+1)+'.jpg'))}));
   return gates.reviewEvidence(model,candidate.design_plan,shots,cached,release.deployed_qa.design_checks||[]);
  }
  let visual;
  try{visual=await reviewReleased(released,previous.app?.deployed_qa?.visual_review);}catch(error){
   if(!error.visual_review)throw error;
   stage('app_visual_repair');const repair={...job,id:crypto.randomUUID(),operation:'repair',projectId:released.id,reported_issue:true,brief:job.brief+pipeline.repairInstructions(error.visual_review),resume_job:resumeRepair(released.id)};report.app.repair_job_id=repair.id;save();
   await builder.run(repair,model);if(repair.status!=='complete'||!repair.result?.qa?.passed)throw Error('App visual repair failed: '+repair.error);
   released=await builder.publish(released.id);report.app={id:released.id,live_url:released.live_url,qa:released.qa,deployed_qa:released.deployed_qa};
   visual=await reviewReleased(released,null);
  }
  report.app.deployed_qa.visual_review=visual;save();
  stage('website_generation');console.log('[travellez-benchmark] APP PASS '+JSON.stringify({id:released.id,url:released.live_url}));
  const savedSite=resumeWebsite(previous,web.listProjects());
  const site=savedSite?(savedSite.qa?.passed&&gates.validVisual(savedSite.qa.visual_review)?web.getProject(savedSite.id):await web.reviewProject(savedSite.id,model)):await web.build({projectName:'Travellez Corporate Travel Website Benchmark',kind:'website',style:'tech',motion:'cinematic',threeD:'interactive',brief:'Build a premium multi-page corporate travel and spend platform website for Travellez. Generate at minimum index.html, platform.html, smart-itinerary.html, industries.html, about.html and pricing.html with one consistent design system, working cross-page navigation, excellent desktop/mobile UX, and distinctive product storytelling. The homepage should explain business travel, approvals, spend and controls. Platform should visually explain the product surfaces. Smart Itinerary should show one-sentence-to-complete-trip storytelling. Industries should present credible corporate use cases without fabricated customer claims. About should explain the product/company clearly. Pricing should present structure honestly without invented customer logos or testimonials. Use cinematic but restrained scroll motion, reveal/parallax effects, premium product mockups, and one interactive WebGL travel routes/globe scene in the hero. Keep all essential content accessible without effects, and make every page work on 390px and 1440px. No fabricated clients, stats, external APIs or fake contact form submissions.'},model);
  report.website={id:site.id,pages:site.pages,effects:site.effects,qa:site.qa,preview_url:site.preview_url};save();
  if(!site.qa?.passed||!site.qa?.visual_review?.passed)throw Error('Website generation/visual QA failed');
  if(['index.html','platform.html','smart-itinerary.html','industries.html','about.html','pricing.html'].some(name=>!site.pages?.includes(name)))throw Error('Website did not generate the required multi-page route set');report.website={id:site.id,pages:site.pages,effects:site.effects,qa:site.qa,preview_url:'/api/developer/preview/'+site.id+'/index.html'};
  stage('website_publish');let published;
  try{published=await require('./website-release').deploy(site.id,{callModel:model});}catch(error){
   if(!error.visual_review)throw error;
   stage('website_public_visual_repair');const repaired=await web.revise(site.id,pipeline.repairInstructions(error.visual_review),model);
   report.website={...report.website,pages:repaired.pages,qa:repaired.qa};save();
   published=await require('./website-release').deploy(site.id,{callModel:model});
  }
  report.website={...report.website,live_url:published.live_url,published_version:published.published_version,deployed_qa:published.deployed_qa};
  report.status='passed';report.stage='complete';report.completed_at=new Date().toISOString();
  if(!gates.currentPass(report,current))throw Error('Benchmark completion is missing current commit or matching public visual evidence');
  save();fs.writeFileSync(marker,JSON.stringify({...current,passed:true,at:report.completed_at,app_id:report.app.id,website_id:site.id}));
  const summary=surface=>{const qa=surface.deployed_qa,visual=qa.visual_review;return{id:surface.id,url:surface.live_url,version:qa.version||surface.published_version,passed:qa.passed,pages:qa.pages,tested:qa.tested||qa.routes?.map(route=>({page:route.page,tested:route.tested})),score:visual.score,scores:visual.scores,coverage:visual.coverage,evidence_count:qa.evidence.length};};
  console.log('[travellez-benchmark] PASS '+JSON.stringify({...current,completed_at:report.completed_at,app:summary(report.app),website:summary(report.website)}));
 }catch(e){if(e.projectId)report.website={id:e.projectId};report.status='failed';report.stage='failed';report.error=String(e.message||e).slice(0,1500);report.completed_at=new Date().toISOString();save();console.error('[travellez-benchmark] FAIL '+report.error);}
 return report;
}
function status(){try{const report=JSON.parse(fs.readFileSync(reportFile,'utf8'));if(report.status==='passed'&&!gates.currentPass(report))return{...report,status:'stale',stage:'revalidation_required'};return report;}catch{return{status:'idle',stage:'idle'};}}
function resumeApp(report,projects){
 const verified=app=>app?.qa?.passed&&app.qa.visual_review?.passed&&app.deployed_qa?.passed;
 const live=project=>project.status==='live'&&project.deployed_version;
 if(verified(report?.app)&&projects.some(project=>project.id===report.app.id&&live(project)))return report.app;
 // Recover a verified durable release if an older runner lost its report checkpoint.
 const project=projects.find(project=>project.id.startsWith('travellez-travel-operations-benchmark-')&&live(project)&&verified(project));
 return project?{id:project.id,live_url:project.live_url,qa:project.qa,deployed_qa:project.deployed_qa}:null;
}

function resumeWebsite(report,projects){
 const found=projects.find(project=>project.id===report?.website?.id)||projects.find(project=>project.id.startsWith('travellez-corporate-travel-website-benchmark-'));
 return found||null;
}
function resumeRepair(projectId,jobsRoot=path.join(root,'build-jobs')){
 if(!fs.existsSync(jobsRoot))return null;
 return fs.readdirSync(jobsRoot).filter(name=>/^[a-f0-9-]{36}\.json$/.test(name)).flatMap(name=>{try{const job=JSON.parse(fs.readFileSync(path.join(jobsRoot,name),'utf8'));return job.projectId===projectId&&job.operation==='repair'&&job.status!=='complete'&&fs.existsSync(path.join(jobsRoot,job.id+'.candidate.json'))?[job]:[];}catch{return[];}}).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))[0]?.id||null;
}
module.exports={run,status,resumeApp,resumeWebsite,resumeRepair};
