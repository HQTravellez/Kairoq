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
const ACTIONS=new Set(['click','fill','select','scroll','back','done','give_up']);
const FEELINGS=new Set(['confident','unsure','frustrated']);

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
async function personas({audience,goal,count,callModel,tier,signal}){
 const n=Math.max(1,Math.min(MAX_PERSONAS(),Math.round(Number(count))||10));
 const messages=[{role:'system',content:PERSONA_PROMPT},{role:'user',content:'Audience: '+clip(audience,600)+'\nWhat they come to do: '+clip(goal,400)+'\nCreate exactly '+n+' personas.'}];
 const list=await callModel({messages,temperature:0.9,maxOutputTokens:Math.min(8000,300+n*120),signal,tier},content=>{const v=json(content);if(!Array.isArray(v.personas)||!v.personas.length)throw Error('No personas');return v.personas});
 return list.slice(0,n).map(normalizePersona);
}

// ---------- one visit ----------
const VISIT_PROMPT=`You are role-playing a real person using a website, not a tester. Stay in character: your age, patience, tech comfort and device decide what you notice, what you skip and when you give up. You only know what is on the screen.
Each turn you see the page (text and numbered interactive elements) and choose ONE next action.
Respond with ONLY JSON: {"thought":"what you think right now, first person, one or two short sentences","feeling":"confident"|"unsure"|"frustrated","action":"click"|"fill"|"select"|"scroll"|"back"|"done"|"give_up","target":<element number for click/fill/select>,"value":"text to type, option to choose, or up/down for scroll"}
Use "done" only when your goal is truly complete on screen. Use "give_up" when a real person like you would leave (confusing, too slow, asks too much, cannot find it). Type realistic details; use test-<name>@example.com for emails and never real card numbers.`;
function describePersona(p){return p.name+', '+p.age+', '+(p.about||'')+' Uses a '+p.device+'. Patience: '+p.patience+'. Tech comfort: '+p.tech+'.'+(p.wants?' Wants: '+p.wants:'')}
function describePage(o){
 return 'Page: '+(o.title||'(no title)')+' — '+o.path+'\nVisible text:\n'+String(o.text||'').slice(0,2000)+'\n\nInteractive elements:\n'+(o.elements.length?o.elements.map(e=>'['+e.id+'] '+e.kind+': '+(e.label||'(no label)')+(e.options?' options: '+e.options.join(' | '):'')+(e.value?' (current: '+e.value+')':'')).join('\n'):'(none)');
}
function cleanAction(a,o){
 const action=ACTIONS.has(a&&a.action)?a.action:'give_up';
 const target=Number(a&&a.target);
 const needs=['click','fill','select'].includes(action);
 if(needs&&!o.elements.some(e=>e.id===target))return{action:'give_up',thought:'I could not find what I was looking for.',feeling:'frustrated'};
 return{action,...(needs?{target}:{}),value:clip(a&&a.value,200),thought:clip(a&&a.thought,300),feeling:FEELINGS.has(a&&a.feeling)?a.feeling:'unsure'};
}
async function visit({url,persona,goal,callModel,tier,browse,sandbox,signal}){
 const steps=[];let outcome='stuck',error=null;
 const s=await browse(url,{sandbox,viewport:persona.device});
 if(!s)return{persona,outcome:'skipped',steps};
 try{
  for(let i=0;i<MAX_STEPS();i++){
   if(signal&&signal.aborted)throw Error('Stopped.');
   const o=await s.observe();
   const history=steps.slice(-6).map(x=>'- on '+x.path+': '+x.action+(x.label?' "'+x.label+'"':'')+(x.value?' "'+x.value+'"':'')+(x.error?' (did not work: '+x.error+')':'')).join('\n');
   const messages=[{role:'system',content:VISIT_PROMPT},{role:'user',content:'You are: '+describePersona(persona)+'\nYour goal: '+clip(goal,400)+'\nStep '+(i+1)+' of at most '+MAX_STEPS()+'.'+(history?'\nWhat you did so far:\n'+history:'')+'\n\n'+describePage(o)}];
   const a=cleanAction(await callModel({messages,temperature:0.7,maxOutputTokens:400,signal,tier},json),o);
   const el=o.elements.find(e=>e.id===a.target);
   const step={n:i+1,path:o.path,thought:a.thought,feeling:a.feeling,action:a.action,...(el?{label:el.label}:{}),...(el&&el.loc?{loc:el.loc}:{}),...(a.value&&a.action!=='click'?{value:a.value}:{})};
   // Where a visitor gave up or got stuck, the code behind what was on screen (for the explanations).
   if(a.action==='give_up'||a.feeling==='frustrated'||i===MAX_STEPS()-1)step.screen=[...new Set(o.elements.map(e=>e.loc).filter(Boolean))].slice(0,12);
   steps.push(step);
   if(a.action==='done'){outcome='completed';break}
   if(a.action==='give_up'){outcome='gave_up';break}
   try{await s.act(a)}catch(e){step.error=clip(String(e.message||e).split('\n')[0],160)}
  }
  const end=await s.observe().catch(()=>null);
  if(end&&end.errors.length)error=end.errors[0];
 }catch(e){outcome='error';error=clip(e.message||e,300)}
 finally{await s.close()}
 return{persona,outcome,steps,...(error?{error}:{})};
}

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
 const left={};for(const v of real)if(v.outcome!=='completed'){const last=v.steps.at(-1);const where=last?last.path:'(start)';left[where]=(left[where]||0)+1}
 const by={};for(const v of real){const d=v.persona.device;by[d]=by[d]||{visitors:0,completed:0};by[d].visitors++;if(v.outcome==='completed')by[d].completed++}
 const done=real.filter(v=>v.outcome==='completed').map(v=>v.steps.length).sort((a,b)=>a-b);
 return{
  visitors:real.length,completed:count('completed'),gave_up:count('gave_up'),stuck:count('stuck'),errors:count('error'),
  completion_rate:real.length?Math.round(count('completed')/real.length*100):0,
  median_steps:done.length?done[Math.floor(done.length/2)]:null,
  drop_off:Object.entries(left).map(([path,n])=>({path,visitors:n})).sort((a,b)=>b.visitors-a.visitors).slice(0,8),
  by_device:by,
  frustrated:real.filter(v=>v.steps.some(s=>s.feeling==='frustrated')).length
 };
}
const SUMMARY_PROMPT=`You analyse a usability test where AI personas tried to reach a goal in a web app. You get each visit: who it was, the outcome, and their step-by-step thoughts.
Respond with ONLY JSON: {"headline":"one sentence: the single most important finding","issues":[{"title":"short problem name","why":"what goes wrong and why, concretely (name the page, button or text)","who":"which kind of people it affects","visitors":<how many visits show it>,"quote":"one persona's exact words"}],"fixes":["specific change to make, most valuable first"]}
Rank issues by how many visitors they lost. Be concrete and grounded only in what the visits show. At most 6 issues and 6 fixes.`;
function digest(visits){
 return visits.filter(v=>v.outcome!=='skipped').map(v=>'## '+v.persona.name+' ('+v.persona.age+', '+v.persona.device+', patience '+v.persona.patience+', tech '+v.persona.tech+') — '+v.outcome+'\n'+v.steps.map(s=>s.n+'. '+s.path+' ['+s.feeling+'] '+s.thought+' → '+s.action+(s.label?' "'+s.label+'"':'')+(s.error?' (failed)':'')).join('\n')).join('\n\n').slice(0,60000);
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
async function run(id,url,test,{callModel,browse,tier='standard',signal,onProgress=()=>{}}){
 if(!browse)throw Object.assign(Error('Synthetic customers need a browser on the server'),{status:409});
 onProgress({status:'personas',text:'Creating '+(Number(test.count)||10)+' personas'});
 const people=await personas({...test,callModel,tier,signal});
 const start=url+(test.path?String(test.path).replace(/^\//,''):'');
 let done=0;
 const sandbox=require('./react-sandbox');
 const visits=await pool(people,CONCURRENCY(),async persona=>{
  const r=await sandbox.withSandbox(id,box=>visit({url:start,persona,goal:test.goal,callModel,tier,browse,sandbox:box.token,signal}));
  done++;onProgress({status:'visiting',text:done+' of '+people.length+' visitors finished'});
  return r;
 });
 if(signal&&signal.aborted)throw Error('Stopped.');
 onProgress({status:'reporting',text:'Writing the report'});
 const numbers=funnel(visits);
 const summary=numbers.visitors?await summarize(visits,test.goal,{callModel,tier,signal}):{headline:'',issues:[],fixes:[]};
 return{numbers,summary,visits};
}

// ---------- storage ----------
function dir(id){return path.join(builder.projectDir(id),'synthetic')}
function save(id,report){
 fs.mkdirSync(dir(id),{recursive:true});
 const rid=report.id||crypto.randomUUID();
 const full={...report,id:rid};
 fs.writeFileSync(path.join(dir(id),rid+'.json'),JSON.stringify(full));
 const meta=builder.loadMeta(id);
 meta.synthetic=[{id:rid,at:full.at,version:full.version,audience:clip(full.test.audience,200),goal:clip(full.test.goal,200),visitors:full.numbers.visitors,completion_rate:full.numbers.completion_rate,headline:full.summary.headline},...(meta.synthetic||[]).filter(x=>x.id!==rid)].slice(0,20);
 // Old full reports beyond the kept list are removed.
 const keep=new Set(meta.synthetic.map(x=>x.id));
 for(const f of fs.readdirSync(dir(id)))if(f.endsWith('.json')&&!keep.has(f.slice(0,-5)))fs.rmSync(path.join(dir(id),f),{force:true});
 builder.saveMeta(meta);
 return full;
}
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
module.exports={personas,visit,run,funnel,summarize,save,list,load,fixMessage,normalizePersona,MAX_PERSONAS};
