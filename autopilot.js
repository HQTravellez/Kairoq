"use strict";
// Autopilot: Kairoq finishes the job by itself. After a build it tests the app the way the owner
// would judge it (every thing they asked for: done, partly done or missing, with evidence; and
// anything faked or broken), sends what is missing back to the builder as a fix list, and
// repeats until everything passes, a round limit is reached, or two rounds in a row make no
// progress. The owner gets one honest summary: what is done and what is not done yet.
const builder=require('./react-builder');

const JUDGE=`You are the acceptance tester for an app builder. The owner will judge the app by one question: does it do what I asked? Test it as they would.
You get: the owner's request (and the approved plan), screenshots (desktop first, then phone), the app's main code, Kairoq's own automatic test results and, when there are some, what AI customers did when they tried the main task.
For EACH thing the owner asked for and each feature in the approved plan, decide:
- "done": it is there and works (you can see it, or the code clearly does it);
- "partial": it is there but incomplete, wrong or only on one screen size;
- "missing": it is not there, or it is faked (a placeholder, sample data shown as real, an SVG or boxes standing in for a real 3D model or photo, a button that does nothing, a fake success message).
Then list real problems a visitor would hit (broken layout, errors, unreadable text, dead ends). Style preferences are not problems.
Never invent requirements the owner did not ask for. Be strict but fair: evidence for every verdict.
Respond with ONLY JSON: {"items":[{"what":"short name of the requirement","status":"done"|"partial"|"missing","evidence":"what you saw or which file"}],"problems":[{"what":"the problem and where","severity":"major"|"minor","fix":"the concrete change"}],"verdict":"pass"|"fix"}`;

