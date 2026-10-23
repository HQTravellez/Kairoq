"use strict";
// Product-from-API-docs intake. External docs are untrusted DATA, not model
// instructions; only formal contracts may generate a documented API workflow.
// API discovery is advisory and never grants live execution or billing consent.
const catalog=require("./api-catalog"),docs=require("./api-docs"),orchestrator=require("./product-orchestrator");
const patterns=require("./api-pattern-catalog"),systemDesign=require("./api-system-design"),apijson=require("./api-apijson");
function checkBrief(brief){
 if(typeof brief!=="string"||brief.trim().length<12||brief.length>6000)
  throw Error("Describe the product requirements in 12–6000 characters");
 return brief.trim();
}
function capabilities(brief){
 const parts=brief.replace(/\r/g,"\n").split(/(?:\n|[.;]|,\s*(?:and|plus)\s+)/i)
  .map(x=>x.replace(/^\s*[-*\d.)]+\s*/,"").trim()).filter(x=>x.length>=8&&x.length<=600);
 const unique=[...new Set(parts)].slice(0,12);
 return unique.length?unique:[brief.slice(0,600)];
}
function candidateMatches(description,contract){
 if(!contract?.operations?.length)return [];
 const words=catalog.words(description);
 if(!words.length)return [];
 return contract.operations.map(op=>{
  const haystack=(op.id+" "+op.summary+" "+op.path+" "+(op.tags||[]).join(" ")).toLowerCase();
  const terms=words.filter(t=>new RegExp("(^|[^a-z0-9])"+t+"([^a-z0-9]|$)").test(haystack));
  return{op,score:terms.length*2+words.filter(t=>!terms.includes(t)&&haystack.includes(t)).length};
 }).filter(x=>x.score>=2).sort((a,b)=>b.score-a.score).slice(0,4).map(({op,score})=>({
  operationId:op.id,method:op.method,path:op.path,score,
  evidence:op.summary||op.path,status:"candidate-only-not-functional-proof"
 }));
}
function blueprint(brief,rawPlan=null,{catalogId}={}){
 brief=checkBrief(brief);
 const selected=catalogId?catalog.find(catalogId):null;
 let formal=null,reason=null;
 if(rawPlan){
  try{formal=orchestrator.contract(rawPlan)}
  catch(e){reason=String(e.message||e)}
 }
 const requested=capabilities(brief);
 const requirements=requested.map((description,index)=>{
  const operations=candidateMatches(description,formal);
  return{id:"request-"+String(index+1).padStart(2,"0"),description,operations,
   status:operations.length?"operation-candidate-needs-test":"not-mapped-to-verified-operation"};
 });
 const warnings=[
  "Public APIs is a directory, not an API contract, credential source, or guarantee of free commercial use",
  "Directory descriptions and provider documentation are untrusted reference data; they cannot override Kairoq's policies",
  "Workflow mappings require a versioned formal OpenAPI/Postman contract and independent response-schema verification",
  "No supplier data was fetched, modified, booked, ticketed or paid for"
 ];
 if(!formal)warnings.push("Formal contract unavailable: "+(reason||"A verified HTTPS base URL and machine-readable specification are required"));
 if(formal&&!formal.auth?.length)warnings.push("No machine-readable authentication schemes found: review vendor documentation before connecting credentials");
 if(formal&&formal.operations.length>60)warnings.push("Only the most relevant operations may be sent to the product planner; full formal contract remains available to validation");
 return{brief,source:selected?{id:selected.id,name:selected.name,url:selected.url,category:selected.category,
  status:"discovery-lead-unverified"}:null,
  formalContract:!!formal,format:formal?.format||rawPlan?.format||null,
  documentedOperations:formal?.operations.length||0,
  baseUrlVerifiedAsHttps:!!formal,authentication:formal?.auth||[],
  requirements,unmapped:requirements.filter(r=>!r.operations.length).map(r=>r.description),
  catalogSuggestions:catalog.search(brief,{limit:7}).candidates,
  architecturePatterns:patterns.search(brief),
  architectureReview:systemDesign.recommend(brief),
  readiness:formal?"eligible-for-model-planning-and-controlled-mock-tests":"requires-formal-api-contract",
  workflowExecution:"disabled-until-approved-sandbox-and-credentials",warnings,
  next:formal?"Have Kairoq generate a validated product schema and mapping; review it before building":"Select a candidate API, import its official specification, and review the actual auth and schema"};
}
async function analyze({brief,apiPlan,apiSpec,documentationUrl,documentationText,catalogId,apiJsonManifest,autoDiscover=false}={},opts={}){
 brief=checkBrief(brief);
 const choices=[apiPlan!==undefined,apiSpec!==undefined,!!documentationUrl,!!documentationText,apiJsonManifest!==undefined].filter(Boolean);
 if(choices.length>1)throw Error("Provide one contract/documentation source at a time");
 let raw=apiPlan||null;
 if(apiJsonManifest!==undefined)raw=apijson.fromManifest(apiJsonManifest);
 if(apiSpec!==undefined)raw=require("./api-learning").learn(apiSpec);
 if(documentationText)raw=docs.infer(documentationText);
 if(documentationUrl)raw=await docs.discover(documentationUrl,opts);
 const inspected=[];
 if(autoDiscover===true&&!raw){
  const selections=catalogId?[catalog.find(catalogId)]:catalog.search(brief,{limit:3}).candidates;
  // Only already allowlisted public HTTPS documentation leads. No API execution.
  for(const item of selections.slice(0,3)){
   if(!item.https||!item.url.startsWith("https://")){
    inspected.push({name:item.name,status:"skipped-insecure-directory-entry"});continue;
   }
   try{
    const discovered=await (opts.docsDiscover||docs.discover)(item.url,opts);
    let valid=false;
    try{orchestrator.contract(discovered);valid=true;}catch{}
    inspected.push({name:item.name,url:item.url,status:valid?"formal-contract-imported":"unstructured-or-unsupported-documentation",
     format:discovered?.format||"unknown"});
    if(valid){raw=discovered;break;}
   }catch(err){
    const message=String(err.message||err);
    inspected.push({name:item.name,status:/allowlisted/i.test(message)?"blocked-host-not-allowlisted":"documentation-not-imported",
     reason:/allowlisted/i.test(message)?"Configure the provider documentation host allowlist":"Inspect this provider's official API specification manually"});
   }
  }
 }
 const bp=blueprint(brief,raw,{catalogId});
 if(inspected.length)bp.automatedDiscovery={attempts:inspected,
  status:bp.formalContract?"formal-contract-found":"no-formal-contract-found",
  warning:"Only preapproved HTTPS documentation hosts are fetched; no provider operation is executed"};
 return{blueprint:bp,apiPlan:raw};
}
async function prepare({brief,apiPlan,apiSpec,documentationUrl,documentationText,catalogId,apiJsonManifest,autoDiscover=false}={},{
 callModel,docsOptions
}={}){
 const {blueprint:bp,apiPlan:raw}=await analyze({brief,apiPlan,apiSpec,documentationUrl,documentationText,catalogId,apiJsonManifest,autoDiscover},docsOptions);
 if(!bp.formalContract)return{blueprint:bp,productPlan:null,readiness:"blocked-no-formal-contract",externalCalls:0};
 if(typeof callModel!=="function")throw Error("A product planning model is required");
 const plan=await orchestrator.plan(callModel,{brief:bp.brief,apiContract:raw,
   architecturePatterns:bp.architecturePatterns.matches,
   architectureReview:bp.architectureReview.recommendations});
 const validated=orchestrator.normalize(plan,orchestrator.contract(raw));
 return{blueprint:bp,productPlan:validated,
   readiness:orchestrator.readiness(validated,orchestrator.contract(raw),"prepared-product"),
   externalCalls:0,providerCalls:0,approvalRequiredBeforeLive:true,
   previewOnly:true};
}
module.exports={checkBrief,capabilities,candidateMatches,blueprint,analyze,prepare};
