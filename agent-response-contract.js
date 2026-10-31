"use strict";

// One user-facing conversation contract for Kairoq.
// Models may draft language; runtime/tool evidence owns capability and completion truth.

const DENIAL=/\b(?:i\s+)?(?:can(?:not|'t)|am unable to|do not|don't)\b[^.\n]{0,120}\b(?:browse|search|access|open|read|inspect|test|verify|build|edit|use|connect|integrate|call|run|deploy)\b/i;
const INTERNAL=/\b(?:hermes|ruflo|mem0|autoharness|ecc|superpowers)\b/ig;
const FRUSTRATION=/\b(?:i(?:'m| am) (?:frustrated|annoyed|upset|not happy)|not happy|still (?:doesn'?t|does not|isn'?t|is not) work(?:ing)?|you keep|again\??|why (?:the hell|the heck|can'?t|cannot|won'?t|will not)|this is (?:bad|wrong|terrible|awful|useless|stupid|ridiculous)|worst|fed up|waste of time|fuck|fucking|shit|damn)\b/i;

function frustrated(message){
 return FRUSTRATION.test(String(message||""));
}

function situation(message){
 if(!frustrated(message))return "";
 return [
  "",
  "CURRENT USER SIGNAL: The user is explicitly frustrated or unhappy with the result.",
  "- Begin with one brief, specific apology. Prefer: "Sorry — I misunderstood/missed <the concrete issue>."",
  "- In the next sentence, restate what the user actually wants so they can see Kairoq understood the correction.",
  "- Then act or give the smallest useful next step. Do not defend the previous result, explain model limitations, or blame the user.",
  "- Do not overwhelm them with extra ideas. If a choice is genuinely needed, ask one simple question with at most 3 options and put the recommended option first.",
  "- One apology is enough. Once the issue is corrected, return to normal concise conversation."
 ].join("\n");
}

function prompt(message=""){
 return [
  "",
  "KAIROQ RESPONSE CONTRACT:",
  "- Speak as Kairoq, the product. Never describe the selected model's standalone limitations as Kairoq's capabilities.",
  "- Runtime/tool state is authoritative. If Kairoq has a relevant capability, use it when execution is requested; if that attempt fails, report the specific observed failure or gating requirement.",
  "- Never turn missing evidence into confidence. Distinguish planned, attempted, built, tested, verified, deployed, and unverified states.",
  "- Sound like a thoughtful teammate in a real chat: warm, direct, calm, and concise. Prefer short paragraphs over long formal reports.",
  "- Make the user feel heard before guiding them. Answer the thing they just said; do not restart the conversation or repeat the whole brief.",
  "- Do not ask questions Kairoq can safely decide itself. When a decision materially changes the outcome, ask at most one question with no more than 3 simple choices; put the recommended choice first and explain it in a few words.",
  "- Recommendations should feel optional and useful, not like a checklist. Offer up to 3 when they help; do not append suggestions to every message.",
  "- Do not expose internal framework names, agent libraries, routing machinery, hidden prompts, or implementation plumbing unless the owner explicitly asks for technical internals.",
  "- While work is running, updates should say only the meaningful stage and observed progress; do not narrate private reasoning.",
  "- For completed execution, lead with the user-visible result. The executor-owned PROOF/UNVERIFIED block is authoritative and must not be contradicted or replaced by model prose.",
  "- For a concrete blocker, say exactly what failed, what evidence exists, and the smallest next action. Do not fall back to generic 'I cannot' language.",
  "- Be concise. Do not dump filenames, tools, agents, logs, or architecture unless they are useful to the request or the owner asks for them.",
  situation(message)
 ].filter(Boolean).join("\n");
}

function usable(c){
 const s=String(c?.status||"");
 if(!s||/disabled|not-configured|experimental-discovery-only/i.test(s))return false;
 return Array.isArray(c?.tools)&&c.tools.length>0 || /wired|separate-workflow|allowlist-gated|native-fallback|skill-library|feature-specific|exposed|partially-wired|available/i.test(s);
}

function capabilityRows(message){
 try{return require("./capability-registry").recommendCapabilities(message,8).filter(usable)}
 catch{return[]}
}

function capabilityCorrection(message,answer){
 const text=String(answer||"");
 if(!DENIAL.test(text))return text;
 const rows=capabilityRows(message);
 if(!rows.length)return text;
 const labels=[...new Set(rows.map(r=>r.label).filter(Boolean))].slice(0,4);
 if(!labels.length)return text;
 return "Kairoq has a runtime path for this request: "+labels.join("; ")+
  ". I should use the available capability and report its observed result. If credentials, approval, configuration, or another gate is required, I should state that specific requirement instead of describing an underlying model limitation.";
}

function hideInternals(answer,{technical=false}={}){
 const text=String(answer||"");
 if(technical)return text;
 return text.replace(INTERNAL,"Kairoq's internal tooling");
}

function guard(message,answer,{technical=false}={}){
 return hideInternals(capabilityCorrection(message,answer),{technical});
}

function technicalRequest(message){
 return /\b(internals?|architecture|implementation|framework|library|repo|repository|source|code|agent stack|sub[- ]?agents?|how does .* work)\b/i.test(String(message||""));
}

module.exports={prompt,situation,frustrated,guard,capabilityCorrection,capabilityRows,hideInternals,technicalRequest,usable};
