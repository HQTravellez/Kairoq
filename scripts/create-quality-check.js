"use strict";
// Real-model quality check for Kairoq Create. Builds sample apps with the
// configured builder model, applies a follow-up edit, opens each result in
// Chromium and reports what rendered. Spends real model credit.
//
//   OPENROUTER_API_KEY=... KAIROQ_BUILDER_MODE=paid-first KAIROQ_BUILDER_PAID_APPROVED=true \
//     node scripts/create-quality-check.js [--limit 3] [--out quality-report.json]
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const args=process.argv.slice(2),flag=(name,fallback)=>{const i=args.indexOf(name);return i>=0?args[i+1]:fallback};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-quality-'));
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.NODE_ENV='test';

const CASES=[
 {prompt:'A landing page for a boutique hotel in Lisbon with rooms, prices, photos and a booking enquiry form',followUp:'Add a reviews section with five guest quotes',expect:/lisbon/i},
 {prompt:'A CRM where my team signs in and tracks leads with status, value and next follow-up date',followUp:'Add a filter by status and show the total pipeline value',expect:/lead/i},
 {prompt:'A restaurant site with a menu, opening hours and a reservation form that saves bookings',followUp:'Make the design dark and elegant',expect:/menu/i},
 {prompt:'A habit tracker with sign-in, daily check-ins and a streak counter',followUp:'Add a weekly progress bar chart',expect:/habit|streak/i},
 {prompt:'A tour operator page listing day trips with filters by price and duration',followUp:'Add an FAQ accordion',expect:/tour|trip/i},
 {prompt:'An internal dashboard for a gym showing members, classes and revenue cards',followUp:'Add a members table with search',expect:/member/i}
];

async function main(){
 if(!process.env.OPENROUTER_API_KEY&&!process.env.EXPLABS_API_KEY)throw Error('Set OPENROUTER_API_KEY (and KAIROQ_BUILDER_MODE / KAIROQ_BUILDER_PAID_APPROVED) first.');
 const {callBuilderModel}=require('../server');
 const builder=require('../react-builder'),backend=require('../react-backend');
 const {chromium}=require('playwright-core');
 const server=http.createServer(async(req,res)=>{if(await backend.handle(req,res))return;if(builder.handlePreview(req,res))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const executablePath=[process.env.CHROMIUM_PATH,'/opt/pw-browsers/chromium','/usr/bin/chromium'].find(p=>p&&fs.existsSync(p));
 const browser=await chromium.launch(executablePath?{executablePath}:{});
 const cases=CASES.slice(0,Number(flag('--limit',CASES.length)));
 const results=[];
 for(const c of cases){
  const row={prompt:c.prompt,steps:[]};
  const meta=builder.create({name:c.prompt.slice(0,40),owner:'quality-check'});
  await builder.initialize(meta);
  for(const [label,text] of [['build',c.prompt],['follow-up',c.followUp]]){
   const started=Date.now(),step={label};
   try{
    const r=await builder.edit(meta.id,text,{callModel:callBuilderModel});
    Object.assign(step,{ok:true,attempts:r.attempts,changed:r.changed.length,seconds:Math.round((Date.now()-started)/1000)});
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(String(e).slice(0,200)));
    await page.goto(origin+builder.previewUrl(builder.loadMeta(meta.id)),{waitUntil:'networkidle',timeout:30000});
    const body=(await page.locator('body').innerText()).trim();
    step.rendered=body.length>40;step.on_topic=c.expect.test(body);step.page_errors=errors;
    const shot=path.join(tmp,meta.id+'-'+label+'.png');await page.screenshot({path:shot,fullPage:true});step.screenshot=shot;
    await page.close();
   }catch(e){Object.assign(step,{ok:false,error:String(e.message||e).slice(0,400),seconds:Math.round((Date.now()-started)/1000)})}
   row.steps.push(step);
   console.log((step.ok&&step.rendered&&!step.page_errors?.length?'PASS':'FAIL').padEnd(5),label.padEnd(10),String(step.seconds+'s').padEnd(5),'attempts='+(step.attempts||'-'),c.prompt.slice(0,60),step.error?'\n      '+step.error:'',step.page_errors?.length?'\n      page errors: '+step.page_errors.join(' | '):'');
  }
  results.push(row);
 }
 await browser.close();server.close();
 const steps=results.flatMap(r=>r.steps),passed=steps.filter(s=>s.ok&&s.rendered&&!s.page_errors?.length).length;
 const summary={passed,total:steps.length,first_try:steps.filter(s=>s.attempts===1).length,average_seconds:Math.round(steps.reduce((n,s)=>n+(s.seconds||0),0)/Math.max(1,steps.length)),screenshots:tmp};
 console.log('\n'+JSON.stringify(summary,null,1));
 fs.writeFileSync(flag('--out','quality-report.json'),JSON.stringify({summary,results},null,1));
 process.exit(passed===steps.length?0:1);
}
main().catch(e=>{console.error(e.message||e);process.exit(2)});
