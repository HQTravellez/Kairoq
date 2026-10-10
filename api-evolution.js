"use strict";
// Deterministic API drift detection: never silently change live adapters.
const api=require("./api-learning");
function plan(input){return input?.operations?input:api.learn(input);}
function diff(before,after){
 const old=plan(before),next=plan(after),oldOps=new Map(old.operations.map(x=>[x.method+" "+x.path,x])),newOps=new Map(next.operations.map(x=>[x.method+" "+x.path,x]));
 const removed=[],added=[],changed=[];
 for(const [key,prev] of oldOps){
  const now=newOps.get(key);if(!now){removed.push(key);continue;}
  const oldReq=new Set((prev.requiredParameters||[]).map(p=>p.in+":"+p.name)),newReq=new Set((now.requiredParameters||[]).map(p=>p.in+":"+p.name));
  const newRequired=[...newReq].filter(x=>!oldReq.has(x));
  const oldFields=new Map((prev.bodyFields||[]).map(f=>[f.name,f])),newFields=new Map((now.bodyFields||[]).map(f=>[f.name,f]));
  const newRequiredFields=[...newFields].filter(([n,f])=>f.required&&!oldFields.get(n)?.required).map(([n])=>n);
  const removedFields=[...oldFields.keys()].filter(n=>!newFields.has(n));
  const typeChanges=[...oldFields].filter(([n,f])=>newFields.has(n)&&newFields.get(n).type!==f.type).map(([n])=>n);
  if(newRequired.length||newRequiredFields.length||removedFields.length||typeChanges.length)changed.push({operation:key,newRequiredParameters:newRequired,newRequiredFields,removedFields,typeChanges});
 }
 for(const key of newOps.keys())if(!oldOps.has(key))added.push(key);
 return{previousVersion:old.version||"",nextVersion:next.version||"",breaking:removed.length>0||changed.length>0,removed,added,changed,requiresReview:removed.length>0||changed.length>0,summary:removed.length+" removed, "+added.length+" added, "+changed.length+" modified operations"};
}
module.exports={diff};
