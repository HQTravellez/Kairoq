"use strict";
// The live guard: every hour (KAIROQ_GUARD_HOURS) Kairoq's own browser opens each published
// app and walks it the way a customer would: the live home page must show, and every saved
// check (book, sign up, order...) must pass on the published version, against a test copy of
// the data. When something is broken it is checked once more (to rule out a hiccup), then
// Kairoq acts on its own, in this order:
//   1. back to the last version that passed (when the break came with a newer publish);
//   2. a repair: the AI fixes the problem, the fix must pass every check in the browser, and only
//      then is it published (on Kairoq, at most KAIROQ_GUARD_REPAIRS_PER_DAY a day per app, and
//      only when there are no unpublished changes, so nothing half-finished goes live);
//   3. a person: the owner (and KAIROQ_ALERT_EMAIL, when set) gets one email saying exactly what
//      is broken and what Kairoq tried, and another when it works again.
// The owner can switch the automatic repair off per app (meta.guard_settings.autofix=false).
// A working app also gets a saved check for each of its customer flows (feature-checks.js), so
// the guard protects everything the app offers.
const builder=require('./react-builder');

const HISTORY=30;
function repairsPerDay(){const n=Number(process.env.KAIROQ_GUARD_REPAIRS_PER_DAY??2);return Number.isInteger(n)&&n>=0?n:2}
function autofixOn(meta){return process.env.KAIROQ_GUARD_AUTOFIX!=='off'&&!(meta.guard_settings&&meta.guard_settings.autofix===false)}
// Problems that mean customers cannot use the app (not a stray console message).
function serious(errors){return(errors||[]).filter(e=>/^(Blank page|Page did not load|Uncaught error|HTTP 5\d\d)/.test(String(e)))}
function liveSitePath(meta){return'/sites/'+meta.published.slug+'/'}
function paused(meta){return Boolean(meta.hosting_billing&&meta.hosting_billing.paused)}

// One look at a version: the page (live address for the published version, else its preview)
// and the saved checks. Returns {ok, page:[...], checks:[...], skipped}.
async function probe(id,n,{checkRuntime,inspect,live=false}){
 const meta=builder.loadMeta(id),checks=require('./react-checks');
 await builder.ensureBuilt(id,n);
 const out={ok:true,page:[],checks:[],skipped:false};
 if(checkRuntime){
  const r=await checkRuntime(live?liveSitePath(meta):builder.previewUrl(meta,n),live?{fast:true}:undefined);
  if(r.skipped)out.skipped=true;else out.page=serious(r.errors);
 }
 if(inspect){
  const r=await checks.run(id,builder.previewUrl(meta,n),{inspect,version:n,record:live});
  if(r.skipped)out.skipped=true;else out.checks=r.failed;
 }
 out.ok=!out.page.length&&!out.checks.length;
 return out;
}
function describe(p){
 const lines=[];
 for(const e of p.page)lines.push('- The page: '+String(e).slice(0,300));
 if(p.checks.length)lines.push(require('./react-checks').failureText(p.checks));
 return lines.join('\n');
}
function note(id,patch,event){
 const meta=builder.loadMeta(id),g=meta.guard||{};
 Object.assign(g,patch);
 if(event)g.history=[{at:new Date().toISOString(),...event},...(g.history||[])].slice(0,HISTORY);
 meta.guard=g;builder.saveMeta(meta);return g;
}
async function tell(meta,subject,text,{send,alsoAlert=false}){
 const extras=require('./react-backend-extras'),to=extras.ownerEmail(meta),deliver=send||extras.deliver;
 if(to)try{await deliver(to,subject,text)}catch{}
 const ops=process.env.KAIROQ_ALERT_EMAIL;
 if(alsoAlert&&ops&&ops!==to)try{await deliver(ops,'[Kairoq live guard] '+subject,text+'\n\nProject: '+meta.id+' ('+meta.name+')')}catch{}
}

// The AI repairs the published version; the result must pass everything before it goes live.
async function repair(id,n,problem,{callModel,checkRuntime,inspect,exclusive}){
 const message='The published app is broken for customers. Kairoq\'s browser found:\n'+problem+'\nFix the cause so the page shows and every flow works again. Change only what is needed for that; keep everything else as it is.';
 const r=await exclusive(id,()=>builder.edit(id,message,{callModel,checkRuntime,inspect,tier:'standard',displayText:'Live guard: repair the published app',extra:{guard:true}}));
 if(!r||r.rolled_back||!r.version||r.version===n)return{ok:false,why:'the AI could not make a working version'};
 const after=await probe(id,r.version,{checkRuntime,inspect});
 if(!after.ok)return{ok:false,why:'the repaired version still failed: '+describe(after).slice(0,300),version:r.version};
 return{ok:true,version:r.version};
}

