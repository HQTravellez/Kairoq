"use strict";
// Match score for "Build from a reference": how much of the reference's planned functionality
// the app does, weighted like Replica's parity.py (github.com/Jakeschincariol/replica-skill,
// MIT): must 3, should 2, could 1; done 1, partly 0.5, missing 0. Fixes the owner added from
// the reviews are not in the score (they are extra) and are listed on their own.
const builder=require('./react-builder');
const WEIGHT={1:3,2:2,3:1},VALUE={yes:1,partial:0.5,no:0};
const LABEL={1:'must',2:'should',3:'nice to have'};

function score(rows){
 const counted=rows.filter(r=>!r.added&&r.status!=='skip');
 const total=counted.reduce((n,r)=>n+(WEIGHT[r.priority]||2),0);
 const got=counted.reduce((n,r)=>n+(WEIGHT[r.priority]||2)*(VALUE[r.status]??0),0);
 const musts=counted.filter(r=>r.priority===1);
 return{score:total?Math.round(100*got/total):null,
  musts_done:musts.filter(r=>r.status==='yes').length,musts:musts.length,
  missing:counted.filter(r=>r.status!=='yes').sort((a,b)=>(a.priority-b.priority)||(VALUE[a.status]-VALUE[b.status])).map(r=>({name:r.name,priority:LABEL[r.priority]||'should',status:r.status,why:r.why||''})),
  added:rows.filter(r=>r.added).map(r=>({name:r.name,status:r.status}))};
}
const JUDGE_PROMPT=`You check an app's code against its feature list. For each feature, say whether the code really does it: "yes" (works end to end: screen, saved data and actions), "partial" (some of it: e.g. a screen with no saving, or missing an important part) or "no" (absent or only a placeholder). Judge only from the code. Be strict: a button that does nothing or fake data in place of saving is "partial" at best.
Return ONLY JSON: {"features":[{"name":"exact feature name","status":"yes|partial|no","why":"one short reason, plain words"}]}`;
async function judge(id,{plan,callModel,signal,journeys}={}){
 const meta=builder.loadMeta(id),files=builder.loadFiles(id,meta.current_version);
 const feats=(plan.features||[]).filter(f=>f.enabled!==false);
 if(!feats.length)return null;
 const list=feats.map(f=>'- '+f.name+(f.description?': '+f.description:'')).join('\n');
 const passed=journeys&&journeys.length?'\n\nUser journeys tested in a browser:\n'+journeys.map(j=>'- '+j.name+': '+(j.ok?'passed':'failed')).join('\n'):'';
 const out=await callModel({maxOutputTokens:2500,signal,messages:[{role:'system',content:JUDGE_PROMPT},{role:'user',content:'Features:\n'+list+passed+'\n\nCode:\n'+builder.contextFiles(files,90000)}]});
 const said=new Map((Array.isArray(out&&out.features)?out.features:[]).map(x=>[String(x.name||'').toLowerCase().trim(),x]));
 const rows=feats.map(f=>{const x=said.get(f.name.toLowerCase().trim())||{};const status=['yes','partial','no'].includes(x.status)?x.status:'no';
  return{name:f.name,priority:f.priority||2,added:Boolean(f.added),status,why:String(x.why||(x.status?'':'not checked')).slice(0,200)}});
 const result={...score(rows),rows,version:meta.current_version,at:new Date().toISOString(),out_of_scope:plan.out_of_scope||[]};
 const fresh=builder.loadMeta(id);if(fresh.reference){fresh.reference.match=result;builder.saveMeta(fresh)}
 return result;
}
// The chat message that builds what is missing, most important first.
function missingMessage(m){
 const todo=(m&&m.missing||[]).slice(0,8);if(!todo.length)return'';
 return'Finish these features from the plan, most important first, and make each one work end to end (screens, saving and actions):\n'+todo.map(x=>'- '+x.name+' ('+x.priority+(x.status==='partial'?', partly done':'')+')'+(x.why?': '+x.why:'')).join('\n');
}
function summaryLine(m){
 if(!m||m.score==null)return'';
 return'Match score '+m.score+'%'+(m.musts?', '+m.musts_done+' of '+m.musts+' must-haves done':'')+(m.missing.length?'. Missing: '+m.missing.slice(0,3).map(x=>x.name).join(', ')+(m.missing.length>3?' and '+(m.missing.length-3)+' more':''):'. Nothing missing.');
}
module.exports={score,judge,missingMessage,summaryLine,WEIGHT};
