"use strict";
// Synthetic customers: AI personas that use an app in a real browser, think out loud, and
// either reach their goal or give up. The report shows how many finished, where the others
// left, what confused them (in their words) and what to fix.
//
// The browser comes from runtime-check.session() (guarded, on a test copy of the app's data),
// the model from the caller (callModel), so tests can script both.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const builder=require('./react-builder');

const MAX_PERSONAS=()=>Math.max(1,Math.min(100,Number(process.env.KAIROQ_SYNTHETIC_MAX||50)));
const MAX_STEPS=()=>Math.max(3,Math.min(25,Number(process.env.KAIROQ_SYNTHETIC_STEPS||12)));
const CONCURRENCY=()=>Math.max(1,Math.min(8,Number(process.env.KAIROQ_SYNTHETIC_CONCURRENCY||4)));

function clip(v,n){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
function json(content){
 const t=String(content||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');
 try{return JSON.parse(t)}catch{const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<=a)throw Error('The model did not answer with JSON');return JSON.parse(t.slice(a,b+1))}
}

// ---------- personas ----------
const PERSONA_PROMPT=`You create realistic, varied customer personas for usability testing of a web app.
Respond with ONLY JSON: {"personas":[{"name":"first name","age":34,"about":"one sentence: job, situation","device":"phone"|"desktop","patience":"low"|"medium"|"high","tech":"low"|"medium"|"high","wants":"what this person is trying to do, in their words"}]}
Mix ages, devices (most real visitors use phones), patience and tech comfort. Include sceptical and hurried people, not only ideal users. Keep each persona true to the audience described.`;
function normalizePersona(p,i){
 const pick=(v,ok,d)=>ok.includes(v)?v:d;
 return{
  id:i+1,
  name:clip(p&&p.name,40)||'Visitor '+(i+1),
  age:Math.max(16,Math.min(90,Math.round(Number(p&&p.age))||30)),
  about:clip(p&&p.about,200),
  device:pick(p&&p.device,['phone','desktop'],i%3===2?'desktop':'phone'),
  patience:pick(p&&p.patience,['low','medium','high'],'medium'),
  tech:pick(p&&p.tech,['low','medium','high'],'medium'),
  wants:clip(p&&p.wants,200)
 };
}
// When the model cannot write personas in time (a slow or silent free model), the test still runs
// with these: a varied mix of ages, devices, patience and tech comfort, each wanting the goal.
const STANDARD_PEOPLE=[
 {name:'Maya',age:34,about:'Project manager who sorts things out on her phone between meetings',device:'phone',patience:'low',tech:'medium'},
 {name:'Daniel',age:52,about:'Operations director comparing a few options on his laptop',device:'desktop',patience:'medium',tech:'medium'},
 {name:'Priya',age:27,about:'Doing this for the first time, careful, reads everything',device:'phone',patience:'high',tech:'high'},
 {name:'Tom',age:67,about:'Retired, reads slowly, wants clear prices and a phone number',device:'desktop',patience:'medium',tech:'low'},
 {name:'Leila',age:41,about:'Busy parent in a hurry, sceptical of hidden fees',device:'phone',patience:'low',tech:'low'},
 {name:'Marco',age:38,about:'Small-business owner checking details before committing',device:'desktop',patience:'medium',tech:'high'},
 {name:'Aisha',age:23,about:'Student who expects things to work like the apps she uses',device:'phone',patience:'low',tech:'high'},
 {name:'Grace',age:58,about:'Office manager arranging this for someone else',device:'desktop',patience:'high',tech:'low'},
 {name:'Kenji',age:45,about:'Frequent traveller who wants the fastest way through',device:'phone',patience:'low',tech:'high'},
 {name:'Rosa',age:31,about:'Nurse finishing a night shift, tired, on her phone',device:'phone',patience:'medium',tech:'medium'}];
function standardPeople(n,goal){return Array.from({length:n},(_,i)=>{const p=STANDARD_PEOPLE[i%STANDARD_PEOPLE.length];return{...p,name:i<STANDARD_PEOPLE.length?p.name:p.name+' '+(Math.floor(i/STANDARD_PEOPLE.length)+1),wants:clip(goal,200)}})}
const PERSONA_MS=()=>Math.max(1000,Number(process.env.KAIROQ_PERSONA_TIMEOUT_MS||120000));
async function personas({audience,goal,count,callModel,tier,signal}){
 const n=Math.max(1,Math.min(MAX_PERSONAS(),Math.round(Number(count))||10));
 const messages=[{role:'system',content:PERSONA_PROMPT},{role:'user',content:'Audience: '+clip(audience,600)+'\nWhat they come to do: '+clip(goal,400)+'\nCreate exactly '+n+' personas.'}];
 // A time limit, so a silent model never stalls the test (and a model that ignores the signal is
 // left behind by the race).
 const limit=AbortSignal.timeout(PERSONA_MS()),own=signal?AbortSignal.any([signal,limit]):limit;
 let list;
 try{
  list=await Promise.race([
   callModel({messages,temperature:0.9,maxOutputTokens:Math.min(8000,300+n*120),signal:own,tier},content=>{const v=json(content);if(!Array.isArray(v.personas)||!v.personas.length)throw Error('No personas');return v.personas}),
   new Promise((_,reject)=>own.addEventListener('abort',()=>reject(own.reason||Error('timeout')),{once:true}))]);
 }catch(e){
  if(signal&&signal.aborted)throw e;
  list=standardPeople(n,goal);
 }
 return list.slice(0,n).map(normalizePersona);
}

// ---------- one visit ----------
// The visit itself is the browser agent (browser-agent.js) in persona mode: it plans a few
// actions per step, keeps notes, notices when it repeats itself, looks at a screenshot when
// stuck, and a second model checks a "done" before it counts as reaching the goal.
function describePersona(p){return p.name+', '+p.age+', '+(p.about||'')+' Uses a '+p.device+'. Patience: '+p.patience+'. Tech comfort: '+p.tech+'.'+(p.wants?' Wants: '+p.wants:'')}
// site: another website (no test copy of its data; sends are answered locally, see runtime-check.js).
// After the visit, the persona is asked what they remember (price, place, how to book),
// answering only from their own notes and thoughts, not from another look at the site. That
// shows whether the site gets its message across, not only whether its buttons work.
const RECALL_DEFAULT=['What does it cost?','Where is it, or how do you get there?','How do you book or get in touch?'];
const RECALL=`You are the person below, right after leaving a website. Answer from memory only: what you noticed while visiting (your notes and thoughts are below). If you did not notice something, say you don't know.
Respond with ONLY JSON: {"answers":[{"q":1,"answer":"short answer in your own words","remembered":true|false}]}`;
async function recall({persona,goal,steps,memory,questions,callModel,tier,signal}){
 try{
  const notes=steps.map(s=>'- '+s.path+': '+(s.thought||s.action)).join('\n').slice(0,4000);
  const v=await callModel({messages:[{role:'system',content:RECALL},{role:'user',content:'You are: '+describePersona(persona)+'\nYou came to: '+clip(goal,300)+'\nYour notes: '+clip(memory,600)+'\nYour thoughts while visiting:\n'+notes+'\n\nQuestions:\n'+questions.map((q,i)=>(i+1)+'. '+q).join('\n')}],temperature:0.3,maxOutputTokens:400,signal,tier},json);
  return questions.map((q,i)=>{const a=(Array.isArray(v.answers)?v.answers:[]).find(x=>Number(x.q)===i+1)||{};return{q,answer:clip(a.answer,200),remembered:a.remembered===true}});
 }catch{return null}
}
async function visit({url,persona,goal,callModel,tier,browse,sandbox,site=false,signal,questions=RECALL_DEFAULT}){
 const s=await browse(url,site?{site:true,viewport:persona.device}:{sandbox,viewport:persona.device});
 if(!s)return{persona,outcome:'skipped',steps:[]};
 try{
  const r=await require('./browser-agent').run({session:s,goal,mode:'persona',persona:describePersona(persona),callModel,tier,maxSteps:MAX_STEPS(),signal});
  const memo=['completed','gave_up','stuck'].includes(r.outcome)&&questions.length?await recall({persona,goal,steps:r.steps,memory:r.memory,questions,callModel,tier,signal}):null;
  return{persona,outcome:r.outcome,steps:r.steps,...(memo?{recall:memo}:{}),...(r.verdict&&r.verdict.checked?{verdict:{ok:r.verdict.ok,reason:r.verdict.reason}}:{}),...(r.error?{error:r.error}:{})};
 }finally{await s.close()}
}

// test.recall: up to 3 questions of the owner's own; [] turns the quiz off.
function recallQuestions(test){if(Array.isArray(test.recall))return test.recall.map(q=>clip(q,150)).filter(Boolean).slice(0,3);return RECALL_DEFAULT}
// ---------- the run ----------
async function pool(items,limit,fn){
 const out=new Array(items.length);let next=0;
 await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(next<items.length){const i=next++;out[i]=await fn(items[i],i)}}));
 return out;
}
// Numbers only, so they are exact whatever the model says.
function funnel(visits){
 const real=visits.filter(v=>v.outcome!=='skipped');
 const count=o=>real.filter(v=>v.outcome===o).length;
 const left={};for(const v of real)if(v.outcome!=='completed'&&v.outcome!=='blocked'&&v.outcome!=='error'){const last=v.steps.at(-1);const where=last?last.path:'(start)';left[where]=(left[where]||0)+1}
 const by={};for(const v of real){const d=v.persona.device;by[d]=by[d]||{visitors:0,completed:0};by[d].visitors++;if(v.outcome==='completed')by[d].completed++}
 const done=real.filter(v=>v.outcome==='completed').map(v=>v.steps.length).sort((a,b)=>a-b);
 return{
  visitors:real.length,completed:count('completed'),gave_up:count('gave_up'),stuck:count('stuck'),errors:count('error'),blocked:count('blocked'),
  // Visitors a site's bot protection turned away say nothing about the site's design.
  completion_rate:real.length>count('blocked')+count('error')?Math.round(count('completed')/(real.length-count('blocked')-count('error'))*100):null,
  median_steps:done.length?done[Math.floor(done.length/2)]:null,
  drop_off:Object.entries(left).map(([path,n])=>({path,visitors:n})).sort((a,b)=>b.visitors-a.visitors).slice(0,8),
  by_device:by,
  frustrated:real.filter(v=>v.steps.some(s=>s.feeling==='frustrated')).length,
  // What visitors remembered afterwards, per question.
  ...(real.some(v=>v.recall)?{recall:real.find(v=>v.recall).recall.map((x,i)=>({question:x.q,asked:real.filter(v=>v.recall&&v.recall[i]).length,remembered:real.filter(v=>v.recall&&v.recall[i]&&v.recall[i].remembered).length}))}:{}),
  sent_form:real.filter(v=>v.steps.some(s=>s.sent)).length
 };
}
const SUMMARY_PROMPT=`You analyse a usability test where AI personas tried to reach a goal in a web app. You get each visit: who it was, the outcome, and their step-by-step thoughts.
Respond with ONLY JSON: {"headline":"one sentence: the single most important finding","issues":[{"title":"short problem name","why":"what goes wrong and why, concretely (name the page, button or text)","who":"which kind of people it affects","visitors":<how many visits show it>,"quote":"one persona's exact words"}],"fixes":["specific change to make, most valuable first"]}
Rank issues by how many visitors they lost. Be concrete and grounded only in what the visits show. At most 6 issues and 6 fixes.`;
function digest(visits){
 return visits.filter(v=>v.outcome!=='skipped').map(v=>'## '+v.persona.name+' ('+v.persona.age+', '+v.persona.device+', patience '+v.persona.patience+', tech '+v.persona.tech+') — '+v.outcome+'\n'+v.steps.map(s=>s.n+'. '+s.path+' ['+s.feeling+'] '+s.thought+' → '+s.action+(s.label?' "'+s.label+'"':'')+(s.error?' (failed)':'')).join('\n')+(v.recall?'\nAfterwards remembered: '+v.recall.map(x=>x.q+' → '+(x.remembered?x.answer:'did not know')).join('; '):'')).join('\n\n').slice(0,60000);
}
async function summarize(visits,goal,{callModel,tier,signal}){
 try{
  const v=await callModel({messages:[{role:'system',content:SUMMARY_PROMPT},{role:'user',content:'Goal: '+clip(goal,400)+'\n\n'+digest(visits)}],temperature:0.2,maxOutputTokens:2500,signal,tier},json);
  return{
   headline:clip(v.headline,300),
   issues:(Array.isArray(v.issues)?v.issues:[]).slice(0,6).map(x=>({title:clip(x.title,120),why:clip(x.why,500),who:clip(x.who,200),visitors:Math.max(0,Math.round(Number(x.visitors))||0),quote:clip(x.quote,300)})),
   fixes:(Array.isArray(v.fixes)?v.fixes:[]).slice(0,6).map(x=>clip(x,300)).filter(Boolean)
  };
 }catch{
  // Without a summary the numbers and the personas' own words still tell the story.
  const quotes=visits.flatMap(v=>v.steps.filter(s=>s.feeling==='frustrated').map(s=>({who:v.persona.name,path:s.path,quote:s.thought}))).slice(0,6);
  return{headline:'',issues:quotes.map(q=>({title:'Frustration on '+q.path,why:'',who:q.who,visitors:1,quote:q.quote})),fixes:[]};
 }
}
// test: {audience, goal, count, path}. url is the version's preview URL (a path), browse() comes from
// the caller; each visit gets its own test copy of the app's data.
// people: the personas of an earlier test, to rerun the same customers after a fix.
// site: test another website at `url` (a full link) instead of the app's preview path.
async function run(id,url,test,{callModel,browse,tier='standard',signal,onProgress=()=>{},people:given=null,site=false,browseSite=(u,o)=>require('./runtime-check').session(u,o)}){
 if(site)browse=browseSite;
 // AI customers on the standard setting use the website-check models (cheap and reliable).
 if(tier==='standard')tier='check';
 if(!browse)throw Object.assign(Error('Synthetic customers need a browser on the server'),{status:409});
 onProgress({status:'personas',text:given?'Bringing back the same '+given.length+' customers':'Creating '+(Number(test.count)||10)+' personas'});
 const people=given?given.map(normalizePersona):await personas({...test,callModel,tier,signal});
 const start=site?url:url+(test.path?String(test.path).replace(/^\//,''):'');
 let done=0;
 const sandbox=require('./react-sandbox');
 const visits=await pool(people,CONCURRENCY(),async persona=>{
  const r=site?await visit({url:start,persona,goal:test.goal,callModel,tier,browse,site:true,signal,questions:recallQuestions(test)}):await sandbox.withSandbox(id,box=>visit({url:start,persona,goal:test.goal,callModel,tier,browse,sandbox:box.token,signal,questions:recallQuestions(test)}));
  done++;onProgress({status:'visiting',text:done+' of '+people.length+' visitors finished'});
  return r;
 });
 if(signal&&signal.aborted)throw Error('Stopped.');
 onProgress({status:'reporting',text:'Writing the report'});
 const numbers=funnel(visits);
 const summary=numbers.visitors?await summarize(visits,test.goal,{callModel,tier,signal}):{headline:'',issues:[],fixes:[]};
 // Replaying what the visitors who did not finish did (no model, free) confirms which problems are real.
 onProgress({status:'reproducing',text:'Replaying what visitors did to confirm the problems'});
 const problems=numbers.visitors?await require('./synthetic-repair').reproduce(id,{visits},{browse,startUrl:start,signal,site}).catch(()=>[]):[];
 return{numbers,summary,visits,problems};
}

// ---------- storage ----------
function dir(id){return path.join(builder.projectDir(id),'synthetic')}
function save(id,report){
 fs.mkdirSync(dir(id),{recursive:true});
 const rid=report.id||crypto.randomUUID();
 const full={...report,id:rid};
 fs.writeFileSync(path.join(dir(id),rid+'.json'),JSON.stringify(full));
 const meta=builder.loadMeta(id);
 meta.synthetic=[{id:rid,at:full.at,version:full.version,...(full.target&&full.target.kind==='site'?{site:full.target.url}:{}),...(full.compare_id?{compare_id:full.compare_id}:{}),audience:clip(full.test.audience,200),goal:clip(full.test.goal,200),visitors:full.numbers.visitors,completion_rate:full.numbers.completion_rate,headline:full.summary.headline},...(meta.synthetic||[]).filter(x=>x.id!==rid)].slice(0,20);
 // Old full reports beyond the kept list are removed.
 const keep=new Set(meta.synthetic.map(x=>x.id));
 for(const f of fs.readdirSync(dir(id)))if(f.endsWith('.json')&&!keep.has(f.slice(0,-5)))fs.rmSync(path.join(dir(id),f),{force:true});
 builder.saveMeta(meta);
 return full;
}
// Rewrites a kept report (e.g. after fix and retest) without moving it in the list.
function update(id,report){load(id,report.id);fs.writeFileSync(path.join(dir(id),report.id+'.json'),JSON.stringify(report));return report}
function list(id){return builder.loadMeta(id).synthetic||[]}
function load(id,rid){
 if(!/^[0-9a-f-]{36}$/.test(String(rid)))throw Object.assign(Error('Unknown report'),{status:404});
 try{return JSON.parse(fs.readFileSync(path.join(dir(id),rid+'.json'),'utf8'))}catch{throw Object.assign(Error('Unknown report'),{status:404})}
}
// The chat message that asks the builder to fix what a report found.
function fixMessage(report){
 const s=report.summary,cards=report.explanations||[];
 const at=i=>{const c=cards.find(x=>x.issue===i+1);return c&&c.file?' ['+c.file+' line '+c.line+(c.fix?'; fix: '+c.fix:'')+']':''};
 return 'Synthetic customers ('+report.numbers.visitors+' visitors, '+report.numbers.completion_rate+'% reached the goal "'+clip(report.test.goal,200)+'") found these problems. Fix them without changing what already works:\n'+
  s.issues.map((x,i)=>(i+1)+'. '+x.title+(x.why?': '+x.why:'')+(x.quote?' (a visitor said: "'+x.quote+'")':'')+at(i)).join('\n')+
  (s.fixes.length?'\nSuggested changes:\n'+s.fixes.map(f=>'- '+f).join('\n'):'');
}
module.exports={standardPeople,recall,recallQuestions,personas,visit,run,funnel,summarize,save,update,list,load,fixMessage,normalizePersona,MAX_PERSONAS};
