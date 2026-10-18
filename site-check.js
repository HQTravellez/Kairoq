"use strict";
// Free website check: anyone pastes a link to their site and an email. Kairoq opens the site in a
// real browser on desktop and phone, works out what a visitor comes to do, sends a few AI
// customers through it and writes a report: a score, how many reached the goal, where the others
// gave up and why, technical problems in plain English, and a "Rebuild it with Kairoq" button.
//
// Every check costs model calls, so it is guarded: an email is required, a few checks per IP and
// per email a day, one fresh check per website a day (asking again returns the saved report), a
// daily cap for the whole server, the cheapest model tier and a handful of visitors.
// KAIROQ_SITE_CHECK=off turns it off.
const fs=require('fs'),path=require('path'),crypto=require('crypto');

const DAY=86400000;
function enabled(){return String(process.env.KAIROQ_SITE_CHECK||'on').toLowerCase()!=='off'}
function intEnv(k,d){const n=Number(process.env[k]);return Number.isFinite(n)&&n>=0?Math.floor(n):d}
function visitors(){return Math.max(2,Math.min(10,intEnv('KAIROQ_SITE_CHECK_VISITORS',5)))}
function tier(){return process.env.KAIROQ_SITE_CHECK_TIER||'standard'}
function dir(){return process.env.KAIROQ_SITE_CHECKS_DIR||path.join(path.dirname(require('./react-builder').ROOT()),'site-checks')}
function clip(v,n){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
function hash(v){return crypto.createHash('sha256').update('kairoq-site-check:'+String(v||'').toLowerCase()).digest('hex').slice(0,24)}
function err(message,status){return Object.assign(Error(message),{status})}

// ---------- storage ----------
// index.json: one line per check (no emails or IPs in clear), newest first, for limits and the cache.
// leads.jsonl: who asked for which site, for the owner. <id>.json: the report. <id>-desktop.jpg etc.
function indexFile(){return path.join(dir(),'index.json')}
function readIndex(){try{return JSON.parse(fs.readFileSync(indexFile(),'utf8'))}catch{return[]}}
function writeIndex(list){fs.mkdirSync(dir(),{recursive:true});fs.writeFileSync(indexFile(),JSON.stringify(list.slice(0,3000)))}
function setEntry(id,patch){const list=readIndex(),e=list.find(x=>x.id===id);if(e){Object.assign(e,patch);writeIndex(list)}return e}
function reportFile(id){if(!/^[a-f0-9]{24}$/.test(String(id)))throw err('Unknown check',404);return path.join(dir(),id+'.json')}
function load(id){try{return JSON.parse(fs.readFileSync(reportFile(id),'utf8'))}catch(e){if(e.status)throw e;throw err('Unknown check',404)}}
function shotFile(id,name){if(!['desktop','phone'].includes(name))throw err('Unknown screenshot',404);reportFile(id);return path.join(dir(),id+'-'+name+'.jpg')}
function leads(limit=200){
 try{return fs.readFileSync(path.join(dir(),'leads.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)).reverse().slice(0,limit)}catch{return[]}
}

// Live progress of running checks (the report file appears when one finishes).
const running=new Map();

function normalizeEmail(e){
 const t=String(e||'').trim().toLowerCase();
 if(t.length>200||!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t))throw err('Enter your email address so we can send you the report',400);
 return t;
}

// ---------- understanding the site ----------
const UNDERSTAND_PROMPT=`You look at the home page of a website and say what it is for.
Respond with ONLY JSON: {"business":"one short sentence: what this business or site is","audience":"who its visitors are, in a few words","goal":"the single main thing a visitor comes to do here, as a task a person could complete on the site (for example: book a room for two nights next month, find the price of a haircut and book it, buy a gift under 50 euros, get in touch about a project)"}
Base it only on the page. Keep each field under 200 characters.`;
async function understand(page,given,{callModel,signal}){
 const fallback={business:clip(page.title,200)||'This website',audience:'People who found this site and want what it offers',goal:'Find out what is offered and how to get it (book, buy or get in touch)'};
 try{
  const v=await callModel({messages:[{role:'system',content:UNDERSTAND_PROMPT},{role:'user',content:'Title: '+clip(page.title,200)+'\n\nVisible text:\n'+String(page.text||'').slice(0,2500)+'\n\nButtons and links: '+page.elements.slice(0,40).map(e=>e.label).filter(Boolean).join(' | ').slice(0,1500)}],temperature:0.2,maxOutputTokens:400,signal,tier:tier()},c=>{const t=String(c||'').replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');const a=t.indexOf('{'),b=t.lastIndexOf('}');return JSON.parse(t.slice(a,b+1))});
  return{business:clip(v.business,200)||fallback.business,audience:clip(v.audience,200)||fallback.audience,goal:given||clip(v.goal,200)||fallback.goal};
 }catch(e){if(signal&&signal.aborted)throw e;return{...fallback,goal:given||fallback.goal}}
}

// ---------- technical findings ----------
// Plain facts from the browser, each a pass or a problem with what it means for visitors.
function technical(desktop,phone){
 const out=[],add=(ok,title,detail)=>out.push({ok,title,detail});
 const d=desktop||{},p=phone||{};
 if(d.load_ms!=null)add(d.load_ms<3000,d.load_ms<3000?'Loads quickly':'Slow to load','The page took '+(d.load_ms/1000).toFixed(1)+' seconds to load on a fast connection.'+(d.load_ms<3000?'':' Many visitors leave after three seconds, more on phones.'));
 add(Boolean(p.viewport),p.viewport?'Set up for phones':'Not set up for phones',p.viewport?'The page tells phones to show it at their own width.':'The page has no phone viewport setting, so phones show a tiny zoomed-out desktop page.');
 if(p.overflow!=null)add(p.overflow<=4,p.overflow<=4?'Fits the phone screen':'Wider than the phone screen',p.overflow<=4?'Nothing sticks out sideways on a phone.':'Part of the page is '+p.overflow+' pixels wider than a phone, so visitors have to scroll sideways.');
 if(p.small_text!=null)add(p.small_text<=5,p.small_text<=5?'Text is readable on phones':'Small text on phones',p.small_text<=5?'Text is large enough to read without zooming.':p.small_text+' pieces of text are smaller than 12 pixels on a phone, which is hard to read.');
 add(Boolean(d.title&&d.title.length>=10),d.title&&d.title.length>=10?'Has a page title':'Weak page title',d.title?'The browser tab and Google show: "'+clip(d.title,80)+'".':'The page has no title, so Google and the browser tab show nothing useful.');
 add(Boolean(d.description),d.description?'Has a search description':'No search description',d.description?'Google can show your own summary under the link.':'Google picks random text from the page for the summary under your link.');
 add(d.h1===1,d.h1===1?'One main heading':d.h1?'Several main headings':'No main heading',d.h1===1?'The page has one clear main heading, which helps Google and screen readers.':d.h1?'The page has '+d.h1+' main headings; one is clearer for Google and screen readers.':'The page has no main heading, which makes it harder for Google and screen readers to understand.');
 if(d.images)add(d.images_no_alt===0,d.images_no_alt===0?'Images are described':'Images without descriptions',d.images_no_alt===0?'Every main image has a text description.':d.images_no_alt+' of '+d.images+' images have no text description, so blind visitors and Google cannot tell what they show.');
 return out;
}
// 0-100: mostly whether visitors reached their goal, then the technical basics.
// When the site's bot protection turned every AI customer away, journeys could not be judged,
// so the score comes from the technical basics only.
function score(numbers,tech){
 const passed=tech.length?tech.filter(t=>t.ok).length/tech.length:0;
 if(numbers&&numbers.visitors&&numbers.blocked>=numbers.visitors)return Math.round(passed*100);
 const goal=numbers&&numbers.visitors?numbers.completion_rate:0;
 return Math.round(goal*0.7+passed*30);
}

// ---------- the check ----------
// opts: {url, email, goal, ip}. deps: {callModel, browseSite, origin, mail}.
// Returns {id, status, cached}. The report is written when the run finishes.
async function start(opts,deps){
 if(!enabled())throw err('The free website check is turned off on this server',503);
 const runtime=require('./runtime-check');
 if(!deps.browseSite&&!runtime.available())throw err('The website check needs a browser (Chromium) on this server',503);
 if(!deps.callModel)throw err('The website check needs an AI model on this server',503);
 const email=normalizeEmail(opts.email);
 const url=await runtime.checkSite(opts.url),host=new URL(url).hostname.replace(/^www\./,'');
 const goal=clip(opts.goal,200);
 const now=Date.now(),list=readIndex(),ipH=hash(opts.ip),emailH=hash(email);
 // Asking again about the same site the same day (without a new goal) returns the saved report.
 const same=list.find(x=>x.host===host&&((x.status==='running'&&running.has(x.id))||x.status==='complete')&&now-Date.parse(x.at)<DAY&&(!goal||x.goal===goal));
 if(same){appendLead({email,url,id:same.id,at:new Date().toISOString(),cached:true});return{id:same.id,status:same.status,cached:true}}
 const today=list.filter(x=>now-Date.parse(x.at)<DAY);
 if(today.filter(x=>x.ip===ipH).length>=intEnv('KAIROQ_SITE_CHECK_PER_IP',3))throw err('You have used today\'s free checks. Try again tomorrow, or sign up and test any site from the editor.',429);
 if(today.filter(x=>x.email===emailH).length>=intEnv('KAIROQ_SITE_CHECK_PER_EMAIL',3))throw err('This email has used today\'s free checks. Try again tomorrow.',429);
 if(today.length>=intEnv('KAIROQ_SITE_CHECK_DAILY',40))throw err('Today\'s free website checks are used up. Try again tomorrow, or sign up and test it from the editor.',503);
 const id=crypto.randomBytes(12).toString('hex');
 list.unshift({id,host,url,goal,at:new Date().toISOString(),ip:ipH,email:emailH,status:'running'});writeIndex(list);
 appendLead({email,url,id,at:new Date().toISOString()});
 const state={id,url,host,status:'running',progress:'Opening '+host,started:now};running.set(id,state);
 setImmediate(()=>run(state,{email,goal},deps).catch(()=>{}));
 return{id,status:'running',cached:false};
}
function appendLead(l){try{fs.mkdirSync(dir(),{recursive:true});fs.appendFileSync(path.join(dir(),'leads.jsonl'),JSON.stringify(l)+'\n')}catch{}}

async function look(url,device,browseSite){
 const s=await browseSite(url,{site:true,viewport:device});
 if(!s)throw err('No browser available',503);
 try{
  const page=await s.observe(),facts=s.audit?await s.audit():null,shot=s.screenshot?await s.screenshot():null;
  return{page,facts,shot};
 }finally{await s.close()}
}
async function run(state,{email,goal},{callModel,browseSite,origin,mail}){
 browseSite=browseSite||((u,o)=>require('./runtime-check').session(u,o));
 const progress=t=>{state.progress=t};
 try{
  progress('Opening '+state.host+' on desktop and phone');
  const desktop=await look(state.url,'desktop',browseSite),phone=await look(state.url,'phone',browseSite).catch(()=>({page:null,facts:null,shot:null}));
  fs.mkdirSync(dir(),{recursive:true});
  for(const [name,v] of [['desktop',desktop],['phone',phone]])if(v.shot)fs.writeFileSync(shotFile(state.id,name),Buffer.from(v.shot,'base64'));
  progress('Working out what visitors come to do');
  const about=await understand(desktop.page,goal,{callModel});
  const count=visitors();
  progress('Sending '+count+' AI customers through the site');
  const r=await require('./synthetic-customers').run('site-check',state.url,{audience:about.audience,goal:about.goal,count},{callModel,tier:tier(),site:true,browseSite,onProgress:p=>progress(p.text)});
  const tech=technical(desktop.facts,phone.facts);
  const report={
   id:state.id,url:state.url,host:state.host,at:new Date().toISOString(),...about,
   score:score(r.numbers,tech),numbers:r.numbers,...(r.numbers.visitors&&r.numbers.blocked>=r.numbers.visitors?{blocked:true}:{}),summary:r.summary,technical:tech,
   problems:(r.problems||[]).filter(p=>p.status==='confirmed').slice(0,6).map(p=>({title:p.title,path:p.path,device:p.device,visitors:p.visitors.length})),
   // The visitors' own words, shortened: who they were, what happened and what they thought.
   visits:r.visits.filter(v=>v.outcome!=='skipped').map(v=>({name:v.persona.name,age:v.persona.age,device:v.persona.device,about:v.persona.about,outcome:v.outcome,...(v.verdict&&!v.verdict.ok?{judged:v.verdict.reason}:{}),steps:v.steps.slice(0,20).map(s=>({path:s.path,thought:s.thought,feeling:s.feeling,action:s.action,label:s.label||''}))})),
   shots:['desktop','phone'].filter(n=>fs.existsSync(shotFile(state.id,n)))
  };
  fs.writeFileSync(reportFile(state.id),JSON.stringify(report));
  setEntry(state.id,{status:'complete',score:report.score});
  state.status='complete';
  if(mail&&origin)mail(email,'Your website check for '+state.host+': '+report.score+'/100',
   'Your free website check is ready.\n\n'+(report.summary.headline||'')+'\n'+report.numbers.completed+' of '+report.numbers.visitors+' AI customers managed to '+report.goal.toLowerCase().replace(/\.$/,'')+'.\n\nSee the full report, with what to fix:\n'+origin+'/create/check/'+state.id+'\n\nKairoq can rebuild the site with these problems fixed, tested in a real browser before you pay.').catch(()=>{});
 }catch(e){
  state.status='failed';state.error=clip(e.message||e,300);
  setEntry(state.id,{status:'failed'});
 }finally{
  setTimeout(()=>running.delete(state.id),600000).unref?.();
 }
}

// What anyone with the link sees: the report, or the progress while it runs.
function view(id){
 const live=running.get(id);
 if(live&&live.status==='running')return{id,status:'running',host:live.host,progress:live.progress};
 if(live&&live.status==='failed')return{id,status:'failed',host:live.host,error:'We could not finish checking '+live.host+': '+live.error};
 const e=readIndex().find(x=>x.id===id);
 if(e&&e.status==='failed')return{id,status:'failed',host:e.host,error:'We could not finish checking '+e.host+'. The site may block automated browsers or be down.'};
 if(e&&e.status==='running'&&!live)return{id,status:'failed',host:e.host,error:'This check was interrupted. Start it again.'};
 return{status:'complete',...load(id)};
}
// For the owner: recent checks with the email that asked.
function adminList(limit=100){
 const idx=new Map(readIndex().map(x=>[x.id,x]));
 return leads(limit).map(l=>{const e=idx.get(l.id)||{};return{at:l.at,email:l.email,url:l.url,id:l.id,cached:Boolean(l.cached),status:e.status||'unknown',score:e.score??null}});
}
module.exports={start,view,load,shotFile,adminList,technical,score,understand,enabled,visitors,dir};
