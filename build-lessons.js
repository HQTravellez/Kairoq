"use strict";
// The learning loop: Kairoq learns from its own builds.
//
// 1. Record: after every build, the problems it hit on the way (Vite build errors, errors the
//    browser showed) and how it ended: clean first time, recovered after retries, saved with
//    errors, or failed. Errors are reduced to their shape (no quoted text, numbers or paths) so the
//    same mistake in different projects counts as one, and nothing a user typed is kept.
// 2. Learn: once a day, a problem that keeps coming back across several projects becomes a short
//    rule for the code writer, written by the model from the error's shape.
// 3. Use: active rules go into the builder's instructions for every project.
// 4. Prove: each rule remembers how often its problem happened before it was switched on. After
//    enough builds, a rule that did not make its problem rarer is retired by itself.
//
// KAIROQ_LEARNING: review (default: new rules wait for the owner's approval), auto (rules go live
// at once and are still retired when they do not help), off.
const fs=require('fs'),path=require('path'),crypto=require('crypto');

const DAY=86400000;
function mode(){const m=String(process.env.KAIROQ_LEARNING||'review').toLowerCase();return m==='auto'||m==='off'?m:'review'}
function intEnv(k,d){const n=Number(process.env[k]);return Number.isFinite(n)&&n>=0?Math.floor(n):d}
function windowDays(){return Math.max(1,intEnv('KAIROQ_LEARNING_WINDOW_DAYS',14))}
function minProjects(){return Math.max(2,intEnv('KAIROQ_LEARNING_MIN_PROJECTS',3))}
function judgeBuilds(){return Math.max(5,intEnv('KAIROQ_LEARNING_JUDGE_BUILDS',40))}
function maxActive(){return Math.max(1,Math.min(25,intEnv('KAIROQ_LEARNING_MAX_RULES',12)))}
function dir(){return process.env.KAIROQ_LEARNING_DIR||path.join(path.dirname(require('./react-builder').ROOT()),'learning')}
function file(n){return path.join(dir(),n)}

