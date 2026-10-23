"use strict";
// Evaluation-only bridge from parsed API contracts to AI-assisted notes, guarded
// multi-provider workflow and generated server-side clients. Not imported by Kairoq
// production. AI output cannot change the deterministic workflow or privileges.
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
module.exports={manifest,sdkBundle,prepare,testWorkflow};
