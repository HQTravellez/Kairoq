"use strict";
// Kairoq-native execution discipline adapted from the MIT-licensed Superpowers
// methodology. It preserves Kairoq's autonomous UX: no mandatory user ceremony
// for routine work, but the engineering gates themselves are mandatory.
function classify(request){
 const t=String(request||"");
 if(/\b(bug|broken|failing|failure|error|crash|regression|doesn.?t work|fix|debug)\b/i.test(t))return"bug";
 if(/\b(refactor|restructure|architecture|cleanup|clean up|migrate)\b/i.test(t))return"refactor";
 if(/\b(build|create|make|implement|add|feature|app|website|dashboard|system)\b/i.test(t))return"feature";
 return"change";
}
function workflow(request){
 const kind=classify(request);
 const common=["understand scope","inspect relevant existing code","make the smallest complete change","run fresh verification","review against request","finish only with evidence"];
 const phases=kind==="bug"
  ?["create a red-capable reproduction","trace root cause before editing","form one testable hypothesis","write/identify a regression check","apply one focused repair","rerun the exact reproduction","run related regressions","review blast radius"]
  :kind==="refactor"
   ?["map dependencies and seams","define behavior that must not change","add/identify regression coverage","make one structural change at a time","run affected tests after each slice","review impact and unnecessary scope"]
   :kind==="feature"
    ?["derive an internal build contract from the conversation","identify vertical slices and public seams","inspect dependencies before edits","implement one coherent slice at a time","test deterministic logic at its public seam","exercise user-visible behavior in the browser","review spec coverage"]
    :common;
 return{kind,phases:[...new Set([...phases,...common])]};
}
function prompt(request){
 const w=workflow(request);
 return"\n\nSUPERPOWERS EXECUTION DISCIPLINE ("+w.kind+"): "+
  "Kairoq executes autonomously, so do not pause for process approval when the user's intent is already clear. "+
  "The following engineering gates are mandatory:\n"+
  w.phases.map((x,i)=>(i+1)+". "+x).join("\n")+
  "\nRules: for bugs, do not guess a fix before a red-capable reproduction/root-cause signal; "+
  "for deterministic logic prefer red→green tests; do not trust a model's claim of success; "+
  "after three failed repair hypotheses on the same symptom, stop patching symptoms and reconsider the architecture; "+
  "completion requires fresh executor evidence, not confidence.";
}
function hermesBootstrap(request){
 const kind=classify(request);
 const skill=kind==="bug"?"systematic-debugging":kind==="refactor"?"writing-plans":"using-superpowers";
 return[
  "Kairoq ships the Superpowers engineering skill library. For technical work, use the relevant skill when available instead of improvising process.",
  "Suggested starting skill for this request: "+skill+".",
  "Always apply verification-before-completion before claiming a technical result works.",
  "For implementation work, use test-driven-development where behavior can be checked deterministically; use requesting-code-review for substantial changes.",
  "Do not force extra user approval ceremonies when Kairoq already has a clear approved request; preserve the methodology, not unnecessary friction."
 ].join("\n");
}
module.exports={classify,workflow,prompt,hermesBootstrap};
