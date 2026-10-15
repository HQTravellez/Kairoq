'use strict';
// Builds the Travellez showcase (website + app) through Kairoq's own pipeline, with the
// files in templates/travellez as the model's reply: build, browser test, timeline,
// saved journeys on desktop and phone, publish and screenshots.
// Usage: node scripts/showcase-travellez.js <output dir> [port]
const fs=require('fs'),path=require('path'),http=require('http');
const out=path.resolve(process.argv[2]||'travellez-showcase');fs.mkdirSync(out,{recursive:true});
process.env.KAIROQ_REACT_PROJECTS_DIR=process.env.KAIROQ_REACT_PROJECTS_DIR||path.join(out,'projects');
process.env.KAIROQ_DESIGN_BRIEF='off';
const builder=require('../react-builder'),backend=require('../react-backend'),hosting=require('../react-hosting'),runtime=require('../runtime-check'),checks=require('../react-checks');
const dir=path.join(__dirname,'..','templates','travellez');
function read(d,rel=''){const o={};for(const n of fs.readdirSync(path.join(d,rel))){const r=rel?rel+'/'+n:n;if(fs.statSync(path.join(d,r)).isDirectory())Object.assign(o,read(d,r));else o[r]=fs.readFileSync(path.join(d,r),'utf8')}return o}
(async()=>{
 const server=http.createServer(async(req,res)=>{if(await backend.handle(req,res))return;if(builder.handlePreview(req,res))return;if(hosting.handlePath(req,res))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(Number(process.argv[3])||0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const meta=builder.create({name:'Travellez'});await builder.initialize(meta);
 const files=read(dir);
 const plan=['Marketing site: Home, Platform, Smart Itinerary, Industries, About, Pricing with a talk-to-sales form','Workspace app behind sign-in: dashboard, trips, approvals, spend, travelers, controls','SQL tables and a travel server function that enforces requested → approved → booked and draft → submitted → paid','Policy checks: trip cap, booking ahead, automatic approval for small in-policy trips'];
 const reply=JSON.stringify({plan,message:'Built Travellez: the marketing website and the signed-in travel workspace with approvals, spend and policy controls.',files});
 const callModel=async(opts,parse)=>{opts.onReasoning&&opts.onReasoning('','Travellez is a corporate travel and spend platform: a marketing site plus a workspace for travelers, managers and finance. I will keep the workflow rules in SQL inside one server function so the UI cannot skip a state.');opts.onToken&&opts.onToken(reply,reply);return parse(reply)};
 const t0=Date.now();
 const r=await builder.edit(meta.id,'Build the Travellez website and app',{callModel,checkRuntime:u=>runtime.check(base+u),inspect:(u,o)=>runtime.inspect(base+u,o),onProgress:s=>console.log('·',s)});
 console.log('built version',r.version,'in',Math.round((Date.now()-t0)/1000)+'s','runtime errors',r.runtime_errors);
 console.log('timeline',r.timeline.map(e=>e.t+(e.file?':'+e.file:'')+(e.ok===false?'(failed)':'')).join(', ').slice(0,600));
 // The user journeys, as saved checks: run on desktop and on a phone.
 const J=[
  {name:'Website navigation',path:'#/',steps:[{action:'expect',text:'Business travel that'},{action:'goto',path:'#/platform'},{action:'expect',text:'Five surfaces'},{action:'goto',path:'#/smart-itinerary'},{action:'expect',text:'Suggested budget per person'},{action:'expect',text:'2 nights'},{action:'goto',path:'#/pricing'},{action:'expect',text:'Talk to sales'}]},
  {name:'Talk to sales',path:'#/pricing',steps:[{action:'fill',label:'Your name',value:'Test Lead'},{action:'fill',label:'Work email',value:'test-lead@example.com'},{action:'fill',label:'Company',value:'Acme'},{action:'select',label:'Team size',value:'11-50'},{action:'click',text:'Send request'},{action:'expect',text:'We received your request'}]},
  {name:'Create workspace, request, approve and book a trip',path:'#/app',steps:[{action:'fill',label:'Your name',value:'Test Manager'},{action:'fill',label:'Work email',value:'test-manager@example.com'},{action:'fill',label:'Password',value:'password123'},{action:'click',role:'button',text:'Create workspace'},{action:'click',text:'Load sample data'},{action:'expect',text:'Upcoming trips'},{action:'goto',path:'#/app/approvals'},{action:'click',role:'button',text:'Approve'},{action:'expect',text:'Trip approved'},{action:'goto',path:'#/app/trips'},{action:'click',role:'button',text:'Mark as booked'},{action:'expect',text:'Trip booked'}]}
 ];
 for(const j of J)checks.save(meta.id,j,{source:'showcase'});
 const fresh=builder.loadMeta(meta.id),url=builder.previewUrl(fresh);
 const insp=(u,o)=>runtime.inspect(base+u,o);
 const desk=await checks.run(meta.id,url,{inspect:insp,version:fresh.current_version});
 const phone=await checks.run(meta.id,url,{inspect:insp,version:fresh.current_version,viewport:'phone',record:false});
 console.log('journeys desktop',desk.passed+'/'+desk.ran,'phone',phone.passed+'/'+phone.ran,JSON.stringify([...desk.failed,...phone.failed]));
 const pub=hosting.publish(meta.id,{slug:'travellez'});
 const live=await runtime.check(base+'/sites/'+pub.published.slug+'/');
 console.log('published',base+'/sites/'+pub.published.slug+'/','live errors',live.errors);
 // Screenshots of the website and the app, desktop and phone.
 const b=await runtime.browser();
 const shots=[['home','#/'],['platform','#/platform'],['smart-itinerary','#/smart-itinerary'],['industries','#/industries'],['pricing','#/pricing'],['about','#/about']];
 for(const [w,h,tag] of [[1440,900,'desktop'],[390,844,'phone']]){
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,...(tag==='phone'?{isMobile:true,hasTouch:true}:{})});
  const p=await ctx.newPage();
  for(const [name,hash] of shots){await p.goto(base+'/sites/travellez/'+hash,{waitUntil:'load'});await p.waitForLoadState('networkidle',{timeout:6000}).catch(()=>{});await p.waitForTimeout(1500);await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=500){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,120))}window.scrollTo(0,0)});await p.waitForTimeout(700);await p.screenshot({path:path.join(out,tag+'-'+name+'.png'),fullPage:tag==='desktop'&&name!=='home'?false:false})}
  // The app: sign up, load the sample company, visit each screen.
  await p.goto(base+'/sites/travellez/#/app',{waitUntil:'load'});await p.waitForTimeout(800);
  await p.getByLabel('Your name').fill('Maya Chen');await p.getByLabel('Work email').fill('maya-'+tag+'@example.com');await p.getByLabel('Password').fill('password123');
  await p.getByRole('button',{name:'Create workspace'}).click();await p.waitForTimeout(1200);
  await p.screenshot({path:path.join(out,tag+'-app-welcome.png')});
  await p.getByText('Load sample data').click();await p.waitForTimeout(1500);
  for(const [name,hash] of [['app-dashboard','#/app'],['app-trips','#/app/trips'],['app-approvals','#/app/approvals'],['app-spend','#/app/spend'],['app-travelers','#/app/travelers'],['app-controls','#/app/controls']]){await p.goto(base+'/sites/travellez/'+hash);await p.waitForTimeout(1200);await p.screenshot({path:path.join(out,tag+'-'+name+'.png')})}
  if(tag==='desktop'){await p.goto(base+'/sites/travellez/#/app/trips');await p.waitForTimeout(800);await p.getByRole('button',{name:'Request a trip'}).first().click();await p.waitForTimeout(600);await p.screenshot({path:path.join(out,'desktop-app-new-trip.png')})}
  await ctx.close();
 }
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({project:meta.id,version:r.version,timeline:r.timeline,runtime_errors:r.runtime_errors,journeys:{desktop:desk,phone},published:base+'/sites/travellez/',live_errors:live.errors},null,2));
 console.log('screenshots in',out);
 if(process.argv[3]){console.log('serving at',base+'/sites/travellez/','(Ctrl+C to stop)');return}
 await runtime.close();server.close();
})().catch(e=>{console.error('FAILED',e);process.exit(1)});