// ---------- the shape of an error ----------
// "Uncaught error: Cannot read properties of undefined (reading 'title')" and the same with 'price'
// are one problem. Quoted text, numbers, paths and links go; only plain characters stay.
function shape(raw){
 let t=String(raw||'').split('\n').map(x=>x.trim()).find(Boolean)||'';
 t=t.replace(/https?:\/\/\S+/g,'<url>')
  .replace(/(['"`])(?:(?!\1).){0,200}\1/g,'…')
  .replace(/(?:\.{0,2}\/)?(?:[\w@.-]+\/)+[\w@.-]+(?::\d+(?::\d+)?)?/g,'<file>')
  .replace(/\b[0-9a-f]{8,}\b/gi,'#').replace(/\d+/g,'#')
  .replace(/[^A-Za-z0-9 _.:()<>#…,'-]/g,' ').replace(/\s+/g,' ').trim();
 return t.slice(0,160);
}
function sigOf(stage,s){return crypto.createHash('sha1').update(stage+'|'+s).digest('hex').slice(0,16)}
function projectKey(id){return crypto.createHash('sha1').update('kq-learn:'+id).digest('hex').slice(0,12)}

// ---------- 1. record ----------
// What one finished build went through, from its result (timeline) or its failure.
function fromResult(result){
 const seen=new Map();
 const add=(stage,raw)=>{const s=shape(raw);if(s.length<8)return;const sig=sigOf(stage,s);if(!seen.has(sig))seen.set(sig,{sig,stage,shape:s})};
 for(const e of (result&&result.timeline)||[]){
  if(e.t==='build'&&e.ok===false)add('build',e.detail);
  if(e.t==='test'&&e.ok===false)for(const d of [].concat(e.detail||[]))add('browser',d);
 }
 for(const d of (result&&result.runtime_errors)||[])add('browser',d);
 return [...seen.values()];
}
function outcomeOf(result,failed){
 if(failed)return'failed';
 if((result.runtime_errors||[]).length)return'saved_with_errors';
 return (result.attempts||1)>1||((result.timeline||[]).some(e=>e.ok===false))?'recovered':'clean';
}
const COMPLAINT=/\b(still|again)\b[^.]{0,30}\b(broken|not working|doesn'?t work|does not work|error|blank|wrong)\b|\b(doesn'?t|does not|didn'?t|did not|isn'?t|is not)\s+work(ing)?\b|\bsame (error|problem|issue)\b|\bnot fixed\b/i;
function isComplaint(message){return COMPLAINT.test(String(message||'').slice(0,400))}

function append(ev){
 if(mode()==='off')return;
 try{
  fs.mkdirSync(dir(),{recursive:true});
  const f=file('events.jsonl');
  fs.appendFileSync(f,JSON.stringify(ev)+'\n');
  // Keep the file small: the newest 20 000 events.
  if(fs.statSync(f).size>6e6){const lines=fs.readFileSync(f,'utf8').trim().split('\n');fs.writeFileSync(f,lines.slice(-20000).join('\n')+'\n')}
 }catch{}
}
// mode: build | agent | polish. result: the builder's result, or null when the job failed.
function recordBuild(projectId,{mode:m,result,error,at=new Date().toISOString()}){
 const failed=!result;
 const problems=failed?[{stage:'failed',shape:shape(String(error||'').replace(/^The change could not be built after \d+ attempts\. Last problem:\s*/,''))}].filter(p=>p.shape.length>=8).map(p=>({...p,sig:sigOf(p.stage,p.shape)})):fromResult(result);
 append({t:'build',at,p:projectKey(projectId),mode:m,outcome:outcomeOf(result||{},failed),attempts:failed?null:result.attempts||1,problems,rules:activeRules().map(l=>l.id)});
}
function recordComplaint(projectId,at=new Date().toISOString()){append({t:'complaint',at,p:projectKey(projectId)})}

function events(sinceMs){
 try{
  return fs.readFileSync(file('events.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(e=>e&&(!sinceMs||Date.parse(e.at)>=sinceMs));
 }catch{return[]}
}

// ---------- lessons ----------
function loadLessons(){try{return JSON.parse(fs.readFileSync(file('lessons.json'),'utf8'))}catch{return{lessons:[],last_run:null}}}
function saveLessons(s){fs.mkdirSync(dir(),{recursive:true});fs.writeFileSync(file('lessons.json'),JSON.stringify(s,null,1))}
function activeRules(){return loadLessons().lessons.filter(l=>l.status==='active').sort((a,b)=>(b.proven?1:0)-(a.proven?1:0)||Date.parse(b.activated_at)-Date.parse(a.activated_at)).slice(0,maxActive())}
// What goes into the builder's instructions.
function promptNote(){
 if(mode()==='off')return'';
 const rules=activeRules();
 return rules.length?'\n\nLessons Kairoq learned from earlier builds (these mistakes kept breaking apps; avoid them):\n'+rules.map(l=>'- '+l.rule).join('\n'):'';
}

// How often a problem showed up: builds that hit it / all builds, in a list of build events.
function rate(builds,sig){return builds.length?builds.filter(b=>(b.problems||[]).some(p=>p.sig===sig)).length/builds.length:0}

// A rule must be a short, plain instruction about code. Anything that looks like it is talking to
// the model about itself, carries links or is long is dropped (the error shapes come from user projects).
function safeRule(r){
 const t=String(r||'').replace(/\s+/g,' ').trim();
 if(t.length<15||t.length>240)return'';
 if(/https?:|www\.|\b(ignore|disregard|system prompt|instructions?|previous|jailbreak|password|secret|api key|token)\b/i.test(t))return'';
 return t;
}
const RULE_PROMPT=`You maintain a short list of rules for an AI that writes React 18 + Vite + Tailwind CSS apps from chat requests. Its first attempt in many different projects keeps causing the same error, which then needs retries.
Write ONE rule the code writer should follow so this error does not happen in the first place. Make it general (it applies to every project), concrete (name the coding practice), and under 200 characters. Do not mention the error count, projects, users or this list.
Respond with ONLY JSON: {"rule":"...","why":"one short sentence: what goes wrong without it"}`;

// ---------- 2. learn, and 4. prove ----------
// Once a day (or when the owner asks): judge active rules, then propose rules for problems that
// keep coming back. deps: {callModel}. Returns what changed.
async function run({callModel,now=Date.now(),force=false}={}){
 const state=loadLessons(),out={judged:[],proposed:[]};
 if(mode()==='off')return out;
 if(!force&&state.last_run&&now-Date.parse(state.last_run)<intEnv('KAIROQ_LEARNING_EVERY_HOURS',24)*3600000)return out;
 state.last_run=new Date(now).toISOString();
 const builds=events(now-windowDays()*DAY*3).filter(e=>e.t==='build');
 // Prove: active rules with enough builds since they went live.
 for(const l of state.lessons.filter(x=>x.status==='active')){
  const after=builds.filter(b=>Date.parse(b.at)>=Date.parse(l.activated_at));
  if(after.length<judgeBuilds())continue;
  l.after={rate:rate(after,l.sig),builds:after.length,at:state.last_run};
  // It has to cut its problem by at least a fifth; a problem that never came back counts as cut.
  if(l.baseline&&l.baseline.rate>0&&l.after.rate>=l.baseline.rate*0.8){l.status='retired';l.retired_at=state.last_run;l.reason='Did not make the problem rarer ('+pct(l.baseline.rate)+' of builds before, '+pct(l.after.rate)+' after).';out.judged.push({id:l.id,status:'retired'})}
  else if(!l.proven){l.proven=true;out.judged.push({id:l.id,status:'proven'})}
 }
 // Learn: problems seen in enough different projects lately, with no rule yet.
 const recent=builds.filter(b=>Date.parse(b.at)>=now-windowDays()*DAY);
 const groups=new Map();
 for(const b of recent)for(const p of b.problems||[]){
  if(p.stage==='failed')continue;
  const g=groups.get(p.sig)||{sig:p.sig,stage:p.stage,shape:p.shape,count:0,projects:new Set()};
  g.count++;g.projects.add(b.p);groups.set(p.sig,g);
 }
 const known=new Set(state.lessons.map(l=>l.sig));
 const candidates=[...groups.values()].filter(g=>g.projects.size>=minProjects()&&!known.has(g.sig)).sort((a,b)=>b.projects.size-a.projects.size||b.count-a.count).slice(0,intEnv('KAIROQ_LEARNING_PER_RUN',3));
 for(const g of candidates){
  if(!callModel)break;
  let v;
  try{v=await callModel({messages:[{role:'system',content:RULE_PROMPT},{role:'user',content:'Stage: '+(g.stage==='build'?'the Vite build failed':'the app built, but the browser showed this error')+'\nError (quoted values removed): '+g.shape}],temperature:0.2,maxOutputTokens:300,tier:'standard'},c=>{const t=String(c||'');const a=t.indexOf('{'),b=t.lastIndexOf('}');return JSON.parse(t.slice(a,b+1))})}catch{continue}
  const rule=safeRule(v&&v.rule);if(!rule)continue;
  const lesson={id:crypto.randomBytes(6).toString('hex'),sig:g.sig,stage:g.stage,shape:g.shape,rule,why:String(v.why||'').replace(/\s+/g,' ').trim().slice(0,240),status:'proposed',created_at:state.last_run,evidence:{builds_hit:g.count,projects:g.projects.size,window_days:windowDays(),rate:rate(recent,g.sig)}};
  state.lessons.push(lesson);out.proposed.push(lesson.id);
  if(mode()==='auto')activate(lesson,recent,now);
 }
 saveLessons(state);
 return out;
}
function pct(r){return Math.round(r*1000)/10+'%'}
function activate(l,recent,now=Date.now()){
 if(!recent)recent=events(now-windowDays()*DAY).filter(e=>e.t==='build');
 l.status='active';l.activated_at=new Date(now).toISOString();l.baseline={rate:rate(recent,l.sig),builds:recent.length};
}
// The owner's decisions: approve (go live), retire (switch off), edit the wording.
function decide(id,action,{rule}={}){
 const state=loadLessons(),l=state.lessons.find(x=>x.id===id);
 if(!l)throw Object.assign(Error('Unknown rule'),{status:404});
 if(action==='approve'){if(l.status!=='active')activate(l)}
 else if(action==='retire'){l.status='retired';l.retired_at=new Date().toISOString();l.reason='Switched off by the owner.'}
 else if(action==='edit'){const r=safeRule(rule);if(!r)throw Object.assign(Error('Keep the rule a short instruction about code (15 to 240 characters, no links).'),{status:400});l.rule=r}
 else throw Object.assign(Error('Unknown action'),{status:400});
 saveLessons(state);return l;
}
// The numbers the owner sees: how builds went lately, and the rules.
function overview(now=Date.now()){
 const since=now-windowDays()*DAY,all=events(since),builds=all.filter(e=>e.t==='build');
 const n=o=>builds.filter(b=>b.outcome===o).length;
 const retries=builds.filter(b=>b.attempts).reduce((s,b)=>s+(b.attempts-1),0);
 const top=new Map();for(const b of builds)for(const p of b.problems||[]){const g=top.get(p.sig)||{shape:p.shape,stage:p.stage,count:0,projects:new Set()};g.count++;g.projects.add(b.p);top.set(p.sig,g)}
 const s=loadLessons();
 return{
  mode:mode(),window_days:windowDays(),last_run:s.last_run,
  builds:builds.length,clean:n('clean'),recovered:n('recovered'),saved_with_errors:n('saved_with_errors'),failed:n('failed'),
  clean_rate:builds.length?Math.round(n('clean')/builds.length*100):null,
  retries_per_build:builds.length?Math.round(retries/builds.length*100)/100:null,
  complaints:all.filter(e=>e.t==='complaint').length,
  top_problems:[...top.values()].sort((a,b)=>b.projects.size-a.projects.size||b.count-a.count).slice(0,8).map(g=>({shape:g.shape,stage:g.stage,builds:g.count,projects:g.projects.size})),
  lessons:s.lessons.slice().reverse()
 };
}
module.exports={shape,fromResult,outcomeOf,isComplaint,recordBuild,recordComplaint,events,run,decide,overview,promptNote,activeRules,safeRule,mode,dir};