function clip(v,n){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
function json(t){const s=String(t||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');try{return JSON.parse(s)}catch{const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a<0||b<=a)throw Error('The tester did not reply in JSON');return JSON.parse(s.slice(a,b+1))}}
function clean(v){
 const items=(Array.isArray(v&&v.items)?v.items:[]).map(x=>({what:clip(x&&x.what,140),status:['done','partial','missing'].includes(x&&x.status)?x.status:'partial',evidence:clip(x&&x.evidence,240)})).filter(x=>x.what).slice(0,24);
 const problems=(Array.isArray(v&&v.problems)?v.problems:[]).map(x=>({what:clip(x&&x.what,240),severity:x&&x.severity==='major'?'major':'minor',fix:clip(x&&x.fix,240)})).filter(x=>x.what).slice(0,10);
 if(!items.length)throw Error('The tester returned no requirements');
 // The verdict is decided from the findings, not taken on trust.
 const pass=items.every(x=>x.status==='done')&&!problems.some(p=>p.severity==='major');
 return{items,problems,pass};
}
// The app's own code for the tester: pages and feature files first, Kairoq's UI kit left out.
function codeFor(files,limit=32000){
 const names=Object.keys(files||{}).filter(n=>/^src\/.*\.(jsx?|tsx?|json)$/.test(n)&&!/^src\/components\/ui\//.test(n)&&n!=='src/main.jsx')
  .sort((a,b)=>(a==='src/App.jsx'?-1:b==='src/App.jsx'?1:0)||(/pages\//.test(b)-/pages\//.test(a))||a.localeCompare(b));
 let out='';for(const n of names){const part='// '+n+'\n'+String(files[n]).slice(0,6000)+'\n\n';if(out.length+part.length>limit)break;out+=part}
 return out;
}
function content(text,pictures){return[{type:'text',text},...(pictures||[]).slice(0,6).map(p=>({type:'image_url',image_url:{url:'data:'+(p.mime||'image/jpeg')+';base64,'+p.data}}))]}

// One test of the current version. checks: Kairoq's own results from the last build;
// customers: async (url) => short lines about what AI customers did (optional).
async function judge(id,{request,callModel,designShots,customers,checks={},tier='pro',signal}){
 const meta=builder.loadMeta(id);if(!meta.current_version)throw Object.assign(Error('Build the app first'),{status:400});
 const url=builder.previewUrl(meta),files=builder.loadFiles(id,meta.current_version);
 const pictures=designShots?await designShots(url).catch(()=>[]):[];
 let tried='';if(customers)try{tried=await customers(url)}catch(e){if(signal&&signal.aborted)throw e}
 const facts=['The owner\'s request:\n'+clip(request,6000),
  'Kairoq\'s automatic tests: '+((checks.runtime_errors||[]).length?'browser errors: '+checks.runtime_errors.slice(0,5).join(' | '):'no browser errors')+((checks.check_failures||[]).length?'; failed checks: '+checks.check_failures.slice(0,5).map(c=>c.name||c).join(', '):''),
  tried?'What AI customers did when they tried the main task:\n'+clip(tried,3000):'',
  pictures.length?'Screenshots: '+pictures.map(p=>p.name||'screen').join(', ')+'.':'No screenshots are available; judge from the code.',
  'The app\'s code:\n'+codeFor(files)].filter(Boolean).join('\n\n');
 const v=await callModel({tier,messages:[{role:'system',content:JUDGE},{role:'user',content:content(facts,pictures)}],temperature:0.1,maxOutputTokens:2400,purpose:'autopilot-judge',signal},json);
 return{...clean(v),version:meta.current_version};
}
// What the builder is asked to fix after a test.
function fixMessage(t,round){
 const todo=t.items.filter(x=>x.status!=='done'),major=t.problems.filter(p=>p.severity==='major'),minor=t.problems.filter(p=>p.severity!=='major');
 return'Autopilot round '+round+': an acceptance test of the app against the owner\'s request found what is below. Fix all of it now, with real working features (real assets, real data flows), keeping everything that already works. Research or open skills first where you need to.\n'
  +(todo.length?'\nNot done yet:\n'+todo.map(x=>'- '+x.what+' ('+x.status+'): '+x.evidence).join('\n'):'')
  +(major.length?'\nProblems to fix:\n'+major.map(p=>'- '+p.what+' → '+p.fix).join('\n'):'')
  +(minor.length?'\nAlso, if quick:\n'+minor.slice(0,4).map(p=>'- '+p.what+' → '+p.fix).join('\n'):'');
}
// Two tests with the same unfinished items and major problems: no progress.
function signature(t){return[...t.items.filter(x=>x.status!=='done').map(x=>x.what.toLowerCase()),...t.problems.filter(p=>p.severity==='major').map(p=>p.what.toLowerCase().slice(0,60))].sort().join('|')}
// The owner's summary: what is done, and what is not done yet (with why).
function summary(t){
 if(!t)return'';
 const done=t.items.filter(x=>x.status==='done'),rest=t.items.filter(x=>x.status!=='done'),major=t.problems.filter(p=>p.severity==='major');
 return(t.pass?'Autopilot: everything you asked for is in and working.':'Autopilot: '+done.length+' of '+t.items.length+' things you asked for are done.')
  +(done.length?'\nDone: '+done.map(x=>x.what).join('; ')+'.':'')
  +(rest.length?'\nNot done yet: '+rest.map(x=>x.what+' ('+x.evidence+')').join('; ')+'.':'')
  +(major.length?'\nStill to fix: '+major.map(p=>p.what).join('; ')+'.':'');
}
function maxRounds(){const n=Number(process.env.KAIROQ_AUTOPILOT_ROUNDS||3);return Math.max(1,Math.min(6,Number.isInteger(n)?n:3))}
function enabled(){const v=String(process.env.KAIROQ_AUTOPILOT||'').toLowerCase();return v==='on'||(v!=='off'&&require('./quality').top())}

// The loop. test(): one judge() of the current version; edit(message): one builder change that
// returns the build result (with runtime_errors and check_failures).
async function run({test,edit,rounds=maxRounds(),onProgress=()=>{},signal}){
 const log=[];let last=null,result=null,stuck=0,prev=null;
 for(let round=1;round<=rounds+1;round++){
  signal?.throwIfAborted();
  onProgress({round,step:'testing',text:round===1?'Testing the app against your request':'Testing again (round '+round+')'});
  last=await test(result);
  log.push({round,version:last.version,pass:last.pass,done:last.items.filter(x=>x.status==='done').length,total:last.items.length,major:last.problems.filter(p=>p.severity==='major').length});
  if(last.pass||round>rounds)break;
  const sig=signature(last);stuck=sig&&sig===prev?stuck+1:0;prev=sig;
  if(stuck>=1){log.at(-1).stopped='no progress';break}
  onProgress({round,step:'fixing',text:'Fixing '+(last.items.filter(x=>x.status!=='done').length+last.problems.filter(p=>p.severity==='major').length)+' things (round '+round+')'});
  result=await edit(fixMessage(last,round),round);
  if(result&&result.rolled_back){log.at(-1).stopped='the fix broke the app, so it was not kept';}
 }
 return{rounds:log,final:last,summary:summary(last),result};
}
module.exports={JUDGE,judge,run,fixMessage,summary,signature,clean,codeFor,enabled,maxRounds};
