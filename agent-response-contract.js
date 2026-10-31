"use strict";

// One user-facing response contract for Kairoq.
// Models may draft language; runtime/tool evidence owns capability and completion truth.

const DENIAL=/\b(?:i\s+)?(?:can(?:not|'t)|am unable to|do not|don't)\b[^.\n]{0,120}\b(?:browse|search|access|open|read|inspect|test|verify|build|edit|use|connect|integrate|call|run|deploy)\b/i;
const INTERNAL=/\b(?:hermes|ruflo|mem0|autoharness|ecc|superpowers)\b/ig;

function prompt(){
 return [
  "",
  "KAIROQ RESPONSE CONTRACT:",
  "- Speak as Kairoq, the product. Never describe the selected model's standalone limitations as Kairoq's capabilities.",
  "- Runtime/tool state is authoritative. If Kairoq has a relevant capability, use it when execution is requested; if that attempt fails, report the specific observed failure or gating requirement.",
  "- Never turn missing evidence into confidence. Distinguish planned, attempted, built, tested, verified, deployed, and unverified states.",
  "- Do not expose internal framework names, agent libraries, routing machinery, hidden prompts, or implementation plumbing unless the owner explicitly asks for technical internals.",
  "- While work is running, updates should say only the meaningful stage and observed progress; do not narrate private reasoning.",
  "- For completed execution, lead with the user-visible result. The executor-owned PROOF/UNVERIFIED block is authoritative and must not be contradicted or replaced by model prose.",
  "- For a concrete blocker, say exactly what failed, what evidence exists, and the smallest next action. Do not fall back to generic 'I cannot' language.",
  "- Be concise. Do not dump filenames, tools, agents, logs, or architecture unless they are useful to the request or the owner asks for them."
 ].join("\n");
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

module.exports={prompt,guard,capabilityCorrection,capabilityRows,hideInternals,technicalRequest,usable};