async function guardOne(id,deps){
 const {checkRuntime,inspect,send,now=Date.now()}=deps;
 let meta=builder.loadMeta(id);
 const n=meta.published&&meta.published.version;
 if(!n||paused(meta))return null;
 const g=meta.guard||{};
 let p=await probe(id,n,{checkRuntime,inspect,live:true});
 if(p.skipped)return{skipped:true};
 // A failure is confirmed by a second look a little later, so a hiccup never triggers a repair.
 if(!p.ok){await new Promise(r=>setTimeout(r,deps.retryMs??15000));p=await probe(id,n,{checkRuntime,inspect,live:true})}
 const at=new Date(now).toISOString();
 if(p.ok){
  const was=g.incident;
  note(id,{at,ok:true,version:n,last_good:n,incident:null},was?{kind:'recovered',version:n}:null);
  if(was&&was.told){meta=builder.loadMeta(id);await tell(meta,meta.name+' works again','Kairoq\'s browser checked '+meta.name+' and everything works again (version '+n+').',{send,alsoAlert:true})}
  // A working app gets a check for every customer flow, once per published version.
  if(deps.callModel&&inspect&&!(deps.busy&&deps.busy(id)))try{await require('./feature-checks').ensure(id,{callModel:deps.callModel,inspect})}catch(e){console.warn('[feature-checks]',e.message)}
  return{ok:true};
 }
 const problem=describe(p);
 const incident=g.incident&&g.incident.version===n?g.incident:{since:at,version:n,tried:[]};
 incident.problem=problem.slice(0,2000);
 note(id,{at,ok:false,version:n,incident},g.incident?null:{kind:'broken',version:n,problem:problem.slice(0,500)});

 // 1. Back to the last version that passed, when a newer one was published since.
 if(g.last_good&&g.last_good!==n&&builder.loadMeta(id).versions.some(v=>v.n===g.last_good)&&!incident.tried.includes('rollback:'+g.last_good)){
  incident.tried.push('rollback:'+g.last_good);
  const back=await probe(id,g.last_good,{checkRuntime,inspect});
  if(back.ok){
   require('./react-hosting').publish(id,{version:g.last_good});
   note(id,{ok:true,version:g.last_good,incident:null},{kind:'rolled_back',from:n,version:g.last_good});
   meta=builder.loadMeta(id);
   await tell(meta,meta.name+': Kairoq put back the version that worked','Kairoq\'s browser found that version '+n+' of '+meta.name+' was broken for customers:\n\n'+problem+'\n\nIt put version '+g.last_good+' back live, which passes every check. Your changes in version '+n+' are kept: open the project to fix them and publish again.',{send});
   return{ok:true,rolled_back:g.last_good};
  }
  note(id,{incident});
 }
 // 2. A repair, when allowed and when nothing unpublished would go live with it.
 meta=builder.loadMeta(id);
 const today=at.slice(0,10),used=(g.repairs||[]).filter(d=>d===today).length;
 const drafts=meta.current_version!==n;
 let why='';
 if(!autofixOn(meta))why='automatic repair is switched off for this app';
 else if(drafts)why='there are unpublished changes, so Kairoq did not publish a repair on top of them';
 else if(used>=repairsPerDay())why='Kairoq already tried '+used+' repair'+(used===1?'':'s')+' today';
 else if(deps.busy&&deps.busy(id))why='the project was being changed at the time';
 else if(!deps.callModel||!deps.exclusive)why='repairs are not available on this server';
 if(!why){
  note(id,{repairs:[...(g.repairs||[]).filter(d=>d===today),today]});
  incident.tried.push('repair');
  let r;try{r=await repair(id,n,problem,deps)}catch(e){r={ok:false,why:String(e.message||e).slice(0,200)}}
  if(r.ok){
   require('./react-hosting').publish(id,{version:r.version});
   note(id,{ok:true,version:r.version,last_good:r.version,incident:null},{kind:'repaired',from:n,version:r.version});
   meta=builder.loadMeta(id);
   await tell(meta,meta.name+': Kairoq fixed a problem on your live app','Kairoq\'s browser found a problem on '+meta.name+':\n\n'+problem+'\n\nIt repaired it, checked every flow again in the browser, and published the fix as version '+r.version+'. Nothing for you to do; this repair was free.',{send,alsoAlert:Boolean(incident.told)});
   return{ok:true,repaired:r.version};
  }
  why=r.why;
 }
 // 3. A person: once per incident.
 if(!incident.told){
  incident.told=at;note(id,{incident},{kind:'escalated',version:n,why});
  meta=builder.loadMeta(id);
  await tell(meta,meta.name+': your live app needs attention','Kairoq\'s browser found that '+meta.name+' is not working for customers:\n\n'+problem+'\n\nKairoq could not fix it on its own ('+why+'). Open the project in Kairoq and use "Fix it", or restore an earlier version. Kairoq keeps checking every hour and will tell you when it works again.',{send,alsoAlert:true});
 }else note(id,{incident});
 return{ok:false,escalated:true,why};
}

let running=false;
async function guardAll(deps={}){
 if(running)return[];
 running=true;const out=[];
 try{
  for(const p of builder.list()){
   let meta;try{meta=builder.loadMeta(p.id)}catch{continue}
   if(!meta.published||!meta.published.version)continue;
   try{const r=await guardOne(p.id,deps);if(r&&r.skipped)break;if(r)out.push({id:p.id,...r})}
   catch(e){out.push({id:p.id,ok:false,error:String(e.message||e).slice(0,200)})}
  }
 }finally{running=false}
 return out;
}
function view(meta){
 const g=meta.guard||{};
 return{checked_at:g.at||null,ok:g.ok??null,version:g.version||null,last_good:g.last_good||null,incident:g.incident?{since:g.incident.since,problem:g.incident.problem,told:Boolean(g.incident.told)}:null,history:(g.history||[]).slice(0,10),autofix:autofixOn(meta),coverage:require('./feature-checks').view(meta),hours:Number(process.env.KAIROQ_GUARD_HOURS??1)};
}
function settings(id,{autofix}){const meta=builder.loadMeta(id);meta.guard_settings={...(meta.guard_settings||{}),autofix:Boolean(autofix)};builder.saveMeta(meta);return view(meta)}
module.exports={guardAll,guardOne,probe,serious,view,settings};
