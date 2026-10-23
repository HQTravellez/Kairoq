"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const catalog=require("../api-catalog"),intake=require("../api-product-intake");
const importer=require("../api-learning"),planner=require("../product-orchestrator");
const fixture={
 openapi:"3.0.3",info:{title:"Fictional Flight API",version:"2026-10"},
 servers:[{url:"https://flight.example.com/v1"}],
 security:[{key:[]}],components:{securitySchemes:{key:{type:"http",scheme:"bearer"}}},
 paths:{
  "/flights/search":{get:{
   operationId:"searchFlights",summary:"Search flight itineraries by departure and arrival airport",
   parameters:[
    {name:"origin",in:"query",required:true,schema:{type:"string"}},
    {name:"destination",in:"query",required:true,schema:{type:"string"}}
   ],
   responses:{"200":{description:"Results",content:{"application/json":{schema:{type:"object",properties:{offers:{type:"array",items:{type:"string"}}}}}}}}
  }},
  "/bookings":{post:{
   operationId:"createBooking",summary:"Confirm a booked flight itinerary from a flight offer",
   requestBody:{required:true,content:{"application/json":{schema:{type:"object",required:["offer_id"],properties:{offer_id:{type:"string"}}}}}},
   responses:{"201":{description:"Success",content:{"application/json":{schema:{type:"object",properties:{reference:{type:"string"}}}}}}}
  }}
 }
};
const contract=importer.learn(fixture);
const rawPlan={
 summary:"Flight operations dashboard with reservations and clear errors",
 schema:{collections:[{name:"bookings",label:"Bookings",fields:[
  {name:"departure",label:"Departure airport",type:"text",required:true},
  {name:"destination",label:"Destination airport",type:"text",required:true},
  {name:"reference",label:"Booking reference",type:"text",required:false}]}]},
 workflows:[{id:"search_flights",label:"Search flights",inputs:[
  {name:"origin",type:"string",required:true},{name:"destination",type:"string",required:true}],
  steps:[{id:"search",operationId:"searchFlights",arguments:{query:{origin:{$input:"origin"},destination:{$input:"destination"}}}}]}],
 requirements:[
  {id:"account",description:"Secure employee account",implementation:"auth",target:""},
  {id:"flights",description:"Find available flights",implementation:"workflow",target:"search_flights"},
  {id:"saved",description:"Store flight reservations",implementation:"collection",target:"bookings"},
  {id:"ticket",description:"Issue a confirmed flight ticket",implementation:"unsupported",target:""}],
 assumptions:["Fictional supplier; no live booking access granted"]
};
test("pinned public-apis catalog has meaningful categories, non-executable metadata and known travel APIs",()=>{
 const stats=catalog.stats();
 assert.equal(stats.source,"public-apis/public-apis");
 assert.match(stats.sourceCommit,/^[a-f0-9]{40}$/);
 assert.ok(stats.entries>1700);
 assert.ok(stats.categories>35);
 assert.ok(catalog.categories().includes("Transportation"));
 const result=catalog.search("flight travel airport booking",{limit:15});
 assert.ok(result.total>0);
 assert.equal(result.candidates.length,15);
 assert.ok(result.candidates.some(x=>x.category==="Transportation"));
 assert.ok(result.candidates.every(x=>x.status==="directory-only-unverified"));
 assert.ok(result.candidates.every(x=>x.url.startsWith("https://")));
 const amadeus=catalog.search("Amadeus",{limit:12}).candidates.find(x=>/Amadeus for Developers/.test(x.name));
 assert.ok(amadeus,"Expected real community listing for Amadeus");
 assert.equal(catalog.find(amadeus.id).url,amadeus.url);
 assert.equal(catalog.find(amadeus.id).auth,"OAuth");
 assert.ok(!JSON.stringify(result).includes("API_KEY"));
});
test("catalog avoids overlarge searches, invalid selections, and privileged execution claims",()=>{
 assert.throws(()=>catalog.search("a".repeat(501)),/at most 500/);
 assert.throws(()=>catalog.search("flight",{limit:999}),/limit/);
 assert.throws(()=>catalog.find("__proto__"),/Invalid API catalog/);
 assert.throws(()=>catalog.find("0".repeat(16)),/Unknown/);
 assert.equal(catalog.search("zzqxxvqlkmnop987654321",{limit:5}).candidates.length,0);
});
test("requirements map only to names documented by imported formal operations and flag unsupported actions",()=>{
 const bp=intake.blueprint("Search flights by airport and issue tickets with an employee dashboard",contract);
 assert.equal(bp.formalContract,true);
 assert.equal(bp.documentedOperations,2);
 assert.equal(bp.workflowExecution,"disabled-until-approved-sandbox-and-credentials");
 assert.ok(bp.requirements.every(r=>r.operations.every(op=>contract.operations.some(o=>o.id===op.operationId))));
 assert.equal(bp.readiness,"eligible-for-model-planning-and-controlled-mock-tests");
 assert.equal(bp.authentication[0].scheme,"bearer");
 const no=intake.blueprint("Issue a verified airline e-ticket in a new market",contract);
 assert.ok(no.warnings.some(x=>x.includes("No supplier data")));
});
test("directory search alone never becomes a formal executable contract",async()=>{
 const suggestion=catalog.search("Amadeus",{limit:10}).candidates.find(x=>x.name==="Amadeus for Developers");
 const raw=await intake.analyze({brief:"Build a corporate travel booking dashboard",catalogId:suggestion.id});
 assert.equal(raw.blueprint.formalContract,false);
 assert.equal(raw.blueprint.readiness,"requires-formal-api-contract");
 assert.equal(raw.blueprint.source.status,"discovery-lead-unverified");
 let calls=0;
 const result=await intake.prepare({brief:"Build a corporate travel booking dashboard",catalogId:suggestion.id},{callModel:async()=>{calls++;throw Error("should not call")}});
 assert.equal(result.productPlan,null);assert.equal(result.readiness,"blocked-no-formal-contract");assert.equal(calls,0);
});
test("unstructured documentation never becomes an executable workflow or an invented product plan",async()=>{
 let calls=0;
 const result=await intake.prepare({brief:"Build a premium weather dashboard with live alerts",
  documentationText:"GET /weather returns the forecast. POST /alerts creates alerts."},
 {callModel:async()=>{calls++;throw Error("not allowed")}});
 assert.equal(result.blueprint.format,"unstructured");
 assert.equal(result.blueprint.formalContract,false);
 assert.equal(result.productPlan,null);
 assert.equal(calls,0);
});
test("end-to-end requirement -> versioned OpenAPI -> AI planning -> schema/workflow validation -> build handoff",async()=>{
 let calls=0,seenPrompt="";
 const result=await intake.prepare({brief:"Build a corporate flight search dashboard with saved bookings and employee authentication",apiSpec:fixture},
  {callModel:async opts=>{calls++;assert.equal(opts.purpose,"product-plan");seenPrompt=opts.messages[0].content;
    return{product_plan:structuredClone(rawPlan)};}});
 assert.equal(calls,1);
 assert.equal(result.readiness.status,"blocked"); // keys and unsupported ticketing require review
 assert.equal(result.productPlan.schema.collections[0].name,"bookings");
 assert.equal(result.productPlan.workflows[0].steps[0].operationId,"searchFlights");
 assert.ok(result.productPlan.blockers.some(x=>x.includes("ticket")));
 assert.equal(result.providerCalls,0);
 assert.equal(result.externalCalls,0);
 assert.equal(result.previewOnly,true);
 assert.match(seenPrompt,/IMPORTED CONTRACT/);
 assert.match(seenPrompt,/USER BRIEF/);
 assert.ok(!seenPrompt.includes("Authorization: Bearer secret"));
 const roundtrip=planner.normalize(result.productPlan,contract);
 assert.deepEqual(roundtrip,result.productPlan);
});
test("model-invented provider operations fail validation instead of being accepted",async()=>{
 let calls=0;
 await assert.rejects(()=>intake.prepare({brief:"Build a corporate flight management workspace",apiPlan:contract},
  {callModel:async()=>{calls++;const invalid=structuredClone(rawPlan);invalid.workflows[0].steps[0].operationId="inventedBookingApi";return invalid;}}),
  /Product planning failed after 3 attempts/);
 assert.equal(calls,3);
});
test("invalid or contradictory source input is rejected before fetching third-party docs",async()=>{
 await assert.rejects(()=>intake.analyze({brief:"Build corporate travel applications",apiSpec:fixture,documentationUrl:"https://example.org/docs"}),/one contract/);
 await assert.rejects(()=>intake.analyze({brief:"x",apiSpec:fixture}),/12–6000/);
 await assert.rejects(()=>intake.analyze({brief:"Build corporate travel application",documentationUrl:"http://127.0.0.1/admin"}),/public HTTPS/);
});
test("no formal spec when provider base URL is malformed, even with plausible operations",()=>{
 const malformed=structuredClone(contract);malformed.baseUrl="http://localhost/admin";
 const bp=intake.blueprint("Build authenticated enterprise API dashboard",malformed);
 assert.equal(bp.formalContract,false);
 assert.match(bp.warnings.join(" "),/Formal contract unavailable/);
});
