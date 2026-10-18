"use strict";
// Web agent for business owners: "go to this website and find out …" in a real browser, and
// watches that repeat a task on a schedule and email the owner when the answer changes
// (competitor prices, a supplier's stock, opening hours, a listing).
//
// It is the browser agent (browser-agent.js) in task mode on the guarded external browser:
// public https sites only, never a form sent, no logins. Each run costs credits
// (KAIROQ_WEB_TASK_CREDITS, default 2); the Kairoq owner's runs are free.
const fs=require('fs'),path=require('path'),crypto=require('crypto');

const DAY=86400000,WEEK=7*DAY;
function intEnv(k,d,min=0,max=1e9){const n=Number(process.env[k]);return Number.isFinite(n)?Math.min(max,Math.max(min,Math.floor(n))):d}
function price(){return intEnv('KAIROQ_WEB_TASK_CREDITS',2,0,100)}
function maxSteps(){return intEnv('KAIROQ_WEB_TASK_STEPS',15,3,40)}
function fail(status,message){return Object.assign(Error(message),{status})}
function clip(v,n){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
function dir(){return process.env.KAIROQ_WEB_TASKS_DIR||path.join(path.dirname(require('./react-builder').ROOT()),'web-tasks')}
function key(owner){return crypto.createHash('sha256').update(String(owner)).digest('hex').slice(0,24)}
function file(owner){return path.join(dir(),key(owner)+'.json')}
function load(owner){try{return JSON.parse(fs.readFileSync(file(owner),'utf8'))}catch{return{owner,runs:[],watches:[]}}}
function save(state){fs.mkdirSync(dir(),{recursive:true});const f=file(state.owner),tmp=f+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(state));fs.renameSync(tmp,f)}
function free(owner){return owner==='owner'||price()===0}

const running=new Map();
function publicRun(r){return{id:r.id,url:r.url,task:r.task,status:r.status,at:r.at,...(r.watch?{watch:r.watch}:{}),...(r.progress?{progress:r.progress}:{}),...(r.outcome?{outcome:r.outcome,answer:r.answer,steps:(r.steps||[]).map(s=>({path:s.path,action:s.action,label:s.label||'',value:s.action==='fill'||s.action==='done'||s.action==='give_up'?'':s.value||'',thought:s.thought||'',...(s.error?{error:s.error}:{})})),...(r.verdict?{verdict:r.verdict}:{}),...(r.changed!==undefined?{changed:r.changed,change:r.change||''}:{})}:{}),...(r.error?{error:r.error}:{}),...(r.charged!==undefined?{charged:r.charged}:{})}}

// One run: opens the site, lets the agent work, keeps the result (last 30 runs per account).
async function execute(owner,{url,task,watch=null},{callModel,browseSite,tier,signal}={}){
 const runtime=require('./runtime-check');
 browseSite=browseSite||((u,o)=>runtime.session(u,o));
 const run={id:crypto.randomUUID(),url,task,status:'running',at:new Date().toISOString(),...(watch?{watch}:{})};
 running.set(run.id,{owner,run});
 const ref='web-task:'+run.id;
 if(!free(owner)){
  try{require('./builder-accounts').charge(owner,price(),'Web agent: '+clip(task,60),ref)}
  catch(e){running.delete(run.id);throw e.status===402?fail(402,'The web agent costs '+price()+' credits a run, and this account does not have enough.'):e}
  run.charged=price();
 }
 let s=null;
 try{
  run.progress='Opening '+new URL(url).hostname;
  s=await browseSite(url,{site:true,viewport:'desktop'});
  if(!s)throw fail(503,'The web agent needs a browser (Chromium) on this server');
  const r=await require('./browser-agent').run({session:s,goal:task,mode:'task',callModel,tier,maxSteps:maxSteps(),signal,onStep:st=>{run.progress=(st.action==='done'?'Checking the answer':st.thought||st.action)}});
  Object.assign(run,{status:'complete',outcome:r.outcome,answer:clip(r.answer||'',4000),steps:r.steps.slice(-30),...(r.verdict&&r.verdict.checked?{verdict:{ok:r.verdict.ok,reason:r.verdict.reason}}:{}),...(r.error?{error:r.error}:{})});
  // Nothing useful came back (an error, or no answer at all): the credits go back.
  if(run.charged&&(r.outcome==='error'||!run.answer)){require('./builder-accounts').grant(owner,run.charged,'Refund: web agent found nothing','refund:'+ref);run.charged=0}
 }catch(e){
  Object.assign(run,{status:'failed',error:clip(e.message||e,300)});
  if(run.charged){try{require('./builder-accounts').grant(owner,run.charged,'Refund: web agent failed','refund:'+ref)}catch{}run.charged=0}
 }finally{
  delete run.progress;
  if(s)await s.close().catch(()=>{});
  running.delete(run.id);
 }
 const st=load(owner);st.runs=[run,...st.runs.filter(x=>x.id!==run.id)].slice(0,30);save(st);
 return run;
}

