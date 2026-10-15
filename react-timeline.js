"use strict";
// The timeline of one change, shown live in the chat and in the Details panel (like Lovable):
// thoughts, the plan, files read and edited, builds, browser tests, saved checks and fixes.
// Events: {t, at(ms since start), ...}
//   think {ms, text}    plan {items}    read {files}    edit {file, kind: created|edited|deleted}
//   build {ok, detail}  test {ok, detail}  check {ok, detail}  fix {text, detail}  note {text, icon}
const MAX_EVENTS=150;
function clip(v,n){const s=String(v??'');return s.length>n?s.slice(0,n)+'…':s}
function create(onChange){
 const started=Date.now(),events=[];
 function add(e){
  const ev={...e,at:Date.now()-started};
  if(ev.text!==undefined)ev.text=clip(ev.text,ev.t==='think'?6000:600);
  if(ev.title!==undefined)ev.title=clip(ev.title,400);
  if(ev.detail!==undefined)ev.detail=clip(Array.isArray(ev.detail)?ev.detail.join('\n'):ev.detail,2000);
  events.push(ev);if(events.length>MAX_EVENTS)events.splice(0,events.length-MAX_EVENTS);
  if(onChange)try{onChange(events.slice())}catch{}
  return ev;
 }
 // Files changed between two sets of files, as edit events.
 function edits(before,after,names){
  for(const f of names||[...new Set([...Object.keys(before),...Object.keys(after)])]){
   if(before[f]===after[f])continue;
   add({t:'edit',file:f,kind:!Object.hasOwn(before,f)?'created':!Object.hasOwn(after,f)?'deleted':'edited'});
  }
 }
 return{add,edits,events,started,elapsed:()=>Date.now()-started,stored:()=>events.slice(-MAX_EVENTS)};
}
module.exports={create,MAX_EVENTS};
