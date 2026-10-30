"use strict";

function text(v){return String(v||"").trim()}
function apiTopic(message){
 const t=text(message);
 return /\b(api|apis|endpoint|endpoints|openapi|swagger|postman|webhook|oauth|rest|graphql|sdk)\b/i.test(t);
}
function hasUrl(message){return /https?:\/\/[^\s)\]}>]+/i.test(text(message))}
function capabilityQuestion(message){
 const t=text(message);
 if(!apiTopic(t)||hasUrl(t))return false;
 return /\b(can|could|do|does|will|are|is)\b[^?\n]{0,80}\b(kairoq|you|it)\b[^?\n]{0,100}\b(work|use|connect|integrate|read|browse|inspect|understand|learn|test|call|handle|support)\b/i.test(t)
  || /\b(any|every)\s+api\b/i.test(t)
  || /\bwhat\s+(?:can|do)\s+(?:you|kairoq)\s+do\b[^?\n]{0,80}\bapi/i.test(t);
}
function docsResearchRequest(message){
 const t=text(message);
 if(!hasUrl(t)||!apiTopic(t))return false;
 return /\b(check|read|inspect|review|analyse|analyze|understand|learn|research|look at|use|integrate|connect|test|try|verify|explore)\b/i.test(t)
  || /\b(api|openapi|swagger|postman)\s+(?:docs?|documentation|spec|url|link)\b/i.test(t);
}
function falseCapabilityDenial(answer){
 const a=text(answer);
 return /\b(?:can(?:not|'t)|unable to|do not|don't)\b[^.\n]{0,100}\b(?:browse|access|reach|fetch|open|read)\b[^.\n]{0,80}\b(?:web|website|url|docs?|documentation)\b/i.test(a)
  || /\bonly if you (?:paste|share|provide)\b[^.\n]{0,100}\b(?:docs?|documentation|spec)/i.test(a)
  || /\b(?:can(?:not|'t)|unable to)\b[^.\n]{0,120}\btest\b[^.\n]{0,80}\b(?:api|endpoint)/i.test(a);
}
function capabilityAnswer(){
 return [
  "Yes. Kairoq can inspect public API documentation from a URL (including OpenAPI/Swagger/Postman-style docs), understand the contract, and use that evidence while building an integration.",
  "It can also test live API operations when Kairoq's API execution workflow is enabled and the target host/operation is allowlisted, the required credential or OAuth connection is configured, and you explicitly approve the call. It will not invent API keys or claim a request succeeded without an observed response.",
  "Send the API documentation URL or spec and tell Kairoq what you want to build or verify; you do not need to paste the whole documentation into chat."
 ].join("\n\n");
}
function guardDiscussAnswer(message,answer){
 return apiTopic(message)&&falseCapabilityDenial(answer)?capabilityAnswer():answer;
}
module.exports={apiTopic,hasUrl,capabilityQuestion,docsResearchRequest,falseCapabilityDenial,capabilityAnswer,guardDiscussAnswer};