// Starts a run in the background and returns it at once (the caller polls get()).
// every: 'day' | 'week' also saves a watch, with this run as its first check.
async function start(owner,{url,task,every},deps){
 const u=await require('./runtime-check').checkSite(url);
 const t=clip(task,1000);if(t.length<8)throw fail(400,'Say what the agent should find or check, e.g. "the price of a double room next weekend".');
 const today=load(owner).runs.filter(r=>Date.now()-Date.parse(r.at)<DAY).length+[...running.values()].filter(x=>x.owner===owner).length;
 if(today>=intEnv('KAIROQ_WEB_TASKS_PER_DAY',20,1,1000))throw fail(429,'That is today\'s limit for the web agent. Try again tomorrow.');
 if([...running.values()].filter(x=>x.owner===owner).length>=2)throw fail(429,'Two web agent runs are already working. Wait for one to finish.');
 const w=every?addWatch(owner,{url:u,task:t,every,next:Date.now()+(every==='day'?DAY:WEEK)}):null;
 const p=execute(owner,{url:u,task:t,watch:w&&w.id},deps).then(run=>w?record(owner,w.id,run,deps).then(()=>run):run);
 p.catch(()=>{});
 await new Promise(r=>setImmediate(r));
 const live=[...running.values()].find(x=>x.owner===owner&&x.run.url===u&&x.run.task===t);
 if(live)return{...publicRun(live.run),...(w?{watch:w.id}:{})};
 return publicRun(await p);
}
function get(owner,id){
 const live=running.get(id);if(live&&live.owner===owner)return publicRun(live.run);
 const r=load(owner).runs.find(x=>x.id===id);if(!r)throw fail(404,'Unknown run');
 return publicRun(r);
}
function list(owner){const st=load(owner);return{runs:[...[...running.values()].filter(x=>x.owner===owner).map(x=>x.run),...st.runs].slice(0,30).map(publicRun),watches:st.watches,price:free(owner)?0:price()}}

// ---------- watches ----------
function addWatch(owner,{url,task,every='week',next=Date.now()}){
 const st=load(owner);
 if(st.watches.length>=intEnv('KAIROQ_WEB_WATCHES',5,0,50))throw fail(400,'You can keep up to '+intEnv('KAIROQ_WEB_WATCHES',5,0,50)+' watches. Remove one first.');
 const t=clip(task,1000);if(t.length<8)throw fail(400,'Say what to check, e.g. "the price of their 60-minute massage".');
 const w={id:crypto.randomUUID().slice(0,8),url,task:t,every:every==='day'?'day':'week',created:new Date().toISOString(),next:new Date(next).toISOString(),last:null,last_answer:null,paused:false};
 st.watches.push(w);save(st);return w;
}
async function createWatch(owner,b){const url=await require('./runtime-check').checkSite(b.url);return addWatch(owner,{...b,url})}
function removeWatch(owner,id){const st=load(owner);const n=st.watches.length;st.watches=st.watches.filter(w=>w.id!==id);if(st.watches.length===n)throw fail(404,'Unknown watch');save(st);return{removed:id}}
function updateWatch(owner,id,patch){const st=load(owner),w=st.watches.find(x=>x.id===id);if(!w)throw fail(404,'Unknown watch');if(typeof patch.paused==='boolean'){w.paused=patch.paused;if(!patch.paused)w.next=new Date().toISOString()}save(st);return w}

