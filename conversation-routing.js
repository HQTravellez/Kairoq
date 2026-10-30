"use strict";
// Deterministic intent routing for the unified Kairoq composer.
// The UI may currently say Discuss, but explicit owner instructions to change the app must execute.
function clean(text){return String(text||"").trim().replace(/\s+/g," ")}
function explicitExecution(text){
 const t=clean(text);
 if(!t)return false;
 // Questions about the app stay conversational even if they mention build/fix/change.
 if(/^(?:why|what|how|when|where|who|which|should|would|is|are|does|do you think|can you explain|could you explain)\b/i.test(t))return false;
 if(/^(?:please\s+)?(?:go ahead|proceed|do it|finish it|ship it|apply it)\b[.!?\s]*$/i.test(t))return true;
 return /^(?:(?:please|now)\s+)*(?:(?:can|could|would)\s+you\s+)?(?:build|implement|create|make|add|change|fix|update|remove|delete|redesign|finish|apply|ship|connect|integrate)\b/i.test(t);
}
function proposalApproval(text){
 const t=clean(text);
 if(!t)return false;
 return /^(?:yes|yep|yeah|ok|okay|approved|sounds good|go ahead|proceed|do it|let'?s do it|build it|make it|finish it|ship it|apply it)[.!?\s]*$/i.test(t)
  || /^(?:please\s+)?(?:implement|build|apply|finish|ship|do)\s+(?:this|that|the)\s+(?:plan|proposal)\b/i.test(t);
}
module.exports={explicitExecution,proposalApproval};
