"use strict";

const SECTIONS=Object.freeze([
  "What this repo does",
  "Architecture",
  "Important files",
  "APIs and contracts",
  "What we can reuse",
  "Conflicts or overlap with Kairoq",
  "Implementation plan",
  "Verification and unknowns"
]);

function contract({repository,hasApiDocs=false}={}){
  return [
    "REPOSITORY REVIEW RESPONSE CONTRACT:",
    "When you report on this repository, answer like a senior engineer, not a generic summarizer.",
    "Use these sections in this order:",
    ...SECTIONS.map((s,i)=>(i+1)+". "+s),
    "",
    "Rules:",
    "- Tie claims to inspected repository evidence. Name concrete files when possible.",
    "- Separate observed facts from inference.",
    "- Architecture must describe real components/data flow visible in the inspected source, not a guessed system diagram.",
    "- Important files must explain why each file matters, not just list paths.",
    "- APIs and contracts must distinguish formal OpenAPI/Swagger/Postman evidence from inferred endpoints.",
    "- What we can reuse must identify specific concepts/modules/patterns and any license or dependency caveats.",
    "- Conflicts or overlap with Kairoq must check whether Kairoq already has equivalent capability before recommending adoption.",
    "- Implementation plan must prefer Kairoq-native adaptation over wholesale framework replacement unless replacement is clearly justified.",
    "- Verification and unknowns must state what was not read, not executed, not tested, or still requires runtime evidence.",
    "- Never say a repository integration is complete, compatible, tested, or safe unless those facts were actually verified.",
    hasApiDocs
      ? "- This repository contains likely API documentation candidates. Review the relevant contract evidence before recommending API integration."
      : "- No formal API contract was confirmed by repository inspection; do not invent one."
  ].join("\n");
}

function headingsPresent(text){
  const t=String(text||"").toLowerCase();
  return SECTIONS.filter(s=>t.includes(s.toLowerCase()));
}

function complete(text){
  return headingsPresent(text).length===SECTIONS.length;
}

module.exports={SECTIONS,contract,headingsPresent,complete};
