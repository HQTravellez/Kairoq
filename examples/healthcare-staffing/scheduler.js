"use strict";
/** Pure rules engine demo: synthetic records only, not patient data or clinical advice. */
function minutes(iso){const ms=Date.parse(iso);if(!Number.isFinite(ms)||!/[zZ]|[+-]\d\d:\d\d$/.test(iso))throw Error("Use ISO timestamps with timezone");return ms}
function validateShift(shift){if(!shift||!shift.id||!shift.role||!shift.site)throw Error("Shift needs id, role and site");const start=minutes(shift.start),end=minutes(shift.end);if(end<=start)throw Error("Shift end must follow start");return{...shift,startMs:start,endMs:end}}
function assign(shift,staff,existing=[]){
 const s=validateShift(shift);
 if(!staff||!staff.id)return{ok:false,reasons:["Missing staff"]};
 const reasons=[];
 if(!Array.isArray(staff.qualifications)||!staff.qualifications.includes(s.role))reasons.push("Required qualification missing");
 if(Array.isArray(staff.available)&&!staff.available.some(a=>minutes(a.start)<=s.startMs&&minutes(a.end)>=s.endMs))reasons.push("Staff not available for full shift");
 for(const a of existing.filter(x=>x.staffId===staff.id)){const p=validateShift(a);if(s.startMs<p.endMs&&s.endMs>p.startMs)reasons.push("Overlapping assignment "+a.id)}
 return{ok:reasons.length===0,reasons};
}
function schedule(shifts,staff,assignments=[]){const byId=new Map(staff.map(s=>[s.id,s]));return shifts.map(s=>({shiftId:s.id,eligible:staff.filter(x=>assign(s,x,assignments).ok).map(x=>x.id),assigned:assignments.find(a=>a.id===s.id)?.staffId||null}));}
module.exports={minutes,validateShift,assign,schedule};
