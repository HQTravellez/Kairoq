"use strict";

// Kairoq Goal Orchestrator
// Creates the smallest useful specialist team for a goal while preserving one execution owner.
// It does not grant tools or write authority to specialists.

const PHASES=Object.freeze(["understand","plan","execute","verify","repair","ready","blocked"]);
const ROLE_RULES=Object.freeze([
  {role:"api",when:/\b(api|openapi|swagger|postman|webhook|oauth|sdk|integration|endpoint)\b/i},
  {role:"security",when:/\b(auth|authentication|authorization|payment|secret|credential|permission|security|private data|pii)\b/i},
  {role:"design",when:/\b(ui|ux|design|layout|website|dashboard|screen|responsive|mobile|redesign)\b/i},
  {role:"qa",when:/\b(test|verify|qa|regression|broken|bug|failure|repair|fix)\b/i},
  {role:"architect",when:/\b(architecture|refactor|migrate|multi[- ]?page|system|database|backend|workflow|repo|repository)\b/i},
  {role:"product",when:/\b(build|create|feature|customer|user flow|requirements?|product|app)\b/i}
]);

function clean(v,n=300){return String(v||"").replace(/\s+/g," ").trim().slice(0,n)}

function teamFor(goal,{max=3}={}){
  const text=String(goal||"");
  const scored=[];
  for(const rule of ROLE_RULES){
    if(rule.when.test(text))scored.push(rule.role);
  }
  if(!scored.includes("qa"))scored.push("qa");
  if(!scored.includes("architect")&&/\b(build|create|implement|change|integrate|migrate|fix|repair)\b/i.test(text))scored.unshift("architect");
  if(!scored.includes("product")&&/\b(build|create|feature|workflow|app|website|dashboard)\b/i.test(text))scored.push("product");
  return [...new Set(scored)].slice(0,Math.max(1,Math.min(3,Number(max)||3)));
}

function objective(goal){
  const text=clean(goal,4000);
  if(!text)throw Error("Goal is required");
  return {
    objective:text,
    success:"Deliver the requested outcome with executor-owned evidence and no known blocking errors.",
    constraints:[
      "Use existing Kairoq capabilities before proposing new frameworks.",
      "Parallelize independent analysis; keep one writer for source changes.",
      "Do not mark work complete without observed verification.",
      "Do not add scope during repair."
    ]
  };
}

function create(goal,{maxAgents=3}={}){
  const contract=objective(goal);
  return {
    version:1,
    phase:"understand",
    contract,
    team:teamFor(goal,{max:maxAgents}),
    consultations:[],
    blockers:[],
    evidence:[],
    repairRounds:0,
    startedAt:new Date().toISOString()
  };
}

function next(state,event={}){
  if(!state||!PHASES.includes(state.phase))throw Error("Invalid orchestration state");
  const type=String(event.type||"");
  const out=structuredClone(state);

  if(type==="understood"&&out.phase==="understand")out.phase="plan";
  else if(type==="planned"&&out.phase==="plan")out.phase="execute";
  else if(type==="implemented"&&out.phase==="execute")out.phase="verify";
  else if(type==="verified"&&out.phase==="verify"){
    if(event.ok===true){out.phase="ready";out.completedAt=new Date().toISOString();}
    else {out.phase="repair";out.repairRounds++;}
  }
  else if(type==="repaired"&&out.phase==="repair")out.phase="verify";
  else if(type==="blocked"){
    out.phase="blocked";
    out.blockers=[...out.blockers,{reason:clean(event.reason,700),action:clean(event.action,500),at:new Date().toISOString()}].slice(-12);
  }
  else throw Error("Invalid orchestration transition: "+out.phase+" -> "+type);

  if(event.evidence)out.evidence=[...out.evidence,{phase:state.phase,detail:clean(event.evidence,1000),at:new Date().toISOString()}].slice(-30);
  return out;
}

function specialistQuestion(state){
  const roles=state.team;
  const goal=state.contract.objective;
  const focus=state.phase==="understand"
    ?"Find missing facts, constraints, dependencies and risks before implementation."
    :state.phase==="plan"
      ?"Review the smallest complete implementation plan and its acceptance evidence."
      :state.phase==="verify"
        ?"Independently identify the strongest verification needed before Ready."
        :"Review the remaining blocker and recommend the smallest repair.";
  return {
    roles,
    question:"Goal: "+goal+"\nCurrent phase: "+state.phase+". "+focus
  };
}

function summary(state){
  return {
    phase:state.phase,
    team:state.team,
    repairRounds:state.repairRounds,
    blockers:state.blockers,
    evidenceCount:state.evidence.length,
    ready:state.phase==="ready"
  };
}

module.exports={PHASES,ROLE_RULES,teamFor,objective,create,next,specialistQuestion,summary};
