"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const docs=require("../api-docs"),apijson=require("../api-apijson");
const catalog=require("../api-catalog"),patterns=require("../api-pattern-catalog");
const system=require("../api-system-design"),intake=require("../api-product-intake");
const spec={openapi:"3.0.3",info:{title:"Reviewed travel service",version:"2026-10"},
 servers:[{url:"https://api.travel-example.com/v1"}],
 paths:{"/flights/search":{get:{operationId:"flightSearch",summary:"Search flight availability by origin",
 parameters:[{name:"origin",in:"query",required:true,schema:{type:"string"}}],
 responses:{"200":{description:"Results",content:{"application/json":{schema:{type:"object",properties:{offers:{type:"array",items:{type:"string"}}}}}}}}}}}};
const formal=require("../api-learning").learn(spec);
test("APIJSON documentation is recognized as protocol, not a machine-readable OpenAPI contract",()=>{
 const example="APIJSON Get a User. base_url/get/ GET /get {\"User\":{}} and @column id,name.";
 assert.equal(apijson.detect(example),true);
 const report=docs.infer(example);
 assert.equal(report.format,"apijson-protocol");
 assert.equal(report.operations.length,0);
 assert.ok(report.requiredEvidence.some(x=>x.includes("tables")));
 const bp=intake.blueprint("Build an authenticated APIJSON dashboard",report);
 assert.equal(bp.formalContract,false);
 assert.match(bp.warnings.join(" "),/Formal contract unavailable/);
});
test("APIJSON requires a reviewed table manifest; mutations remain blocked without explicit permission",()=>{
 const base={baseUrl:"https://example.com/",tables:[{name:"Bookings",fields:[{name:"id",type:"integer"},{name:"status",type:"string"}]}]};
 const result=apijson.fromManifest(base);
 assert.equal(result.protocol,"APIJSON");
 assert.deepEqual(result.operations.map(x=>x.id),["apijson_get","apijson_gets"]);
 assert.equal(result.integrationReadiness,"awaiting-sandbox-and-auth-verification");
 assert.equal(result.auth.length,0);
 assert.throws(()=>apijson.fromManifest({...base,enableMutations:true}),/writes require/i);
 assert.throws(()=>apijson.fromManifest({...base,baseUrl:"http://127.0.0.1/admin"}),/public HTTPS/);
 assert.throws(()=>apijson.fromManifest({...base,tables:[{name:"Bookings",fields:[{name:"status",type:"string"}]}]}),/id field/);
});
test("provider-specific APIJSON writes require explicit schema, permission and writable table",()=>{
 const m={baseUrl:"https://api.example.org/",tables:[{name:"Trips",fields:[{name:"id",type:"integer"}],allowWrites:true}],
  permissionConfirmed:true,schemaVerified:true,authKind:"bearer",enableMutations:true};
 const contract=apijson.fromManifest(m);
 assert.equal(contract.operations.length,5);
 assert.equal(contract.auth[0].scheme,"bearer");
 assert.ok(contract.operations.some(x=>x.id==="apijson_delete"&&x.method==="POST"));
 assert.match(contract.warnings.join(" "),/No API operation was executed/i);
});
test("awesome-llm-apps pattern suggestions are bounded references, never imported execution",()=>{
 const r=patterns.search("Create a corporate travel planner with MCP agents and flight itinerary search");
 assert.equal(r.source,"Shubhamsaboo/awesome-llm-apps");
 assert.ok(r.matches.some(x=>x.category==="travel"));
 assert.ok(r.matches.every(x=>x.status==="unverified-architecture-example"));
 assert.ok(r.matches.every(x=>x.url.startsWith("https://github.com/")));
 assert.ok(!JSON.stringify(r).includes("API_KEY="));
 assert.throws(()=>patterns.search("x".repeat(6001)),/6000/);
});
test("system-design recommendations are scoped, attributed CC BY 4.0 and tradeoff-aware",()=>{
 const r=system.recommend("Build a reliable 24/7 travel booking and supplier API integration that queues invoice jobs");
 assert.equal(r.license,"CC BY 4.0");
 assert.ok(r.recommendations.some(x=>x.id==="integration"));
 assert.ok(r.recommendations.some(x=>x.id==="queue"));
 assert.ok(r.recommendations.every(x=>x.tradeoff.length>0));
 assert.ok(r.recommendations.length<=7);
});
test("blueprint exposes architecture knowledge without pretending the system was deployed",()=>{
 const bp=intake.blueprint("Build a reliable flight booking product with supplier API integration",formal);
 assert.equal(bp.formalContract,true);
 assert.ok(bp.architecturePatterns.matches.length>0);
 assert.ok(bp.architectureReview.recommendations.some(x=>x.id==="integration"));
 assert.equal(bp.workflowExecution,"disabled-until-approved-sandbox-and-credentials");
});
test("auto discovery checks at most three allowlisted leads and only accepts formal documentation",async()=>{
 let calls=0;
 const out=await intake.analyze({brief:"Search flights by airport with a corporate dashboard",autoDiscover:true},{
  docsDiscover:async()=>{calls++;if(calls===1)return docs.infer("GET /random available");return formal;}
 });
 assert.equal(calls,2);
 assert.equal(out.blueprint.formalContract,true);
 assert.equal(out.apiPlan.title,"Reviewed travel service");
 assert.equal(out.blueprint.automatedDiscovery.status,"formal-contract-found");
 assert.equal(out.blueprint.automatedDiscovery.attempts.length,2);
});
test("missing host approvals do not trigger unsafe browsing or fabricated API contracts",async()=>{
 let calls=0,modelCalls=0;
 const out=await intake.prepare({brief:"Build corporate travel booking dashboard with flights and calendars",autoDiscover:true},{
  docsOptions:{docsDiscover:async()=>{calls++;throw Error("Documentation host is not allowlisted")}},
  callModel:async()=>{modelCalls++;throw Error("should never run")}
 });
 assert.ok(calls<=3&&calls>0);
 assert.equal(modelCalls,0);
 assert.equal(out.productPlan,null);
 assert.equal(out.readiness,"blocked-no-formal-contract");
 assert.ok(out.blueprint.automatedDiscovery.attempts.every(x=>x.status==="blocked-host-not-allowlisted"));
});
test("architecture reference advice enters product-model prompt as untrusted ideas only",async()=>{
 let prompts=[];
 await assert.rejects(()=>intake.prepare({brief:"Build a supplier travel search and bookings dashboard",apiSpec:spec},{
  callModel:async x=>{prompts.push(x.messages[0].content);throw Error("test rejection")}
 }),/Product planning failed after 3 attempts/);
 assert.ok(prompts.length>=1&&prompts.length<=3);
 assert.match(prompts[0],/SYSTEM DESIGN CHECKS/);
 assert.match(prompts[0],/EXAMPLE ARCHITECTURE REFERENCES/);
 assert.match(prompts[0],/IMPORTED CONTRACT/);
 assert.match(prompts[0],/never copy source/);
});
