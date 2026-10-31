"use strict";

// Deterministic conversation handoff shared by every model/mode.
// The model may change; Kairoq's thread/topic state must not.

const FOLLOWUP=/^(?:yes|yeah|yep|ok(?:ay)?|sure|do it|go ahead|continue|that one|this one|the other one|same|exactly|why|how|what about|and|also|then|now|fix it|try again|again|please do|can you do that)[\s?.!]*$/i;
const GREETING=/^(?:hi|hello|hey|good (?:morning|afternoon|evening)|thanks|thank you)[\s!.]*$/i;
const DECISION=/\b(?:i want|i need|use|keep|remove|don't|do not|no |yes |make|change|instead|must|should|prefer|not that|same as|simple|only|never|always|decided|we want|we need)\b/i;

function clean(v,n=900){return String(v||"").replace(/\s+/g," ").trim().slice(0,n)}

function substantiveUser(messages=[]){
 return messages.filter(m=>m&&m.role==="user"&&m.text&&!GREETING.test(String(m.text).trim()));
}
function lastAssistant(messages=[]){
 return [...messages].reverse().find(m=>m&&m.role==="assistant"&&m.text);
}
function currentTopic(meta,current=""){
 const users=substantiveUser(meta.messages||[]);
 const now=clean(current,1400);
 const previous=[...users].reverse().find(m=>clean(m.text,1400)!==now);
 if(now&&!FOLLOWUP.test(now)&&now.split(/\s+/).length>3)return now;
 return clean(previous?.text||now||"",1400);
}
function activeGoal(meta){
 const users=substantiveUser(meta.messages||[]);
 const build=[...users].reverse().find(m=>m.mode!=="discuss"&&clean(m.text,1200).length>3);
 return clean(build?.text||users[0]?.text||"",1400);
}
function decisions(meta){
 return substantiveUser(meta.messages||[])
  .filter(m=>DECISION.test(String(m.text)))
  .slice(-8).map(m=>clean(m.text,500)).filter(Boolean);
}
function state(meta,current=""){
 const last=lastAssistant(meta.messages||[]);
 return{
  project:clean(meta.name,120),
  active_goal:activeGoal(meta),
  current_topic:currentTopic(meta,current),
  latest_user_message:clean(current,1200),
  recent_decisions:decisions(meta),
  pending_question:meta.pending_question?clean(meta.pending_question.q||meta.pending_question,500):null,
  previous_assistant_context:clean(last?.text,900)
 };
}
function note(meta,current=""){
 const s=state(meta,current);
 return "\n\nKAIROQ CONVERSATION HANDOFF (runtime-owned; use this to preserve continuity across model changes):\n"+
  JSON.stringify(s)+
  "\nRules:\n"+
  "- Continue the same conversation and topic. A model switch, mode switch, greeting, or short follow-up never resets the thread.\n"+
  "- Resolve words like it, this, that, same, other one, yes, no, continue, and do it from this handoff plus recent history.\n"+
  "- Preserve the user's latest decisions and corrections unless the user explicitly changes them. Do not ask again for a decision already made.\n"+
  "- Answer the latest user message first, but keep it anchored to current_topic and active_goal.\n"+
  "- Do not reintroduce yourself, restart onboarding, recap everything, or change personality because the underlying model changed.\n"+
  "- If recent history conflicts with an older decision, the newest explicit user direction wins.";
}

module.exports={FOLLOWUP,GREETING,DECISION,clean,substantiveUser,currentTopic,activeGoal,decisions,state,note};
