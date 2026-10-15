"use strict";
// Saved checks: flows that worked once (book a room, sign up, add to cart) are kept as
// browser steps and replayed after every change, before publishing and on a schedule.
// Each check runs in a real browser against a test copy of the app's data (react-sandbox.js),
// so it never creates real bookings, sends real emails or starts payments.
const crypto=require('crypto');
const builder=require('./react-builder');

const MAX_CHECKS=15,MAX_STEPS=20;
const ACTIONS=['click','fill','select','press','expect','goto','wait'];
function cleanStep(s){
 if(!s||typeof s!=='object'||!ACTIONS.includes(s.action))return null;
 const out={action:s.action};
 for(const k of ['text','label','placeholder','role','selector','value','key','path'])if(s[k]!==undefined&&s[k]!==null)out[k]=String(s[k]).slice(0,300);
 if(s.action==='wait')out.ms=Math.min(3000,Math.max(0,Number(s.ms)||500));
 if(s.absent)out.absent=true;
 return out;
}
function normalize(c){
 const name=String(c&&c.name||'').replace(/\s+/g,' ').trim().slice(0,80);
 if(!name)throw Object.assign(Error('A check needs a name'),{status:400});
 const steps=(Array.isArray(c.steps)?c.steps:[]).map(cleanStep).filter(Boolean).slice(0,MAX_STEPS);
 if(!steps.length)throw Object.assign(Error('A check needs at least one step'),{status:400});
 if(!steps.some(s=>s.action==='expect'))throw Object.assign(Error('A check needs at least one "expect" step that proves the flow worked'),{status:400});
 const p=String(c.path||'');
 return{name,path:/^#[\w\-/?=&%.]*$/.test(p)?p.slice(0,200):'',steps};
}
function list(meta){return Array.isArray(meta.checks)?meta.checks:[]}
// Adds a check, or replaces the one with the same name.
function save(id,check,{source='user'}={}){
 const c=normalize(check),meta=builder.loadMeta(id),checks=list(meta);
 const existing=checks.find(x=>x.name.toLowerCase()===c.name.toLowerCase());
 if(!existing&&checks.length>=MAX_CHECKS)throw Object.assign(Error('A project can keep up to '+MAX_CHECKS+' checks. Remove one first.'),{status:400});
 const entry={...(existing||{id:crypto.randomBytes(6).toString('hex'),created_at:new Date().toISOString(),enabled:true}),...c,source,updated_at:new Date().toISOString()};
 meta.checks=existing?checks.map(x=>x===existing?entry:x):[...checks,entry];
 builder.saveMeta(meta);
 return entry;
}
function remove(id,checkId){
 const meta=builder.loadMeta(id),checks=list(meta);
 if(!checks.some(c=>c.id===checkId))throw Object.assign(Error('Unknown check'),{status:404});
 meta.checks=checks.filter(c=>c.id!==checkId);builder.saveMeta(meta);return meta.checks;
}
function setEnabled(id,checkId,enabled){
 const meta=builder.loadMeta(id),c=list(meta).find(x=>x.id===checkId);
 if(!c)throw Object.assign(Error('Unknown check'),{status:404});
 c.enabled=Boolean(enabled);builder.saveMeta(meta);return c;
}

// Runs the enabled checks against a built version. versionUrl is the preview URL of that version
// (a path like /builder/p/…/v/3/); inspect(url,{steps,sandbox}) comes from runtime-check.js.
// Returns {ran, passed, failed:[{id,name,step,error}], skipped}.
async function run(id,versionUrl,{inspect,checks,record=true,version,viewport}={}){
 const meta=builder.loadMeta(id),todo=(checks||list(meta)).filter(c=>c.enabled!==false);
 if(!todo.length||!inspect)return{ran:0,passed:0,failed:[],skipped:!inspect&&todo.length>0};
 const sandbox=require('./react-sandbox'),results=[];
 for(const c of todo){
  const r=await sandbox.withSandbox(id,async box=>inspect(versionUrl+(c.path||''),{steps:c.steps,screenshot:false,sandbox:box.token,...(viewport?{viewport}:{})}));
  if(r.skipped)return{ran:0,passed:0,failed:[],skipped:true};
  const bad=r.steps.find(s=>!s.ok);
  const crash=r.errors.find(e=>/^(Uncaught error|Blank page|Page did not load|Layout overflow)/.test(e));
results.push({id:c.id,name:c.name+(viewport==='phone'?' (phone)':''),ok:!bad&&!crash,step:bad?stepLabel(bad.step):'',error:bad?String(bad.error).replace(/^locator\.\w+: /,''):crash||''});
 }
 if(record&&viewport!=='phone'){
  const fresh=builder.loadMeta(id),at=new Date().toISOString();
  for(const r of results){const c=list(fresh).find(x=>x.id===r.id);if(c)c.last={ok:r.ok,at,version:version||null,...(r.ok?{}:{step:r.step,error:String(r.error).slice(0,300)})}}
  builder.saveMeta(fresh);
 }
 const failed=results.filter(r=>!r.ok).map(({ok,...r})=>r);
 return{ran:results.length,passed:results.length-failed.length,failed,skipped:false};
}
// A readable step, e.g. click "Book now" (inspect reports steps as JSON).
function stepLabel(raw){let s;try{s=JSON.parse(raw)}catch{return String(raw).slice(0,120)}const target=s.text?'"'+s.text+'"':s.label?'the "'+s.label+'" field':s.placeholder?'"'+s.placeholder+'"':s.selector||s.path||s.key||'';return(s.action==='expect'?(s.absent?'expect not to see ':'expect to see '):s.action+' ')+target+(s.action==='fill'&&s.value?' with "'+s.value+'"':'')}
// The text sent back to the model when a change breaks saved checks.
function failureText(failed){
 return failed.map(f=>'- "'+f.name+'": '+(f.step?'step '+f.step+' failed: '+f.error:f.error)).join('\n');
}
function promptNote(meta){
 const checks=list(meta).filter(c=>c.enabled!==false);
 if(!checks.length)return'';
 return'\n\nSAVED CHECKS: these flows work today and are re-tested in a browser after your change. Keep them working (same labels, buttons and texts they use) unless the user explicitly asks to change that flow:\n'+checks.map(c=>'- '+c.name+': '+c.steps.map(s=>s.action+(s.text?' "'+s.text+'"':s.label?' '+s.label:'')).join(' → ')).join('\n');
}

// Turns a plain-English description into check steps using the model, from the app's visible text.
const WRITE_PROMPT=`You write automated browser checks for a web app. Given a description of a flow and the app's current source, return the steps a test browser should take, ending with "expect" steps that prove the flow worked.
Respond with ONLY JSON: {"name":"short name","path":"#/optional-hash-route","steps":[...]}
Steps: {"action":"click","text":"Book now"} {"action":"fill","label":"Email","value":"ana@example.com"} {"action":"select","label":"Room","value":"Suite"} {"action":"press","key":"Enter"} {"action":"expect","text":"Thank you"} {"action":"goto","path":"#/rooms"} {"action":"wait","ms":500}. Target elements by the exact visible text, label or placeholder in the source. Use realistic test data (test-<word>@example.com emails). At most 20 steps.`;
async function write(id,description,{callModel,tier='standard',signal}){
 const meta=builder.loadMeta(id),files=builder.loadFiles(id,meta.current_version);
 const messages=[{role:'system',content:WRITE_PROMPT},{role:'user',content:'App source:\n'+builder.contextFiles(files,60000)+'\n\nFlow to check: '+String(description).slice(0,1000)}];
 return callModel({messages,temperature:0,maxOutputTokens:2500,signal,tier},content=>{
  const t=String(content||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');
  let v;try{v=JSON.parse(t)}catch{const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<=a)throw Error('Check was not JSON');v=JSON.parse(t.slice(a,b+1))}
  return normalize(v);
 });
}
// The daily monitor: re-runs every published app's checks on its live version, and emails the
// owner when a check starts failing (once, not every day while it stays broken).
async function monitorAll({inspect,send}={}){
 const extras=require('./react-backend-extras'),out=[];
 for(const p of builder.list()){
  let meta;try{meta=builder.loadMeta(p.id)}catch{continue}
  const n=meta.published&&meta.published.version;
  if(!n||!list(meta).some(c=>c.enabled!==false))continue;
  let r;try{r=await run(p.id,builder.previewUrl(meta,n),{inspect,version:n})}catch(e){continue}
  if(r.skipped)return out;
  const fresh=builder.loadMeta(p.id),wasOk=!fresh.monitor||fresh.monitor.ok,ok=!r.failed.length;
  fresh.monitor={at:new Date().toISOString(),ok,version:n,ran:r.ran,failed:r.failed.map(f=>f.name)};
  builder.saveMeta(fresh);
  if(!ok&&wasOk){const to=extras.ownerEmail(fresh);if(to)try{await(send||extras.deliver)(to,fresh.name+': '+r.failed.length+' check'+(r.failed.length===1?'':'s')+' failing on your live app','These flows stopped working on the published version of '+fresh.name+':\n\n'+failureText(r.failed)+'\n\nOpen the project in Kairoq and use "Fix it", or restore an earlier version.')}catch{}}
  out.push({id:p.id,ok,failed:r.failed.length});
 }
 return out;
}
module.exports={monitorAll,normalize,list,save,remove,setEnabled,run,failureText,promptNote,write,MAX_CHECKS};
