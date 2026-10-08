'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const builder=require('./app-builder'),web=require('./developer-agent');
const root=path.join(__dirname,'workspace'),marker=path.join(root,'.travellez-benchmark-v1.json'),proof=path.join(root,'generated','travellez-benchmark');
async function run(model){
 if(fs.existsSync(marker)){console.log('[travellez-benchmark] Previously completed; no new build');return;}
 fs.mkdirSync(proof,{recursive:true});
 const report={started_at:new Date().toISOString(),status:'running',app:null,website:null};
 const save=()=>fs.writeFileSync(path.join(proof,'report.json'),JSON.stringify(report,null,2));
 save();
 try{
  const job={id:crypto.randomUUID(),operation:'build',projectName:'Travellez Travel Operations Benchmark',style:'modern',brief:'Build an exceptional premium corporate travel operations application named Travellez. Include FOUR real record collections: trips (traveler, destination, departure date, status planned/approved/booked), approvals (request, requester, status pending/approved/rejected), expenses (description, amount, category, status draft/submitted/paid), and travelers (name, email, department, status active/inactive). Give users a visually distinctive sidebar, a clear dashboard with four metrics, collection navigation, readable tables or cards, practical search/filter, polished empty/saving/error/populated states, and responsive mobile/tablet/desktop layouts. Use the existing managed authenticated CRUD backend, real persistence, and usable semantic controls. Do not add unsupported payments, GDS integrations, fabricated financial results, or fake actions.',status:'queued',created_at:new Date().toISOString()};
  console.log('[travellez-benchmark] Fresh app generation started '+job.id);
  await builder.run(job,model);
  if(job.status!=='complete'||!job.result?.qa?.passed||!job.result?.qa?.visual_review?.passed)throw Error('App generation/QA failed: '+(job.error||JSON.stringify(job.result?.qa)));
  const released=await builder.publish(job.result.id);
  if(!released?.deployed_qa?.passed)throw Error('Deployed app QA failed');
  report.app={id:released.id,live_url:released.live_url,qa:released.qa,deployed_qa:released.deployed_qa};
  save();console.log('[travellez-benchmark] APP PASS '+JSON.stringify({id:released.id,url:released.live_url}));
  const site=await web.build({projectName:'Travellez Corporate Travel Website Benchmark',kind:'website',style:'modern',brief:'Build a premium polished corporate travel and spend platform website for Travellez, with a strong distinctive visual hierarchy, features for business travel booking, approvals, expenses and controls, an elegant dashboard-style illustration using CSS or inline SVG, clear enterprise value proposition, accessible mobile menu, honest content and functional on-page CTAs. No fabricated clients, stats, external APIs or fake contact form submissions.'},model);
  if(!site.qa?.passed||!site.qa?.visual_review?.passed)throw Error('Website generation/visual QA failed');
  report.website={id:site.id,qa:site.qa,preview_url:'/api/developer/preview/'+site.id};
  report.status='passed';report.completed_at=new Date().toISOString();save();fs.writeFileSync(marker,JSON.stringify({passed:true,at:report.completed_at,app_id:report.app.id,website_id:site.id}));
  console.log('[travellez-benchmark] PASS '+JSON.stringify({app_id:report.app.id,website_id:site.id}));
 }catch(e){report.status='failed';report.error=String(e.message||e).slice(0,1500);save();console.error('[travellez-benchmark] FAIL '+report.error);}
}
module.exports={run};
