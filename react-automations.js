"use strict";
// Automations: a generated app's server functions run on their own, on a schedule or when a
// record changes, declared in src/backend.json:
//   "automations":[{"name":"reminders","run":"send-reminders","every":"day","at":"09:00","tz":"Asia/Dubai"},
//                  {"name":"welcome","run":"welcome","on":"created","collection":"bookings"}]
// The function gets a POST with { automation, trigger, at, collection, record } and the usual
// host (db, sql, email, secrets, fetch, ai, log). Runs are recorded per app (automation_runs),
// each run's log lines go to the server logs, and after three failures in a row the owner
// gets one email. A function started by an automation cannot start another one (no loops).
const DAYS=['sun','mon','tue','wed','thu','fri','sat'];
const EVERY={hour:3600000,day:86400000,week:7*86400000};
const FAIL_STREAK=3;

function normalize(list,{collections={},functions=null}={}){
 if(!Array.isArray(list)||list.length>10)throw Error('"automations" must be a list of up to 10 items.');
 const seen=new Set();
 return list.map(a=>{
  if(!a||typeof a!=='object'||!/^[a-z][a-z0-9_-]{0,39}$/.test(a.name||''))throw Error('Each automation needs a lowercase "name" (letters, numbers, - or _).');
  if(seen.has(a.name))throw Error('Automation "'+a.name+'" is listed twice.');seen.add(a.name);
  if(!/^[a-z][a-z0-9-]{0,39}$/.test(a.run||''))throw Error('Automation "'+a.name+'" needs "run": the name of a function in functions/.');
  if(functions&&!functions.includes(a.run))throw Error('Automation "'+a.name+'" runs "'+a.run+'", but there is no functions/'+a.run+'.js.');
  const out={name:a.name,run:a.run};
  if(a.on!==undefined){
   if(!['created','updated','deleted'].includes(a.on))throw Error('Automation "'+a.name+'" "on" must be created, updated or deleted.');
   if(!collections[a.collection])throw Error('Automation "'+a.name+'" uses collection "'+a.collection+'", which is not declared.');
   if(a.every!==undefined)throw Error('Automation "'+a.name+'" cannot have both "on" and "every".');
   return{...out,on:a.on,collection:a.collection};
  }
  if(!EVERY[a.every])throw Error('Automation "'+a.name+'" needs "every": hour, day or week (or "on" with a collection).');
  out.every=a.every;
  if(a.every!=='hour'){
   const m=/^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(a.at??'09:00'));
   if(!m)throw Error('Automation "'+a.name+'" needs "at" like "09:00".');
   out.at=m[1].padStart(2,'0')+':'+m[2];
   if(a.every==='week'){const d=String(a.day??'mon').toLowerCase().slice(0,3);if(!DAYS.includes(d))throw Error('Automation "'+a.name+'" needs "day": mon, tue, ... sun.');out.day=d}
   if(a.tz!==undefined){try{new Intl.DateTimeFormat('en-US',{timeZone:String(a.tz)})}catch{throw Error('Automation "'+a.name+'" has an unknown "tz" (use a name like Europe/London).')}out.tz=String(a.tz)}
  }else if(a.at!==undefined||a.day!==undefined)throw Error('Automation "'+a.name+'" runs every hour, so it cannot have "at" or "day".');
  return out;
 });
}

