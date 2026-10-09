'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const builder=require('./app-builder'),web=require('./developer-agent');
const root=path.join(__dirname,'workspace'),marker=path.join(root,'.travellez-benchmark-v2.json'),proof=path.join(root,'generated','travellez-benchmark'),reportFile=path.join(proof,'report.json');
async function run(model){
 if(fs.existsSync(marker)){console.log('[travellez-benchmark] Previously completed; no new build');return;}
 fs.mkdirSync(proof,{recursive:true});
 const previous=status();
 const report={started_at:new Date().toISOString(),status:'running',stage:'starting',app:null,website:null};
 const save=()=>fs.writeFileSync(reportFile,JSON.stringify(report,null,2));const stage=value=>{report.stage=value;report.updated_at=new Date().toISOString();save();console.log('[travellez-benchmark] STAGE '+value);};
 save();
 try{
  const job={id:crypto.randomUUID(),operation:'build',projectName:'Travellez Travel Operations Benchmark',style:'tech',effects:{motion:'cinematic',threeD:'interactive',models:true},brief:'Build an exceptional premium full-stack corporate travel operations application named Travellez. Use multiple distinct responsive screens: dashboard, trips, approvals, spend, travelers, and controls, plus the required workspace screen for CRUD. Include real collections for trips (traveler, destination, departure_date, status requested/approved/booked), approvals (trip reference, requester, status pending/approved/rejected), expenses (trip reference, description, amount, category, status draft/submitted/paid), and travelers (name, email, department, status active/inactive). Declare real server workflow actions so a trip can be approved only from requested and booked only from approved, and an expense can be submitted only from draft and paid only from submitted. Use record references between approvals/expenses and trips. Give users a visually distinctive premium sidebar, clear KPI dashboard, excellent search/filter, polished empty/saving/error/populated states, and responsive mobile/tablet/desktop layouts. Use cinematic but restrained motion, product-card tilt, and one tasteful interactive WebGL travel scene such as routes/globe that never contains essential controls. Use the managed authenticated backend and real persistence. Do not add unsupported payments, GDS integrations, fabricated results, or fake actions.',status:'queued',created_at:new Date().toISOString()};
  const checkpoint=resumeApp(previous,builder.listProjects());
  if(!checkpoint){
  console.log('[travellez-benchmark] Fresh app generation started '+job.id);stage('app_generation');
  await builder.run(job,model);
  if(job.status!=='complete'||!job.result?.qa?.passed||!job.result?.qa?.visual_review?.passed)throw Error('App generation/QA failed: '+(job.error||JSON.stringify(job.result?.qa)));
  }else console.log('[travellez-benchmark] Rechecking published app checkpoint '+checkpoint.id);
  stage('app_publish');const released=await builder.publish(checkpoint?.id||job.result.id);
  if(!released?.deployed_qa?.passed)throw Error('Deployed app QA failed');
  report.app={id:released.id,live_url:released.live_url,qa:released.qa,deployed_qa:released.deployed_qa};
  stage('website_generation');console.log('[travellez-benchmark] APP PASS '+JSON.stringify({id:released.id,url:released.live_url}));
  const site=await web.build({projectName:'Travellez Corporate Travel Website Benchmark',kind:'website',style:'tech',motion:'cinematic',threeD:'interactive',brief:'Build a premium multi-page corporate travel and spend platform website for Travellez. Generate at minimum index.html, platform.html, smart-itinerary.html, industries.html, about.html and pricing.html with one consistent design system, working cross-page navigation, excellent desktop/mobile UX, and distinctive product storytelling. The homepage should explain business travel, approvals, spend and controls. Platform should visually explain the product surfaces. Smart Itinerary should show one-sentence-to-complete-trip storytelling. Industries should present credible corporate use cases without fabricated customer claims. About should explain the product/company clearly. Pricing should present structure honestly without invented customer logos or testimonials. Use cinematic but restrained scroll motion, reveal/parallax effects, premium product mockups, and one interactive WebGL travel routes/globe scene in the hero. Keep all essential content accessible without effects, and make every page work on 390px and 1440px. No fabricated clients, stats, external APIs or fake contact form submissions.'},model);
  if(!site.qa?.passed||!site.qa?.visual_review?.passed)throw Error('Website generation/visual QA failed');
  if(['index.html','platform.html','smart-itinerary.html','industries.html','about.html','pricing.html'].some(name=>!site.pages?.includes(name)))throw Error('Website did not generate the required multi-page route set');report.website={id:site.id,pages:site.pages,effects:site.effects,qa:site.qa,preview_url:'/api/developer/preview/'+site.id+'/index.html'};
  report.status='passed';report.stage='complete';report.completed_at=new Date().toISOString();save();fs.writeFileSync(marker,JSON.stringify({passed:true,at:report.completed_at,app_id:report.app.id,website_id:site.id}));
  console.log('[travellez-benchmark] PASS '+JSON.stringify({app_id:report.app.id,website_id:site.id}));
 }catch(e){report.status='failed';report.stage='failed';report.error=String(e.message||e).slice(0,1500);report.completed_at=new Date().toISOString();save();console.error('[travellez-benchmark] FAIL '+report.error);}
}
function status(){try{return JSON.parse(fs.readFileSync(reportFile,'utf8'));}catch{return{status:fs.existsSync(marker)?'passed':'idle',stage:fs.existsSync(marker)?'complete':'idle'};}}
function resumeApp(report,projects){
 const app=report?.app;if(!app?.qa?.passed||!app.qa.visual_review?.passed||!app.deployed_qa?.passed)return null;
 const project=projects.find(p=>p.id===app.id&&p.status==='live'&&p.deployed_version);
 return project?app:null;
}
module.exports={run,status,resumeApp};
