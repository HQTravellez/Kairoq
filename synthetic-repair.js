"use strict";
// The repair loop for synthetic-customer reports: reproduce → fix → retest → lock in.
//
// Reproduce: the exact steps a visitor took (recorded in the report) are replayed in a fresh
// browser, with no model, so it costs nothing. A problem is "confirmed" only when the replay
// shows it again: a click that fails, a page error, or a button that does nothing.
// Problems that are opinions ("the price felt high") cannot be replayed; they are kept as
// "experience" problems and judged by rerunning the same customers.
// Retest: after the builder's fix, the same steps are replayed on the new version.
// Lock in: a fixed problem becomes a saved check (react-checks.js), so it cannot come back.
const REPLAY=new Set(['click','fill','select','scroll','back']);
const MAX_PROBLEMS=10;

function clip(v,n){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
function replayable(steps){return steps.filter(s=>REPLAY.has(s.action)).map(s=>({action:s.action,path:s.path,...(s.label!==undefined?{label:s.label}:{}),...(s.kind?{kind:s.kind}:{}),...(s.ph?{ph:s.ph}:{}),...(s.loc?{loc:s.loc}:{}),...(s.value?{value:s.value}:{})}))}
// What the screen shows, to tell whether an action changed anything.
function signature(o){return o.path+'\n'+o.text+'\n'+o.elements.map(e=>e.kind+':'+e.label).join('|')}

// The element a recorded step used: same label and place in the code, then same label, then
// same place (the code can move after a fix; the label is what a visitor sees).
function findTarget(o,step){
 const kind=e=>!step.kind||e.kind===step.kind;
 const label=e=>step.label!==undefined&&e.label===step.label;
 return o.elements.find(e=>label(e)&&step.loc&&e.loc===step.loc&&kind(e))||o.elements.find(e=>label(e)&&kind(e))||o.elements.find(e=>step.loc&&e.loc===step.loc&&kind(e))||null;
}
// Replays steps in a session. Returns where it stopped and the screens before and after the last step.
async function replay(s,steps){
 let screen=await s.observe();
 const out={done:0,missing:null,failed:null,before:null,after:null};
 for(let i=0;i<steps.length;i++){
  const st=steps[i],needs=['click','fill','select'].includes(st.action);
  const el=needs?findTarget(screen,st):null;
  if(needs&&!el){out.missing={index:i};break}
  const before=screen;
  try{await s.act({action:st.action,target:el&&el.id,value:st.value})}
  catch(e){out.failed={index:i,error:clip(String(e.message||e).split('\n')[0],200)};screen=await s.observe();break}
  screen=await s.observe();
  out.before=before;out.after=screen;out.done=i+1;
 }
 out.end=screen;
 return out;
}

// The likely problem behind one visit that did not reach the goal.
function suspect(v){
 const steps=v.steps;
 const broken=steps.findIndex(s=>s.error&&REPLAY.has(s.action));
 if(broken>=0){const st=steps[broken];return{kind:'broken',path:st.path,label:st.label||'',loc:st.loc,steps:replayable(steps.slice(0,broken+1)),detail:clip(st.error,200)}}
 if(v.error&&/^Uncaught error/.test(v.error))return{kind:'crash',path:(steps.at(-1)||{}).path||'/',label:'',loc:(steps.at(-1)||{}).loc,steps:replayable(steps),detail:clip(v.error,300)};
 // A click the visitor repeated, or right after which they got frustrated or left.
 for(let i=0;i<steps.length;i++){
  const st=steps[i];if(st.action!=='click')continue;
  const next=steps[i+1];
  const again=steps.slice(i+1).some(x=>x.action==='click'&&x.label===st.label&&x.path===st.path);
  if(again||(next&&next.path===st.path&&(next.feeling==='frustrated'||next.action==='give_up')))return{kind:'no_effect',path:st.path,label:st.label||'',loc:st.loc,steps:replayable(steps.slice(0,i+1)),detail:''};
 }
 return{kind:'experience',path:(steps.at(-1)||{}).path||'/',label:'',steps:[],detail:''};
}
function title(p){
 if(p.kind==='broken')return'"'+clip(p.label,60)+'" could not be used';
 if(p.kind==='crash')return'The page shows an error';
 if(p.kind==='no_effect')return'Nothing happens after pressing "'+clip(p.label,60)+'"';
 return'Visitors left on '+p.path;
}
function stepText(st){return st.action+(st.label?' "'+clip(st.label,60)+'"':'')+(st.value&&st.action!=='click'?' with "'+clip(st.value,60)+'"':'')}

// Did the replay show the problem? true / false.
function shows(p,r){
 if(p.kind==='broken')return Boolean(r.failed&&r.failed.index===p.steps.length-1);
 if(p.kind==='crash')return r.end.errors.some(e=>/^Uncaught error/.test(e));
 if(p.kind==='no_effect')return!r.failed&&!r.missing&&r.done===p.steps.length&&signature(r.before)===signature(r.after)&&!r.end.errors.length;
 return false;
}
// Replays one problem's steps on a version (url) in a fresh browser on a test copy of the data.
async function play(id,url,p,{browse,device}){
 const sandbox=require('./react-sandbox');
 return sandbox.withSandbox(id,async box=>{
  const s=await browse(url,{sandbox:box.token,viewport:device});
  if(!s)return null;
  try{return await replay(s,p.steps)}finally{await s.close()}
 });
}

// Reproduces the problems behind the visits that did not reach the goal.
// startUrl: the tested version's preview URL plus the test's start path.
async function reproduce(id,report,{browse,startUrl,signal}){
 const found=new Map();
 for(const v of report.visits){
  if(v.outcome==='completed'||v.outcome==='skipped')continue;
  const p=suspect(v),key=p.kind+'|'+p.path+'|'+p.label+'|'+(p.kind==='crash'?p.detail:'');
  const seen=found.get(key);
  if(seen){if(!seen.visitors.includes(v.persona.name))seen.visitors.push(v.persona.name);continue}
  found.set(key,{...p,device:v.persona.device,visitors:[v.persona.name]});
 }
 const out=[];
 for(const p of [...found.values()].slice(0,MAX_PROBLEMS)){
  if(signal&&signal.aborted)throw Error('Stopped.');
  let status='experience';
  if(p.kind!=='experience'){
   const r=await play(id,startUrl,p,{browse,device:p.device}).catch(()=>null);
   if(!r)status='not_checked';
   else if(shows(p,r))status='confirmed';
   // A click that did change the screen was a visitor's judgement, not a broken button.
   else status=p.kind==='no_effect'?'experience':'not_reproduced';
  }
  const kind=status==='experience'?'experience':p.kind;
  out.push({id:out.length+1,kind,status,title:title({...p,kind}),path:p.path,...(kind!=='experience'?{label:p.label,steps:p.steps,detail:p.detail}:{}),...(p.loc&&kind!=='experience'?{loc:p.loc}:{}),device:p.device,visitors:p.visitors});
 }
 return out;
}

// After a fix: replays each confirmed problem on the new version.
// status: fixed | still (the replay shows it again) | changed (the steps no longer apply, e.g.
// the button was renamed; the rerun judges it).
async function retest(id,problems,{browse,startUrl,signal}){
 const out=[];
 for(const p of problems){
  if(signal&&signal.aborted)throw Error('Stopped.');
  const r=await play(id,startUrl,p,{browse,device:p.device}).catch(()=>null);
  let status;
  if(!r)status='changed';
  else if(shows(p,r))status='still';
  else if(r.missing||(r.failed&&p.kind!=='broken'))status='changed';
  else if(r.failed)status='still';
  else status='fixed';
  out.push({id:p.id,status,replay:r});
 }
 return out;
}

// A saved check from a fixed problem's steps, expecting text that the working step now shows.
function toCheck(p,r,startPath){
 if(!r||r.failed||r.missing||!r.after||p.steps.some(s=>s.action==='back'))return null;
 const old=new Set(String(r.before.text).split('\n').map(x=>x.trim()));
 const shown=String(r.after.text).split('\n').map(x=>x.trim()).find(x=>x.length>=3&&x.length<=80&&!old.has(x));
 if(!shown)return null;
 const steps=[];
 for(const st of p.steps){
  if(st.action==='scroll')continue;
  if(st.action==='click'){
   const role=st.kind==='link'?'link':st.kind==='button'||/^input:(submit|button)$/.test(st.kind||'')?'button':null;
   if(!st.label)return null;
   steps.push(role?{action:'click',role,text:st.label}:{action:'click',text:st.label});
  }else{
   if(!st.label)return null;
   const field=st.ph&&st.ph===st.label?{placeholder:st.label}:{label:st.label};
   steps.push({action:st.action,...field,value:st.value||''});
  }
 }
 steps.push({action:'expect',text:shown});
 return{name:clip('Fixed: '+p.title,80),path:/^#/.test(startPath||'')?startPath:'',steps};
}

// The message that asks the builder to fix a report's problems: confirmed ones with their exact
// steps and place in the code, then what visitors found hard. Unconfirmed ones are left alone.
function fixMessage(report,problems,{round=1,still=[]}={}){
 const at=p=>{const m=/^(src\/[\w./-]+):(\d+)/.exec(p.loc||'');return m?' [code: '+m[1]+' line '+m[2]+']':''};
 const confirmed=problems.filter(p=>p.status==='confirmed');
 const skipped=problems.filter(p=>p.status==='not_reproduced');
 const issues=report.summary.issues||[];
 const lines=['Synthetic customers tested this app (goal: "'+clip(report.test.goal,200)+'"; '+report.numbers.completed+' of '+report.numbers.visitors+' reached it). Fix the problems below without changing what already works.'];
 if(round>1&&still.length)lines.push('Your previous change did not fix these: replaying the same steps still shows the problem. Find the real cause and take a different approach.');
 if(confirmed.length){
  lines.push('','Confirmed by replaying the visitors\' exact steps in a browser:');
  confirmed.forEach((p,i)=>lines.push((i+1)+'. '+p.title+' (page '+p.path+', '+p.device+')'+(p.detail?': '+p.detail:'')+'. Steps: '+p.steps.map(stepText).join(' → ')+'.'+at(p)));
 }
 if(round===1&&issues.length){
  lines.push('','What visitors found hard, in their own words:');
  for(const x of issues)lines.push('- '+x.title+(x.why?': '+x.why:'')+(x.quote?' ("'+x.quote+'")':''));
  if(report.summary.fixes&&report.summary.fixes.length)lines.push('Suggested changes:',...report.summary.fixes.map(f=>'- '+f));
 }
 if(skipped.length)lines.push('','These could not be reproduced, so leave them as they are: '+skipped.map(p=>p.title).join('; ')+'.');
 return lines.join('\n');
}

// Before and after a rerun of the same customers. Issues are matched by their words; issues
// in the old report that the new one no longer mentions are counted as gone.
function words(t){return new Set(String(t).toLowerCase().match(/[a-z]{4,}/g)||[])}
function similar(a,b){const x=words(a),y=words(b);if(!x.size||!y.size)return 0;let n=0;for(const w of x)if(y.has(w))n++;return n/Math.min(x.size,y.size)}
function compare(before,after){
 const used=new Set(),issues=[];
 for(const x of before.summary.issues||[]){
  const i=(after.summary.issues||[]).findIndex((y,j)=>!used.has(j)&&Math.max(similar(x.title,y.title),similar(x.title+' '+x.why,y.title+' '+y.why))>=0.5);
  if(i>=0){used.add(i);issues.push({title:x.title,status:'still'})}else issues.push({title:x.title,status:'gone'});
 }
 (after.summary.issues||[]).forEach((y,j)=>{if(!used.has(j))issues.push({title:y.title,status:'new'})});
 const b=before.numbers,a=after.numbers;
 return{before:{completed:b.completed,visitors:b.visitors,completion_rate:b.completion_rate},after:{completed:a.completed,visitors:a.visitors,completion_rate:a.completion_rate},change:a.completion_rate-b.completion_rate,issues};
}
module.exports={reproduce,retest,replay,suspect,toCheck,fixMessage,compare,findTarget,MAX_PROBLEMS};
