"use strict";

const continuity=require("./conversation-handoff");
const VERSION=1;

function clean(v,n=1200){
  return String(v??"").replace(/\s+/g," ").trim().slice(0,n);
}
function contentText(content){
  if(typeof content==="string")return content;
  if(!Array.isArray(content))return "";
  return content.map(part=>{
    if(typeof part==="string")return part;
    if(part&&typeof part.text==="string")return part.text;
    return "";
  }).filter(Boolean).join(" ");
}
function normalizeMessages(messages=[]){
  return (Array.isArray(messages)?messages:[]).map(m=>({
    role:m&&m.role==="assistant"?"assistant":"user",
    text:clean(m?.text||contentText(m?.content),6000),
    mode:m?.mode
  })).filter(m=>m.text);
}
function availableCapabilities(capabilities=[]){
  if(Array.isArray(capabilities))return capabilities.map(x=>clean(typeof x==="string"?x:x?.label||x?.id,180)).filter(Boolean).slice(0,24);
  if(capabilities&&typeof capabilities==="object")return Object.entries(capabilities).filter(([,v])=>Boolean(v)).map(([k])=>clean(k.replace(/[_-]+/g," "),180)).slice(0,24);
  return [];
}
function latestUser(messages=[]){
  return [...normalizeMessages(messages)].reverse().find(m=>m.role==="user")?.text||"";
}
function prepare({messages=[],current="",project="",pending_question=null,fromModel="",toModel="",capabilities=[]}={}){
  const normalized=normalizeMessages(messages);
  const meta={name:clean(project,120),messages:normalized,pending_question};
  const state=continuity.state(meta,clean(current,2000)||latestUser(normalized));
  const caps=availableCapabilities(capabilities);
  const checklist={
    conversation_history:normalized.length>0,
    current_topic:Boolean(state.current_topic||state.active_goal||state.latest_user_message),
    decisions_and_corrections:true,
    project_context:Boolean(state.project||state.active_goal||state.current_topic),
    kairoq_capabilities:caps.length>0,
    pending_work:true,
    personality_and_behavior:true
  };
  const ready=Boolean(clean(toModel,160))&&(!normalized.length||checklist.current_topic)&&checklist.kairoq_capabilities;
  return{
    ready,
    checklist,
    handoff:{
      version:VERSION,
      from_model:clean(fromModel,160)||null,
      to_model:clean(toModel,160)||null,
      project:state.project||null,
      active_goal:state.active_goal||null,
      current_topic:state.current_topic||null,
      latest_user_message:state.latest_user_message||null,
      recent_decisions:state.recent_decisions||[],
      pending_question:state.pending_question||null,
      previous_assistant_context:state.previous_assistant_context||null,
      capabilities:caps,
      rules:[
        "Continue the same Kairoq conversation. A model change is not a new assistant or a new thread.",
        "Do not reintroduce yourself, restart onboarding, or ask the user to repeat context already supplied.",
        "Newest explicit user corrections override older conflicting decisions.",
        "Resolve short references such as it, that one, same one, continue, yes and no from the handoff and recent history.",
        "Kairoq runtime capabilities are authoritative. Do not replace them with the incoming model's native product limitations.",
        "Answer the user's next message first and continue the pending work without a recap unless a recap is requested."
      ]
    }
  };
}
function note(input={}){
  const prepared=prepare(input);
  return "\n\nKAIROQ MODEL SWITCH HANDOFF (runtime-owned; incoming model must follow it):\n"+
    JSON.stringify(prepared.handoff)+
    "\nReadiness: "+JSON.stringify(prepared.checklist)+
    "\nThe switch is valid only when ready=true. Model changes. Kairoq does not.";
}
module.exports={VERSION,clean,contentText,normalizeMessages,availableCapabilities,prepare,note};
