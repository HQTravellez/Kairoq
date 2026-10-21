"use strict";
// Read-only validation of Trip Ninja's *older* 2023 public FareStructure OpenAPI
// from https://github.com/trip-ninja-inc/trip_ninja_api_docs (pinned revision).
// It is NOT proof of current SmartFlights compatibility or sandbox certification.
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const learn=require("../api-learning").learn,generate=require("../api-sdk").generate;
function audit(data){
 const plan=learn(data);
 const sdk=generate(plan);
 new vm.Script(sdk.source,{filename:"generated-client.js"});
 if(!plan.operations.length)throw Error("Zero imported provider operations");
 if(!plan.operations.some(o=>o.method==="POST"&&o.path.includes("/search/flights/")))
  throw Error("Missing published legacy flight-search path");
 if(!plan.baseUrl.startsWith("https://"))throw Error("Legacy provider base URL missing");
 if(!/Basic Authentication/i.test(String(data?.info?.description||"")))throw Error("Expected documented authentication prose in historical spec");
 if(plan.auth.length!==0)throw Error("Expected machine-readable security gap in historical spec; re-audit source revision");
 return{
  source:"official public Trip Ninja FareStructure OpenAPI; 2023-12-14 (legacy, NOT current SmartFlights)",
  missingMachineReadableAuth:plan.auth.length===0&&/basic authentication|authorization headers/i.test(String(data?.info?.description||"")),
  integrationReadiness:"blocked-until-auth-contract-reviewed",
  status:"read-only-contract-import-tested",title:plan.title,version:plan.version,
  operationCount:plan.operations.length,generatedSdkMethods:sdk.operations,
  flightSearch:plan.operations.filter(o=>o.path.includes("/search/flights/")).map(o=>({method:o.method,path:o.path,id:o.id,auth:o.authenticationRequired,required:o.requiredParameters})),
  importedAuth:plan.auth,
  highSeverityFinding:"Basic authentication is described in provider prose but absent from formal security schemes. Generated SDK auth is NOT verified and cannot be enabled for this provider.",
  warnings:[
   "This snapshot is legacy FareStructure, not the 2026 authorized SmartFlights contract",
   "Trip Ninja's narrative documentation describes Basic Authentication and IP whitelisting; do not assume all prose controls are captured by OpenAPI securitySchemes",
   "No provider HTTP endpoints, tokens, ticketing or supplier sandbox calls were executed",
   "Generating syntactically valid SDK source is not a tested provider integration"
  ]};
}
if(require.main===module){
 const filepath=process.argv[2],out=process.argv[3]||"benchmark-artifacts/trip-ninja-legacy-contract-audit.json";
 if(!filepath)throw Error("Pass converted public JSON specification");
 const result=audit(JSON.parse(fs.readFileSync(filepath,"utf8")));
 fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(result,null,2)+"\n");
 console.log(JSON.stringify({status:result.status,operations:result.operationCount,sdkMethods:result.generatedSdkMethods,legacy:true,authSchemas:result.importedAuth.length,missingMachineReadableAuth:result.missingMachineReadableAuth,integrationReadiness:result.integrationReadiness},null,2));
}
module.exports={audit};
