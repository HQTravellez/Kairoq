"use strict";
// "Auto" chat: one fixed order of models, cheapest first. Each step says whether it is set up
// (`ready`) and answers by streaming into the reply (`run`). A step that fails before writing
// anything hands over to the next one; a step that already wrote part of the answer ends the
// chain (the person would otherwise see two half answers). OpenRouter goes last, and after it
// reports "no credits" it is skipped for an hour so it cannot block anything.

const SKIP_MS=60*60*1000;
let openRouterBrokeAt=0;

function noCredits(err){
 return Number(err&&err.status)===402||/no credits|insufficient credits|never purchased credits/i.test(String(err&&err.message||""));
}
function markOpenRouter(err,now=Date.now()){if(noCredits(err))openRouterBrokeAt=now}
function openRouterSkipped(now=Date.now()){return openRouterBrokeAt>0&&now-openRouterBrokeAt<SKIP_MS}
function resetOpenRouter(){openRouterBrokeAt=0}

// steps: [{id, label, ready:()=>bool|Promise<bool>, run:()=>Promise<result>}]
// onTry(label) is called before each attempt (for the "Trying …" status line).
async function run(steps,{onTry=()=>{},onFail=()=>{}}={}){
 const tried=[];
 for(const s of steps){
  let ok=false;
  try{ok=await s.ready()}catch{ok=false}
  if(!ok){tried.push(s.label+" (not set up)");continue}
  onTry(s.label);
  try{
   const result=await s.run();
   return {...(result||{}),step:s.id,tried};
  }catch(err){
   if(s.id==="openrouter")markOpenRouter(err);
   onFail(s,err);
   if(err&&err.afterPartial)throw err;
   tried.push(s.label+" ("+shortReason(err)+")");
  }
 }
 throw Object.assign(Error("No model could answer right now. Tried: "+tried.join("; ")+"."),{status:503,tried});
}
function shortReason(err){
 if(noCredits(err))return "no credits";
 const m=String(err&&err.message||"failed").replace(/\s+/g," ").trim();
 return m.length>90?m.slice(0,87)+"…":m;
}
module.exports={run,noCredits,markOpenRouter,openRouterSkipped,resetOpenRouter,SKIP_MS};
