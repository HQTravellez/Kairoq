"use strict";
// Deterministic intent routing for the unified Kairoq composer.
// The UI may currently say Discuss, but explicit owner instructions to change the app must execute.
function clean(text){return String(text||"").trim().replace(/\s+/g," ")}
// "ok build it", "yes, go ahead", "great then make it": a short yes in front does not change the ask.
function unlead(t){return t.replace(/^(?:(?:ok|okay|k|yes|yeah|yep|sure|great|perfect|cool|alright|all right|fine|good|nice|awesome|right|so|then|now)\b[\s,.!-]*)+/i,"")}
// Common typos of "build" on a phone keyboard.
const BUILD="(?:build|bild|buld|biuld|buidl|buil)";
function explicitExecution(text){
 const t=unlead(clean(text));
 if(!t)return false;
 // Questions about the app stay conversational even if they mention build/fix/change.
 if(/^(?:why|what|how|when|where|who|which|should|would|is|are|does|do you think|can you explain|could you explain)\b/i.test(t))return false;
 if(/^(?:please\s+)?(?:go ahead|proceed|do it|finish it|ship it|apply it)\b[.!?\s]*$/i.test(t))return true;
 return new RegExp("^(?:(?:please|now)\\s+)*(?:(?:can|could|would)\\s+you\\s+)?(?:"+BUILD+"|implement|create|make|add|change|fix|update|remove|delete|redesign|finish|apply|ship|connect|integrate)\\b","i").test(t);
}
function proposalApproval(text){
 const t=clean(text);
 if(!t)return false;
 if(/^(?:ok|okay|yes|yeah|yep|sure|great|perfect|cool|alright|fine)\b[\s,.!-]*(?:go ahead|proceed|do it|build it|bild it|make it|finish it|ship it|apply it)[.!?\s]*$/i.test(t))return true;
 return /^(?:yes|yep|yeah|ok|okay|approved|sounds good|go ahead|proceed|do it|let'?s do it|build it|make it|finish it|ship it|apply it)[.!?\s]*$/i.test(t)
  || /^(?:please\s+)?(?:implement|build|apply|finish|ship|do)\s+(?:this|that|the)\s+(?:plan|proposal)\b/i.test(t);
}
module.exports={explicitExecution,proposalApproval};
