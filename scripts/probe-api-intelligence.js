"use strict";
// Manual one-call-each vendor verification. No Trip Ninja, Sabre, or other supplier
// API is called. GitHub Actions workflow_dispatch must explicitly enable and key.
const fs=require("node:fs"),path=require("node:path");
const ai=require("../api-intelligence");
const CDM_SAMPLE="POST /searches returns a list of flight-content requests. The travel client obtains content from selected suppliers and submits responses with the original search identifier.";
const JEV_SAMPLE="The search step returned two content requests. One supplier response has a missing correlation ID. Identify which investigation should happen next.";
async function main(){
 if(process.env.KAIROQ_ALLOW_PUBLIC_AI_TESTS!=="YES")throw Error("Set KAIROQ_ALLOW_PUBLIC_AI_TESTS=YES only for approved public-fixture API trials");
 const result={kind:"public-fixture-real-provider-check",schema:1,
  source:"synthetic-public-only",date:new Date().toISOString(),
  scaleDownConfigured:Boolean(process.env.SCALEDOWN_API_KEY),
  jevConfigured:Boolean(process.env.TYPESAFE_API_KEY)};
 if(!result.scaleDownConfigured||!result.jevConfigured){
  result.status="blocked-missing-keys";
 }else{
  const c=await ai.classifyDocumentation(CDM_SAMPLE,{enabled:true});
  const j=await ai.chooseInvestigation(JEV_SAMPLE,{enabled:true});
  result.cdm=c;result.jev=j;
  result.cost={
   jevListEstimateUSD:ai.estimateCost(j.usage,{inputPerMillion:.042,outputPerMillion:0}),
   scaledownUSD:null,reason:"ScaleDown model price not confirmed; consult vendor contract and actual invoice"};
  result.status=c.status==="classified"&&["advisory","review"].includes(j.status)?"real-provider-responded":"provider-probe-failed";
 }
 const out=process.env.KAIROQ_AI_PROBE_OUT||"benchmark-artifacts/api-intelligence-real-probe.json";
 fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});
 fs.writeFileSync(path.resolve(out),JSON.stringify(result,null,2)+"\n");
 console.log(JSON.stringify(result,null,2));
 if(result.status!=="real-provider-responded")process.exitCode=2;
}
main().catch(()=>{console.error("Vendor probe could not complete (no secrets logged)");process.exitCode=1});