const COMPARE=`You compare two answers a web agent gave to the same question on different days, for a small-business owner.
Respond with ONLY JSON: {"changed":true|false,"summary":"one or two sentences: what changed (old → new), or empty when nothing important changed"}
Only real changes count (a price, a date, availability, a new or removed item); different wording of the same facts is not a change.`;
async function compare(task,before,after,{callModel}){
 if(!before)return{changed:false,summary:''};
 try{
  const v=await callModel({messages:[{role:'system',content:COMPARE},{role:'user',content:'Question: '+clip(task,600)+'\n\nBefore:\n'+clip(before,2500)+'\n\nNow:\n'+clip(after,2500)}],temperature:0,maxOutputTokens:300},c=>{const t=String(c).trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');const a=t.indexOf('{'),b=t.lastIndexOf('}');return JSON.parse(t.slice(a,b+1))});
  return{changed:v.changed===true,summary:clip(v.summary,400)};
 }catch{return{changed:clip(before,2500)!==clip(after,2500),summary:''}}
}
async function mail(owner,subject,text){
 const accounts=require('./builder-accounts');
 const to=owner==='owner'?process.env.KAIROQ_OWNER_EMAIL:accounts.email(owner);
 if(!to||!accounts.mailReady())return false;
 await require('./react-backend-extras').deliver(to,subject,text).catch(()=>{});
 return true;
}
// After a watch's run: remember the answer, and email the owner when it changed.
async function record(owner,id,run,{callModel,now=Date.now()}={}){
 const st=load(owner),w=st.watches.find(x=>x.id===id);if(!w)return null;
 w.last=new Date(now).toISOString();w.next=new Date(now+(w.every==='day'?DAY:WEEK)).toISOString();
 let changed=false;
 if(run.status==='complete'&&run.answer&&run.outcome!=='blocked'){
  const c=await compare(w.task,w.last_answer,run.answer,{callModel});
  const r=st.runs.find(x=>x.id===run.id);if(r){r.changed=c.changed;r.change=c.summary}
  if(c.changed){changed=true;await mail(owner,'Change spotted: '+clip(w.task,60),(c.summary||'The answer changed.')+'\n\nWebsite: '+w.url+'\nQuestion: '+w.task+'\n\nNow:\n'+run.answer+(w.last_answer?'\n\nBefore:\n'+w.last_answer:'')+'\n\nSee it in Kairoq: '+(process.env.KAIROQ_PUBLIC_URL||'')+'/create')}
  w.last_answer=run.answer;
 }
 w.last_outcome=run.outcome||run.status;
 save(st);
 return{changed};
}
// Runs every watch that is due, for every account (called hourly by the server).
let ticking=false;
async function tick({callModel,browseSite,now=Date.now()}={}){
 const out={ran:0,changed:0,paused:0};
 // A slow run must not let the next hourly tick start the same watches again.
 if(ticking)return out;ticking=true;
 try{
 let files=[];try{files=fs.readdirSync(dir()).filter(f=>f.endsWith('.json'))}catch{return out}
 for(const f of files){
  let st;try{st=JSON.parse(fs.readFileSync(path.join(dir(),f),'utf8'))}catch{continue}
  for(const w of st.watches||[]){
   if(w.paused||Date.parse(w.next)>now)continue;
   let run;
   try{run=await execute(st.owner,{url:w.url,task:w.task,watch:w.id},{callModel,browseSite})}
   catch(e){
    // Out of credits: the watch pauses and the owner is told once.
    if(e.status===402){const s2=load(st.owner),w2=s2.watches.find(x=>x.id===w.id);if(w2){w2.paused=true;save(s2)}out.paused++;await mail(st.owner,'Your web watch is paused','Your watch "'+clip(w.task,80)+'" on '+w.url+' is paused: each check costs '+price()+' credits and your account does not have enough. Add credits and turn it back on in Kairoq.')}
    continue;
   }
   out.ran++;
   const r=await record(st.owner,w.id,run,{callModel,now});
   if(r&&r.changed)out.changed++;
  }
 }
 return out;
 }finally{ticking=false}
}
module.exports={start,execute,get,list,createWatch,addWatch,removeWatch,updateWatch,tick,compare,price};
