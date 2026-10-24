"use strict";
// Bridge from parsed API contracts to AI-assisted notes (ScaleDown CDM + Jev), the
// guarded multi-provider workflow and generated server-side clients. Used by API
// Studio (api-product-intake.analyze → advise) and POST /api/developer/api/orchestrate.
// AI output is advisory only: it cannot change the deterministic workflow, a contract
// or any privilege, and nothing is sent to the AI providers unless the owner turns
// KAIROQ_API_INTELLIGENCE on.
const api=require("./api-learning");
const sdk=require("./api-sdk");
const workflowEngine=require("./api-workflow");
const intelligence=require("./api-intelligence");
const MAX_SNIPPETS=4;
function manifest(rawContracts,workflow){
 const contracts=workflowEngine.validateSpec(rawContracts,workflow);
 const providers=Object.entries(contracts).map(([name,plan])=>{
  const supported=plan.operations.filter(op=>!op.unsupportedBody&&!op.requiresScripts);
  const auth=plan.auth||[];
  return{name,operations:plan.operations.length,supportedOperations:supported.length,
   authenticationTypes:[...new Set(auth.map(x=>x.type))],
   hasVerifiedBaseUrl:typeof plan.baseUrl==="string"&&/^https:\/\//.test(plan.baseUrl),
   unsupported:plan.operations.filter(op=>op.unsupportedBody||op.requiresScripts).map(op=>op.id)};
 });
 return{providers,steps:workflow.steps.map(s=>({id:s.id,type:s.type,
   operations:s.type==="call"?[s.provider+":"+s.operationId]:
   Object.values(s.routes).map(r=>r.provider+":"+r.operationId)})),
   status:"contract-validated-only",warning:"Not a validated supplier account, sandbox run, or live booking"};
}
function sdkBundle(rawContracts){
 const contracts=workflowEngine.contractsFrom(rawContracts),generated=Object.create(null);
 for(const [name,plan] of Object.entries(contracts)){
  try{
   const result=sdk.generate(plan,{className:"KairoqApiClient"});
   generated[name]={status:"generated-unexecuted",filename:name+"-"+result.filename,
    source:result.source,operationCount:result.operations};
  }catch{
   generated[name]={status:"manual-review",reason:"SDK generation needs a verified base URL or reviewed schema"};
  }
 }
 return generated;
}
async function prepare({contracts,workflow,publicDocumentation=[],
 ai={enabled:false},fetchImpl}={}){
 const graph=manifest(contracts,workflow);
 if(!Array.isArray(publicDocumentation)||publicDocumentation.length>MAX_SNIPPETS)
  throw Error("At most 4 approved public documentation snippets");
 // Enforce no arbitrary private documentation to third parties.
 const enabled=ai.enabled===true&&ai.allowThirdPartyDisclosure===true;
 const notes=[];
 for(const snippet of publicDocumentation){
  intelligence.publicText(snippet);
  notes.push(await intelligence.classifyDocumentation(snippet,{
   enabled,key:ai.scaleDownKey??process.env.SCALEDOWN_API_KEY,fetchImpl}));
 }
 const described=JSON.stringify({providers:graph.providers.map(p=>({name:p.name,
  operations:p.operations,supportedOperations:p.supportedOperations,
  authenticationTypes:p.authenticationTypes,unsupported:p.unsupported})),
  steps:graph.steps,modelLabels:notes.map(n=>n.label||n.status)}).slice(0,8500);
 const decision=await intelligence.chooseInvestigation(described,{
  enabled,key:ai.jevKey??process.env.TYPESAFE_API_KEY,fetchImpl});
 const sdkResults=sdkBundle(contracts);
 const estimates={
  jev:intelligence.estimateCost(decision.usage,ai.jevRates),
  scaledown:ai.scaledownRates?notes.map(n=>intelligence.estimateCost(n.usage,ai.scaledownRates)):null
 };
 return{status:"prepared-not-executed",graph,advisory:{
  enabled,
  cdm:notes,
  jev:decision,
  estimatesUSD:estimates,
  pricingProvenance:"Caller must supply actual provider rates; unknown costs are null, not $0",
  accuracyProvenance:"AI outputs are unverified suggestions, not validated contract evidence"
 },sdks:sdkResults};
}
async function testWorkflow({contracts,workflow,input,approvedOperations,invoke,prepared}={}){
 if(!prepared||prepared.status!=="prepared-not-executed")throw Error("Prepare and validate contract first");
 if(!invoke||typeof invoke!=="function")throw Error("No explicitly supplied mock/sandbox executor");
 // This never chooses a provider or operation based on CDM/Jev output.
 return workflowEngine.run({contracts,workflow,input,approvedOperations,invoke});
}
// Owner switch for sending public documentation text to ScaleDown and Typesafe (Jev).
function aiSettings(env=process.env){
 const on=String(env.KAIROQ_API_INTELLIGENCE||"").toLowerCase()==="on";
 return{enabled:on,allowThirdPartyDisclosure:on,jevKey:env.TYPESAFE_API_KEY,scaleDownKey:env.SCALEDOWN_API_KEY};
}
// Cut text to at most `max` UTF-8 bytes without splitting a character.
function clipBytes(text,max=8800){
 let out=String(text||"");
 while(Buffer.byteLength(out,"utf8")>max)out=out.slice(0,Math.floor(out.length*0.9));
 return out;
}
// Public evidence for the classifier: the documentation text itself, or a compact
// list of the contract's operations. Text that looks like a credential is skipped.
function evidenceSnippets({apiPlan,documentationText}={}){
 const snippets=[];
 if(typeof documentationText==="string"&&documentationText.trim())snippets.push(clipBytes(documentationText));
 const ops=Array.isArray(apiPlan?.operations)?apiPlan.operations:[];
 if(ops.length){
  const lines=ops.slice(0,120).map(o=>[o.method,o.path,o.summary].filter(Boolean).join(" "));
  const auth=(apiPlan.auth||[]).map(a=>a.type||a.scheme||"").filter(Boolean);
  snippets.push(clipBytes((apiPlan.title?apiPlan.title+"\n":"")+(auth.length?"Authentication: "+auth.join(", ")+"\n":"")+lines.join("\n")));
 }
 return snippets.slice(0,MAX_SNIPPETS).filter(s=>{try{intelligence.publicText(s);return true}catch{return false}});
}
// Advisory for one API being turned into a product (API Studio "analyze"):
// CDM labels what the documentation is about; Jev picks the next thing to investigate.
async function advise({blueprint,apiPlan,documentationText}={},{env=process.env,fetchImpl}={}){
 const ai=aiSettings(env);
 if(!ai.enabled)return{status:"off",reason:"Set KAIROQ_API_INTELLIGENCE=on (plus TYPESAFE_API_KEY for Jev and SCALEDOWN_API_KEY for CDM) to get AI triage of API documentation"};
 const missing=[!ai.jevKey&&"TYPESAFE_API_KEY",!ai.scaleDownKey&&"SCALEDOWN_API_KEY"].filter(Boolean);
 const snippets=evidenceSnippets({apiPlan,documentationText});
 const cdm=await Promise.all(snippets.map(s=>intelligence.classifyDocumentation(s,{enabled:true,key:ai.scaleDownKey,fetchImpl})));
 const state=clipBytes(JSON.stringify({
  formalContract:!!blueprint?.formalContract,format:blueprint?.format||apiPlan?.format||null,
  documentedOperations:blueprint?.documentedOperations??(apiPlan?.operations||[]).length,
  authentication:[...new Set((blueprint?.authentication||apiPlan?.auth||[]).map(a=>a.type||a.scheme).filter(Boolean))],
  requirements:(blueprint?.requirements||[]).length,
  unmappedRequirements:(blueprint?.unmapped||[]).length,
  documentationLabels:cdm.map(n=>n.label||n.status)
 }));
 let jev;
 try{jev=await intelligence.chooseInvestigation(state,{enabled:true,key:ai.jevKey,fetchImpl})}
 catch(e){jev={status:"review",reason:String(e.message||e)}}
 const next=jev.status==="advisory"?intelligence.NEXT[jev.next]:null;
 return{status:"ok",cdm:cdm.map(({source,...rest})=>rest),jev:(({source,...rest})=>rest)(jev),
  nextStep:next,missingKeys:missing,
  note:"Advisory only: AI labels and suggestions never change the contract, the plan or any permission"};
}
module.exports={manifest,sdkBundle,prepare,testWorkflow,advise,aiSettings,evidenceSnippets};
