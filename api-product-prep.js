"use strict";
// Product brief -> API directory candidates -> verified docs -> grounded plan.
// Directory listings and example repositories remain untrusted advisory data.
const docs=require("./api-docs");
const catalog=require("./api-public-catalog");
const apijson=require("./api-apijson");
const patterns=require("./api-pattern-catalog");
const orchestrator=require("./product-orchestrator");
function briefText(value){
 if(typeof value!=="string"||value.trim().length<12||value.length>6000)throw Error("Describe the product in 12-6000 characters");
 return value.trim();
}
function terms(text){
 return [...new Set(String(text||"").toLowerCase().match(/[a-z]{3,}/g)||[])].filter(x=>!["with","from","then","have","need","that","this","using","them","will","app","api","user","users","should","data","make","create","build","client","and","the"].includes(x)).slice(0,40);
}
function evidence(brief,plan){
 const req=briefText(brief),words=terms(req),ops=plan?.operations||[];
 const candidates=ops.map(op=>{
  const searchable=[op.id,op.path,op.summary,...(op.tags||[])].join(" ").toLowerCase();
  const matched=words.filter(w=>searchable.includes(w));
  return{id:op.id,method:op.method,path:op.path,description:op.summary||"",
   matchedTerms:matched.slice(0,8),matchCount:matched.length};
 }).filter(x=>x.matchCount>0).sort((a,b)=>b.matchCount-a.matchCount).slice(0,15);
 return{keywords:words,possibleOperationMatches:candidates,
  meaning:"Keyword matches are hints for the planner, not proof an operation satisfies requirements",
  coverageConfirmed:false,missingOrUnverified:["Provider auth and access grants","Provider-specific request and response semantics","Live sandbox responses","End-to-end user journey"]};
}
async function prepare(input={},deps={}){
 const brief=briefText(input.brief);
 const selected=[input.apiPlan!==undefined,input.apiSpec!==undefined,input.documentationText!==undefined,
  input.documentationUrl!==undefined,input.apiJsonManifest!==undefined].filter(Boolean).length;
 if(selected>1)throw Error("Supply only one documentation source per product preparation");
 let plan=null,documentStatus="missing",documentation=null;
 if(input.apiJsonManifest!==undefined){
  plan=apijson.fromManifest(input.apiJsonManifest);
  documentStatus="reviewed-manifest-not-sandbox-tested";documentation={kind:"APIJSON reviewed manifest"};
 }else if(input.apiPlan!==undefined||input.apiSpec!==undefined){
  plan=orchestrator.contract(input.apiPlan??input.apiSpec);documentStatus="formal";
  documentation={kind:plan.format,source:"provided-by-user"};
 }else if(input.documentationText!==undefined){
  if(typeof input.documentationText!=="string"||input.documentationText.length>2000000)throw Error("Documentation too long");
  const imported=docs.infer(input.documentationText);
  documentStatus=["openapi3","swagger2","postman-v2","openapi-bundle"].includes(imported.format)?"formal":imported.format;
  plan=documentStatus==="formal"?orchestrator.contract(imported):imported;
  documentation={kind:imported.format,source:"pasted"};
 }else if(input.documentationUrl!==undefined){
  if(typeof input.documentationUrl!=="string"||input.documentationUrl.length>1500)throw Error("Documentation URL too long");
  const imported=await (deps.docsDiscover||docs.discover)(input.documentationUrl);
  documentStatus=["openapi3","swagger2","postman-v2","openapi-bundle"].includes(imported.format)?"formal":imported.format;
  plan=documentStatus==="formal"?orchestrator.contract(imported):imported;
  documentation={kind:imported.format,sourceUrl:imported.documentationUrl||input.documentationUrl};
 }
 const formal=!!plan&&["openapi3","swagger2","openapi-bundle","postman-v2"].includes(plan.format);
 const verifiedContract=formal?orchestrator.contract(plan):null;
 const wantsCatalog=input.searchCatalog===true||input.catalogQuery!==undefined;
 const directory=wantsCatalog?await (deps.catalogDiscover||catalog.discover)({
  query:typeof input.catalogQuery==="string"&&input.catalogQuery.trim()?input.catalogQuery:brief,
  category:input.category||"",limit:Math.min(20,Math.max(1,Number(input.limit||10))),secureOnly:true
 }):null;
 const architecturePatterns=patterns.search(brief);
 const review={stage:verifiedContract?"formal-contract-imported":"needs-formal-contract",
  candidateCount:directory?.matchedCount||0,documentStatus,formalContract:!!verifiedContract,
  operationCount:verifiedContract?.operations?.length||0,
  integrationCertified:false,readyForLiveProviderCalls:false,
  readinessLimitations:[
   ...(documentStatus==="apijson-protocol"?["Provide actual APIJSON tables, roles, base URL and validated manifest"]:[]),
   ...(!verifiedContract?["No formal operation schema is available; external integrations must remain unsupported"]:[]),
   "Vendor authentication and grants require provider account confirmation",
   "No provider sandbox requests or real transactions were executed"
  ]};
 let productPlan=null;
 if(input.buildPlan===true){
  if(typeof deps.callModel!=="function")throw Error("An approved Kairoq planning model is required");
  productPlan=await orchestrator.plan(deps.callModel,{brief,apiContract:verifiedContract,
   architecturePatterns:architecturePatterns.matches});
 }
 return{status:"prepared-for-review",source:{catalog:"public-apis/public-apis",
  ...(documentation?{documentation}:{}),apiJsonProtocolSource:apijson.SOURCE},
  review,directory,architecturePatterns,apiContract:verifiedContract,
  documentationDraft:!verifiedContract&&plan?plan:null,
  featureEvidence:evidence(brief,verifiedContract),productPlan,
  nextActions:verifiedContract?[
   "Review actual provider permissions and supported operations",
   "Map user journeys to documented parameters and response fields",
   "Generate server-side SDK; test with a controlled sandbox and replay fixtures",
   "Build and browser-test the approved product before publishing"
  ]:[
   "Choose a candidate API and obtain its formal OpenAPI/Postman specification",
   "If using APIJSON, provide the server's reviewed table, role and field manifest",
   "Re-run preparation and keep unsupported integrations clearly labeled"
  ]};
}
module.exports={briefText,terms,evidence,prepare};
