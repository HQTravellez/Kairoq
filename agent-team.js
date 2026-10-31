"use strict";
// Read-only specialist consultation for Agent Mode.
// Specialists reason in parallel over the same bounded project snapshot.
// They cannot call tools, edit files, build, deploy, or claim runtime evidence.
const ROLES=Object.freeze({
 architect:{
  label:"Architect",
  system:"You are Kairoq's architecture specialist. Review the supplied request and project snapshot. Focus on structure, seams, dependencies, minimal-change implementation order, and likely integration risks. Do not invent files or runtime facts."
 },
 product:{
  label:"Product/Spec",
  system:"You are Kairoq's product and specification specialist. Translate the request into concrete user-visible behavior, acceptance criteria, missing edge cases, and scope boundaries. Do not add features the owner did not request."
 },
 qa:{
  label:"QA/Verifier",
  system:"You are Kairoq's verification specialist. Identify the smallest deterministic tests, browser journeys, failure cases, and evidence required before completion. Do not claim tests ran; propose what must be verified."
 },
 security:{
  label:"Security",
  system:"You are Kairoq's security specialist. Review only the supplied request and project snapshot for authorization, secret handling, untrusted input, network, data isolation and deployment risks. Do not invent vulnerabilities."
 },
 api:{
  label:"API Integrator",
  system:"You are Kairoq's API integration specialist. Review supplied API/repository evidence and identify contract, authentication, mapping, sandbox and verification requirements. Distinguish documented facts from assumptions and never invent endpoints."
 },
 design:{
  label:"Design",
  system:"You are Kairoq's product design specialist. Review the requested experience and current project snapshot. Focus on hierarchy, interaction flow, responsive behavior, accessibility and avoiding generic generated UI. Stay within the owner's product direction."
 }
});
function clip(v,n){v=String(v||"");return v.length>n?v.slice(0,n)+"\n…(truncated)":v}
function normalizeRoles(input){
 const wanted=Array.isArray(input)?input:[];
 const out=[];
 for(const raw of wanted){
  const key=String(raw||"").toLowerCase().trim();
  if(ROLES[key]&&!out.includes(key))out.push(key);
  if(out.length===3)break;
 }
 return out.length?out:["architect","product","qa"];
}
function projectSnapshot(files={},limit=28000){
 const names=Object.keys(files).sort();
 let out="FILES:\n"+names.join("\n");
 for(const name of names){
  if(out.length>=limit)break;
  const body=String(files[name]||"");
  const important=/(package\.json|src\/App\.|src\/main\.|backend\.json|schema|routes?|api|auth|README)/i.test(name);
  if(!important)continue;
  out+="\n\n--- "+name+" ---\n"+clip(body,5000);
 }
 return clip(out,limit);
}
function parseAdvice(v){
 if(typeof v==="string")return clip(v.trim(),7000);
 if(v&&typeof v==="object")return clip(JSON.stringify(v),7000);
 return "";
}
async function one(callModel,key,{request,question,snapshot,tier,signal}){
 const role=ROLES[key];
 const user=[
  "OWNER REQUEST:",clip(request,6000),
  question?"\nLEAD AGENT QUESTION:\n"+clip(question,2500):"",
  "\nPROJECT SNAPSHOT (read-only, may be incomplete):\n"+snapshot,
  "\nReturn concise advice with: FINDINGS, RECOMMENDED ACTIONS, and VERIFICATION/UNKNOWNs. You are advisory only."
 ].join("\n");
 const answer=await callModel({
  messages:[{role:"system",content:role.system+" You are one member of a multi-agent team. Be independent; do not defer to other agents."},{role:"user",content:user}],
  temperature:0.1,maxOutputTokens:1600,tier,signal
 },parseAdvice);
 return{role:key,label:role.label,advice:parseAdvice(answer)};
}
async function consult({callModel,request,files,question="",roles,tier="standard",signal}={}){
 if(typeof callModel!=="function")throw Error("sub-agent model is unavailable");
 const selected=normalizeRoles(roles);
 const snapshot=projectSnapshot(files);
 const settled=await Promise.allSettled(selected.map(key=>one(callModel,key,{request,question,snapshot,tier,signal})));
 const results=settled.map((r,i)=>r.status==="fulfilled"?r.value:{role:selected[i],label:ROLES[selected[i]].label,error:String(r.reason?.message||r.reason||"sub-agent failed").slice(0,400)});
 return{
  status:"advisory-only",
  parallel:true,
  roles:selected,
  results,
  warning:"Sub-agents did not call tools, edit files, run tests, or verify runtime behavior. The Lead Agent remains responsible for implementation and evidence."
 };
}
module.exports={ROLES,normalizeRoles,projectSnapshot,consult};