// Local wall-clock parts of an instant in a time zone.
function parts(ms,tz){
 const f=new Intl.DateTimeFormat('en-US',{timeZone:tz||'UTC',hour12:false,weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
 const o={};for(const p of f.formatToParts(new Date(ms)))o[p.type]=p.value;
 return{y:Number(o.year),m:Number(o.month),d:Number(o.day),hh:Number(o.hour)%24,mm:Number(o.minute),wd:DAYS.indexOf(o.weekday.toLowerCase().slice(0,3))};
}
// The instant of local y-m-d hh:mm in tz (good to the minute; a DST switch shifts it by an hour at most).
function localToMs(y,m,d,hh,mm,tz){
 let guess=Date.UTC(y,m-1,d,hh,mm);
 for(let i=0;i<2;i++){const p=parts(guess,tz);const asUtc=Date.UTC(p.y,p.m-1,p.d,p.hh,p.mm);guess+=Date.UTC(y,m-1,d,hh,mm)-asUtc}
 return guess;
}
// The most recent time this schedule should have run, at or before now (null for hourly).
function lastOccurrence(a,now){
 if(a.every==='hour')return null;
 const [hh,mm]=a.at.split(':').map(Number),tz=a.tz||'UTC',p=parts(now,tz);
 let t=localToMs(p.y,p.m,p.d,hh,mm,tz);
 if(a.every==='week'){const want=DAYS.indexOf(a.day);let back=(p.wd-want+7)%7;t=localToMs(p.y,p.m,p.d-back,hh,mm,tz);if(t>now)t=localToMs(p.y,p.m,p.d-back-7,hh,mm,tz)}
 else if(t>now)t=localToMs(p.y,p.m,p.d-1,hh,mm,tz);
 return t;
}
// Due when the latest scheduled time has passed and the last run was before it. A schedule
// that has never run waits for its next time (it does not fire the moment it is added);
// one that ran before but missed a time (the server was down) runs once when it is back.
function due(a,lastRun,now=Date.now()){
 if(a.on)return false;
 if(a.every==='hour')return !lastRun||now-lastRun>=EVERY.hour;
 const t=lastOccurrence(a,now);
 if(now<t)return false;
 return lastRun?lastRun<t:now-t<2*EVERY.hour;
}
function describe(a){
 if(a.on)return'When a record in "'+a.collection+'" is '+a.on+' → '+a.run;
 if(a.every==='hour')return'Every hour → '+a.run;
 return(a.every==='week'?'Every '+a.day.charAt(0).toUpperCase()+a.day.slice(1)+'day'.replace('Sunday','Sunday'):'Every day')+' at '+a.at+(a.tz?' ('+a.tz+')':' UTC')+' → '+a.run;
}

function table(db){db.exec('CREATE TABLE IF NOT EXISTS automation_runs(name TEXT PRIMARY KEY,last_run INTEGER NOT NULL,last_result TEXT,ok INTEGER NOT NULL DEFAULT 1,runs INTEGER NOT NULL DEFAULT 0,failures INTEGER NOT NULL DEFAULT 0,streak INTEGER NOT NULL DEFAULT 0)')}
function runs(db){table(db);return Object.fromEntries(db.prepare('SELECT * FROM automation_runs').all().map(r=>[r.name,r]))}
function clip(s,n){s=String(s??'');return s.length>n?s.slice(0,n)+'…':s}

// Runs one automation's function now. db is the live database or a sandbox copy.
async function runOne(id,a,{meta,cfg,db,version,trigger,collection,record,now=Date.now(),send,sb=null}={}){
 const backend=require('./react-backend'),applog=require('./react-logs');
 const body={automation:a.name,trigger,at:new Date(now).toISOString(),...(collection?{collection}:{}),...(record?{record}:{})};
 let ok=false,result;
 try{
  const out=await backend.runFunction(id,a.run,{meta,version,cfg,db,sb,user:null,automation:true,request:{method:'POST',path:'/functions/'+a.run,query:{},headers:{'content-type':'application/json','x-kairoq-automation':a.name},body,rawBody:JSON.stringify(body)}});
  const r=out.result||{};const status=Number(r.status)||200;
  ok=status<400;
  result=(ok?'ok':'failed')+' '+status+(r.json!==undefined?' '+clip(JSON.stringify(r.json),160):r.body!==undefined?' '+clip(r.body,160):'');
 }catch(e){result='failed: '+clip(e.message||e,200)}
 if(!db.__sandbox){
  table(db);
  const prev=db.prepare('SELECT * FROM automation_runs WHERE name=?').get(a.name);
  const streak=ok?0:((prev&&prev.streak)||0)+1;
  db.prepare('INSERT INTO automation_runs(name,last_run,last_result,ok,runs,failures,streak) VALUES(?,?,?,?,1,?,?) ON CONFLICT(name) DO UPDATE SET last_run=excluded.last_run,last_result=excluded.last_result,ok=excluded.ok,runs=automation_runs.runs+1,failures=automation_runs.failures+excluded.failures,streak=excluded.streak').run(a.name,now,result,ok?1:0,ok?0:1,streak);
  // One email when an automation has failed three times running, not one per failure.
  if(streak===FAIL_STREAK){const to=require('./react-backend-extras').ownerEmail(meta);if(to)try{await (send||require('./react-backend-extras').deliver)(to,meta.name+': the automation "'+a.name+'" keeps failing','The automation "'+a.name+'" ('+describe(a)+') has failed '+streak+' times in a row.\n\nLast result: '+result+'\n\nOpen the project in Kairoq, check the server logs under Data, and ask the chat to fix it.')}catch{}}
 }
 applog.add(id,{level:ok?'log':'error',source:'automation '+a.name,message:(trigger==='schedule'?'ran on schedule':trigger==='manual'?'ran now':'ran on '+trigger+(collection?' in '+collection:''))+(db.__sandbox?' (test copy)':'')+': '+result});
 return{name:a.name,ok,result};
}

// Every automation that is due on every app (called on a timer by the server).
async function tick({now=Date.now(),send}={}){
 const builder=require('./react-builder'),backend=require('./react-backend'),out=[];
 for(const p of builder.list()){
  let meta,cfg;try{meta=builder.loadMeta(p.id);cfg=backend.liveConfig(meta)}catch(e){out.push({project:p.id,error:e.message});continue}
  const list=(cfg.automations||[]).filter(a=>!a.on);if(!list.length)continue;
  const db=backend.database(p.id),done=runs(db);
  for(const a of list){
   if(!due(a,done[a.name]&&done[a.name].last_run,now))continue;
   try{out.push({project:p.id,...await runOne(p.id,a,{meta,cfg,db,version:meta.published?.version||meta.current_version,trigger:'schedule',now,send})})}
   catch(e){out.push({project:p.id,name:a.name,error:e.message})}
  }
 }
 return out;
}

// A record changed (see react-backend publish): start the automations that listen to it.
// Runs after the request that changed the record has finished; never for changes an
// automation made itself.
function onRecord(db,collection,type,item){
 if(!db||!db.__projectId||db.__automation)return;
 const id=String(db.__projectId).replace(/~test$/,'');
 setImmediate(async()=>{
  try{
   const builder=require('./react-builder'),backend=require('./react-backend');
   const meta=builder.loadMeta(id);
   const version=db.__sandbox?(builder.testingVersion(id)||meta.current_version):(meta.published?.version||meta.current_version);
   if(!version)return;
   const cfg=backend.parseConfig(builder.loadFiles(id,version));
   for(const a of (cfg.automations||[]).filter(a=>a.on===type&&a.collection===collection)){
    await runOne(id,a,{meta,cfg,db,version,trigger:type,collection,record:item,sb:db.__sandboxToken?require('./react-sandbox').lookup(id,db.__sandboxToken):null});
   }
  }catch(e){try{require('./react-logs').add(id,{level:'error',source:'automation',message:'could not run automations for '+collection+' '+type+': '+String(e.message||e).slice(0,300)})}catch{}}
 });
}

// Run now, from the editor or the agent (sb: a sandbox from react-sandbox to run on the test copy).
async function runNow(id,name,{sb=null,version=null,send}={}){
 const builder=require('./react-builder'),backend=require('./react-backend'),path=require('path');
 const meta=builder.loadMeta(id);
 const v=version||(sb?(builder.testingVersion(id)||meta.current_version):(meta.published?.version||meta.current_version));
 if(!v)throw Object.assign(Error('Nothing is built yet'),{status:400});
 const cfg=backend.parseConfig(builder.loadFiles(id,v));
 const a=(cfg.automations||[]).find(x=>x.name===name);
 if(!a)throw Object.assign(Error('No automation named "'+name+'"'),{status:404});
 const db=sb?backend.openFile(path.join(sb.dir,'data.sqlite')):backend.database(id);
 db.__projectId=sb?id+'~test':id;if(sb){db.__filesDir=path.join(sb.dir,'files');db.__sandbox=true;db.__sandboxToken=sb.token}
 return runOne(id,a,{meta,cfg,db,version:v,sb,trigger:'manual',send});
}

// What the editor shows: each automation with its last run.
function status(id){
 const builder=require('./react-builder'),backend=require('./react-backend');
 const meta=builder.loadMeta(id),cfg=backend.liveConfig(meta),db=backend.database(id),done=runs(db),now=Date.now();
 return(cfg.automations||[]).map(a=>{const r=done[a.name];return{...a,text:describe(a),last_run:r?new Date(r.last_run).toISOString():null,last_result:r?r.last_result:null,ok:r?Boolean(r.ok):null,runs:r?r.runs:0,failures:r?r.failures:0,next:a.on?null:nextRun(a,r&&r.last_run,now)}});
}
// When it runs next: now if it is due, otherwise the occurrence after the latest one.
function nextRun(a,lastRun,now){
 if(due(a,lastRun,now))return new Date(now).toISOString();
 if(a.every==='hour')return new Date(lastRun+EVERY.hour).toISOString();
 return new Date(lastOccurrence(a,now)+EVERY[a.every]).toISOString();
}
module.exports={normalize,due,describe,lastOccurrence,runOne,tick,onRecord,runNow,status,runs,EVERY,FAIL_STREAK};
