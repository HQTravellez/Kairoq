"use strict";
// One bounded real-provider smoke probe. No credentials or provider payloads in logs.
// API keys are read from GitHub Actions Secrets and never committed.
// One request per configured model, synthetic public inputs only.
// This file is experimental; does not import Kairoq production adapters.
const fs=require("node:fs"),path=require("node:path"),ai=require("../api-intelligence");
const fixture={
 cdm:"Our API returns HTTP 401 because the caller omitted the Authorization header and must obtain a new OAuth access token before retrying.",
 jev:"A travel supplier API request returns HTTP 401 (invalid_token). The documented bearer credential is expired, and the supplier has not been retried. Choose the next investigation."
};
function write(data){
 const filepath=process.env.KAIROQ_PROBE_RESULT||"benchmark-artifacts/live-jev-cdm-oneshot.json";
 fs.mkdirSync(path.dirname(path.resolve(filepath)),{recursive:true});
 fs.writeFileSync(filepath,JSON.stringify(data,null,2)+"\n",{mode:0o600});
 console.log(JSON.stringify(data,null,2));
}
async function main(){
 if(process.env.KAIROQ_AI_ONESHOT_CONSENT!=="YES")throw Error("Explicit one-shot real provider authorization required");
 const configured={jev:!!process.env.TYPESAFE_API_KEY,cdm:!!process.env.SCALEDOWN_API_KEY};
 const report={kind:"jev-cdm-real-api-smoke",publicFixtureOnly:true,
  actualSupplierApiCalls:0,modelRequestsAttempted:0,modelRequestsSucceeded:0,
  configured,cdm:null,jev:null,modelFeesUSD:"Not measured; vendor invoice required"};
 if(configured.cdm){
  report.modelRequestsAttempted++;
  const result=await ai.classifyDocumentation(fixture.cdm,{enabled:true});
  report.cdm={status:result.status,topLabel:result.label||result.candidate||null,
   matchesExpected:result.status==="classified"&&result.label==="authentication",
   confidence:result.confidence??null,latencyMs:result.latencyMs??null,
   usage:result.usage??null,httpStatus:result.httpStatus??null,reason:result.reason??null,
   responseSchemaVerified:result.status==="classified"||
    (result.status==="review"&&result.reason!=="Invalid CDM output")};
  if(report.cdm.responseSchemaVerified)report.modelRequestsSucceeded++;
 }else report.cdm={status:"blocked-no-key"};
 if(configured.jev){
  report.modelRequestsAttempted++;
  const result=await ai.chooseInvestigation(fixture.jev,{enabled:true});
  report.jev={status:result.status,choice:result.next||result.candidate||null,
   matchesExpected:result.status==="advisory"&&result.next==="auth",
   confidence:result.confidence??null,latencyMs:result.latencyMs??null,
   usage:result.usage??null,httpStatus:result.httpStatus??null,reason:result.reason??null,
   responseSchemaVerified:result.status==="advisory"||
    (result.status==="review"&&result.reason!=="Invalid Jev typed decision")};
  if(report.jev.responseSchemaVerified)report.modelRequestsSucceeded++;
 }else report.jev={status:"blocked-no-key"};
 report.status=report.modelRequestsAttempted===0?"blocked-no-configured-keys":
  report.modelRequestsSucceeded===report.modelRequestsAttempted&&configured.cdm&&configured.jev?"real-vendor-responded":"incomplete-or-unverified";
 write(report);
 if(report.status!=="real-vendor-responded")process.exitCode=2;
}
main().catch(()=>{console.error("One-shot probe failed without exposing secrets");process.exitCode=1});
