"use strict";
// Engineering vocabulary adapted from mattpocock/skills (MIT) for Kairoq's autonomous builder.
function substantial(request){
 const t=String(request||"");
 const signals=(t.match(/\b(app|system|dashboard|platform|workflow|auth|payment|database|api|refactor|migration|multi[- ]page|automation|integration)\b/gi)||[]).length;
 return t.length>700||signals>=3||/\b(platform|system|migration|major refactor|multi[- ]page app)\b/i.test(t);
}
function prompt(request){
 const t=String(request||""),complex=substantial(t);
 return"\n\nENGINEERING INTELLIGENCE:"+
  "\n- Domain language: use project_knowledge for stable business terms and hard-to-reverse architecture decisions. Record only owner statements, code-observed facts, or verified documentation; never guesses."+
  "\n- Deep modules: prefer a small public interface hiding substantial behavior. Avoid pass-through wrappers, duplicated adapters, speculative abstractions, and shotgun surgery."+
  "\n- Test seams: verify behavior through public interfaces, not private implementation details. Expected values must come from the request/spec/known fixture, never by recomputing the implementation's own formula."+
  "\n- TDD where deterministic: one red behavior check → minimal green implementation → next vertical slice. Do not create a horizontal pile of tests for imagined future behavior."+
  "\n- Tracer bullets: each implementation slice should be independently demoable/verifiable across the needed layers; declare blockers and work only the ready frontier."+
  "\n- Review on two independent axes before VERIFIED completion: Standards (engineering quality) and Spec (did we build exactly what was requested, without scope creep)."+
  (complex?"\n- This request is substantial: define/update the task_graph before broad implementation so progress survives context/model changes.":"");
}
module.exports={prompt,substantial};
