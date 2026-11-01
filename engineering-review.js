"use strict";
// Two-axis fresh-context review inspired by mattpocock/skills (MIT):
// Standards asks whether the engineering is sound; Spec asks whether it matches the request.
const crypto=require("node:crypto");
function changedFiles(base={},current={}){return [...new Set([...Object.keys(base),...Object.keys(current)])].filter(k=>base[k]!==current[k]).sort()}
function required(base,current,request=""){
 const n=changedFiles(base,current).length,t=String(request||"");
 return n>=2||t.length>280||/\b(auth|authentication|authorization|payment|database|migration|api|security|permission|permissions|refactor|architecture|automation)\b/i.test(t);
}
function clip(s,n){s=String(s||"");return s.length>n?s.slice(0,n)+"\n…(truncated)":s}
function diffText(base={},current={},limit=52000){
 let out="";
 for(const name of changedFiles(base,current)){
  const before=Object.hasOwn(base,name)?base[name]:"(new file)",after=Object.hasOwn(current,name)?current[name]:"(deleted)";
  const block="\n### "+name+"\nBEFORE:\n"+clip(before,6500)+"\nAFTER:\n"+clip(after,9500)+"\n";
  if(out.length+block.length>limit){out+="\n…additional changed files omitted for review budget";break}
  out+=block;
 }
 return out||"(no source changes)";
}
function parse(v){
 if(v&&typeof v==="object"&&!Array.isArray(v))return normalize(v);
 let s=String(v||"").trim().replace(/^\\x60\\x60\\x60(?:json)?\s*/i,"").replace(/\\x60\\x60\\x60\s*$/,"");
 try{return normalize(JSON.parse(s))}catch{}
 const a=s.indexOf("{"),b=s.lastIndexOf("}");if(a>=0&&b>a)try{return normalize(JSON.parse(s.slice(a,b+1)))}catch{}
 throw Error("review response was not valid JSON");
}
function normalize(v){
 const verdict=["pass","block"].includes(String(v.verdict).toLowerCase())?String(v.verdict).toLowerCase():"block";
 const findings=(Array.isArray(v.findings)?v.findings:[]).slice(0,12).map((f,i)=>({
  id:String(f?.id||"F"+(i+1)).slice(0,32),
  severity:["critical","important","minor"].includes(String(f?.severity).toLowerCase())?String(f.severity).toLowerCase():"important",
  confidence:Math.max(0,Math.min(1,Number(f?.confidence)||0.5)),
  file:String(f?.file||"").slice(0,180),
  message:String(f?.message||"").slice(0,700),
  evidence:String(f?.evidence||"").slice(0,700)
 })).filter(f=>f.message);
 return{verdict,findings};
}
// What holds a build back: a critical finding on either axis, or a confident "important" gap
// against the owner's request (Spec). Standards findings below critical (duplicated logic,
// shallow modules, seams) are notes for later: in live builds they kept the agent reviewing and
// repairing working apps until it ran out of rounds.
function blocking(review){
 const std=(review?.standards?.findings||[]).filter(f=>f.severity==="critical");
 const spec=(review?.spec?.findings||[]).filter(f=>f.severity==="critical"||(f.severity==="important"&&f.confidence>=0.85));
 return[...std,...spec];
}
async function one(callModel,{system,user,tier,signal}){
 return callModel({messages:[{role:"system",content:system},{role:"user",content:user}],temperature:0,maxOutputTokens:2200,tier,signal},parse);
}
async function run({callModel,base,current,request,ownerRequirements=[],knowledge="",tier="standard",signal}={}){
 if(typeof callModel!=="function")throw Error("review model is unavailable");
 const files=changedFiles(base,current),diff=diffText(base,current);
 const shared="Request:\n"+String(request||"").slice(0,6000)+"\n\nOwner requirements:\n"+
  (ownerRequirements.length?ownerRequirements.map(x=>"- "+(x.label||x.id)).join("\n"):"(none)")+
  (knowledge?"\n\nProject domain/ADR context:\n"+clip(knowledge,7000):"")+"\n\nChanged files: "+files.join(", ")+"\n\nDIFF VIEW:"+diff;
 const standardsSystem="You are an independent senior code reviewer with no access to the implementation conversation. "+
  "Review only the supplied changed code, not imagined files. Axis: STANDARDS. "+
  "Look for correctness/security problems, duplicated logic, shotgun surgery, speculative generality, shallow pass-through modules, poor public seams, implementation-coupled tests, tautological tests, and violations visible in the diff. "+
  "Do not complain about style tooling would enforce. Do not invent a problem without citing supplied code. "+
  "Severity critical means a bug a user will hit, data loss or a security hole; structure and style concerns are important or minor. "+
  "Return ONLY JSON: {\"verdict\":\"pass|block\",\"findings\":[{\"id\":\"S1\",\"severity\":\"critical|important|minor\",\"confidence\":0.0,\"file\":\"path\",\"message\":\"specific problem\",\"evidence\":\"specific supplied evidence\"}]}.";
 const specSystem="You are an independent product/spec reviewer with no access to the implementation conversation. "+
  "Axis: SPEC. Compare the supplied request/requirements to the changed code. "+
  "Find requested behavior that is missing/partial/wrong and material behavior added without being requested (scope creep). Do not review generic code style. Do not infer requirements that are not supplied. "+
  "Return ONLY JSON: {\"verdict\":\"pass|block\",\"findings\":[{\"id\":\"P1\",\"severity\":\"critical|important|minor\",\"confidence\":0.0,\"file\":\"path\",\"message\":\"specific spec mismatch\",\"evidence\":\"request + changed-code evidence\"}]}.";
 const [standards,spec]=await Promise.all([
  one(callModel,{system:standardsSystem,user:shared,tier,signal}),
  one(callModel,{system:specSystem,user:shared,tier,signal})
 ]);
 const review={standards,spec,files,at:new Date().toISOString()};
 review.blocking=blocking(review);review.ok=review.blocking.length===0;
 review.digest=crypto.createHash("sha1").update(JSON.stringify(files.map(f=>[f,current[f]]))).digest("hex");
 return review;
}
function summary(r){
 if(!r)return"No engineering review.";
 const axis=(name,x)=>name+": "+(x.findings.length?x.findings.map(f=>f.severity.toUpperCase()+" "+f.file+" — "+f.message).join(" | "):"pass");
 return axis("Standards",r.standards)+"\n"+axis("Spec",r.spec)+(r.blocking.length?"\nBlocking findings: "+r.blocking.length:"\nNo blocking findings.");
}
module.exports={changedFiles,required,diffText,parse,normalize,blocking,run,summary};
