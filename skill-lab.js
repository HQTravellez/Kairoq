"use strict";
// Design skills that improve themselves (offline, run by the Kairoq owner). Like an
// executor / analyst / mutator team: the skill is scored on test briefs, a model diagnoses what
// the judge kept marking down, makes ONE targeted change to the skill text, and the change is
// kept only if the score goes up on the training briefs AND does not drop on held-out briefs
// (so the skill does not overfit the test set). Nothing is written over the real skill: the
// result is a proposal for the owner to read and commit.
const ANALYST=`You improve a design skill: written instructions an AI app builder follows when designing apps.
You get the skill and a design judge's notes on apps built with it (scores 1-5 and the problems seen).
Find the ONE most important weakness in the skill text that explains the recurring problems (missing rule, vague rule, rule that causes the problem).
Respond with ONLY JSON: {"diagnosis":"what in the skill causes the problems, quoting it if it exists","change":"the single change to make, concrete"}`;
const MUTATOR=`You edit a design skill (Markdown). Make exactly the change described, nothing else: keep the structure, the other rules and the frontmatter. Rules must be concrete and checkable (sizes, ratios, counts), not adjectives.
Respond with ONLY JSON: {"summary":"one line: what you changed","body":"the complete new skill text"}`;
function json(t){const s=String(t||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');try{return JSON.parse(s)}catch{const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a<0||b<=a)throw Error('not JSON');return JSON.parse(s.slice(a,b+1))}}
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
// evaluate(body, cases) -> {score (mean 1-5), notes:[text]} — builds and judges (or a stub in tests).
async function improve({body,train,holdout=[],evaluate,callModel,rounds=3,minGain=0.15,log=()=>{}}){
 const scan=require('./react-skills').scan;
 let best={body,...await evaluate(body,train)};
 const baseHold=holdout.length?(await evaluate(body,holdout)).score:null;
 log('baseline '+best.score.toFixed(2)+(baseHold!==null?' (held-out '+baseHold.toFixed(2)+')':''));
 const history=[];
 for(let r=1;r<=rounds;r++){
  let a,m;
  try{
   a=await callModel({messages:[{role:'system',content:ANALYST},{role:'user',content:'Skill:\n'+best.body.slice(0,20000)+'\n\nJudge notes (mean '+best.score.toFixed(2)+'):\n'+best.notes.slice(0,30).join('\n')}],temperature:0.3,maxOutputTokens:800},json);
   m=await callModel({messages:[{role:'system',content:MUTATOR},{role:'user',content:'Change to make: '+a.change+'\nWhy: '+a.diagnosis+'\n\nSkill:\n'+best.body.slice(0,20000)}],temperature:0.2,maxOutputTokens:9000},json);
  }catch(e){history.push({round:r,error:String(e.message||e).slice(0,200)});continue}
  const next=String(m.body||'');
  // The new text must still be a safe, sane skill.
  const check=scan(next);
  if(next.length<200||check.blocked.length){history.push({round:r,change:String(m.summary||a.change).slice(0,300),kept:false,reason:check.blocked.length?'unsafe text':'too short'});continue}
  const res=await evaluate(next,train);
  let kept=res.score>=best.score+minGain,hold=null;
  if(kept&&holdout.length){hold=(await evaluate(next,holdout)).score;kept=hold>=baseHold-0.1}
  history.push({round:r,change:String(m.summary||a.change).slice(0,300),diagnosis:String(a.diagnosis||'').slice(0,300),score:Number(res.score.toFixed(2)),...(hold!==null?{holdout:Number(hold.toFixed(2))}:{}),kept});
  log('round '+r+': '+(m.summary||a.change)+' → '+res.score.toFixed(2)+(hold!==null?' / held-out '+hold.toFixed(2):'')+(kept?' KEPT':' discarded'));
  if(kept)best={body:next,...res};
 }
 return{improved:best.body!==body,body:best.body,score:best.score,history};
}
module.exports={improve,mean};
