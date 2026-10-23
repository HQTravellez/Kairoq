"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const engine=require("../api-workflow");
function operationFixture(operationId,requestSchema,responseSchema){
 return{post:{operationId,
  requestBody:{required:true,content:{"application/json":{schema:requestSchema}}},
  responses:{"200":{content:{"application/json":{schema:responseSchema}}}}
 }};
}
const trip={
 openapi:"3.0.3",info:{title:"Synthetic Trip-Ninja-style optimizer contract",version:"fixture"},
 servers:[{url:"https://test.trip-provider.example/v1"}],
 paths:{
  "/get-searches":operationFixture("getSearches",
   {type:"object",required:["route"],properties:{route:{type:"string"}}},
   {type:"object",required:["trip_id","queries"],properties:{trip_id:{type:"string"},queries:{type:"array",items:{type:"object"}}}}),
  "/generate-solutions":operationFixture("generateSolutions",
   {type:"object",required:["trip_id","datasource_responses"],properties:{trip_id:{type:"string"},datasource_responses:{type:"object"}}},
   {type:"object",required:["solutions"],properties:{solutions:{type:"array",items:{type:"object"}}}})
 }
};
function supplier(title,endpoint,operationId){
 return{openapi:"3.0.3",info:{title,version:"fixture"},servers:[{url:"https://"+title.toLowerCase()+".test.example"}],
  paths:{[endpoint]:operationFixture(operationId,
   {type:"object",required:["origin","destination"],properties:{origin:{type:"string"},destination:{type:"string"}}},
   {type:"array",items:{type:"object"}})}};
}
const contracts={tripninja:trip,sabre:supplier("Sabre","/air/search","searchFlights"),atlas:supplier("Atlas","/offers","getOffers")};
const recipe={steps:[
 {id:"queries",type:"call",provider:"tripninja",operationId:"getSearches",args:{body:{$ref:"input.search"}}},
 {id:"content",type:"fanout",items:{$ref:"steps.queries.queries"},routeField:"supplier",keyField:"request_id",
  routes:{
   sabre:{provider:"sabre",operationId:"searchFlights",args:{body:{$ref:"item.search"}}},
   atlas:{provider:"atlas",operationId:"getOffers",args:{body:{$ref:"item.search"}}}
  }},
 {id:"solutions",type:"call",provider:"tripninja",operationId:"generateSolutions",
  args:{body:{trip_id:{$ref:"steps.queries.trip_id"},datasource_responses:{$ref:"steps.content"}}}}
]};
const approvals=["tripninja:POST:/get-searches","tripninja:POST:/generate-solutions","sabre:POST:/air/search","atlas:POST:/offers"];
const input={search:{route:"YYZ-LHR"}};
const dataQueries={trip_id:"trip-fixture-12",queries:[
 {supplier:"sabre",request_id:"S1",search:{origin:"YYZ",destination:"LHR"}},
 {supplier:"atlas",request_id:"A1",search:{origin:"LHR",destination:"FRA"}}
]};
const fake=async ({provider,operationId,args})=>{
 if(operationId==="getSearches")return{ok:true,status:200,data:dataQueries};
 if(operationId==="searchFlights")return{ok:true,status:200,data:[{fare:119,provider}]};
 if(operationId==="getOffers")return{ok:true,status:200,data:[{fare:138,provider}]};
 if(operationId==="generateSolutions"){
  assert.equal(args.body.trip_id,"trip-fixture-12");
  assert.deepEqual(args.body.datasource_responses.S1,[{fare:119,provider:"sabre"}]);
  assert.deepEqual(args.body.datasource_responses.A1,[{fare:138,provider:"atlas"}]);
  return{ok:true,status:200,data:{solutions:[{fare:257}]}};
 }
 throw Error("Unknown simulated operation");
};
test("Trip Ninja-style search -> supplier fanout -> solutions is deterministic and fully mocked",async()=>{
 const report=await engine.run({contracts,workflow:recipe,input,approvedOperations:approvals,invoke:fake});
 assert.equal(report.status,"completed");
 assert.equal(report.operationCount,4);
 assert.deepEqual(report.output,{solutions:[{fare:257}]});
 assert.deepEqual(report.trace.map(t=>t.provider),["tripninja","sabre","atlas","tripninja"]);
});
test("explicit approval required even when the POST operation describes a search",async()=>{
 let called=0;
 await assert.rejects(()=>engine.run({contracts,workflow:recipe,input,invoke:async()=>{called++;throw Error("should not call")}}),/Explicit approval/);
 assert.equal(called,0);
});
test("caller must supply explicit invoker: never automatically contacts supplier hosts",async()=>{
 await assert.rejects(()=>engine.run({contracts,workflow:recipe,input,approvedOperations:approvals}),/No approved API executor/);
});
test("rejects undocumented provider routes before calling them",async()=>{
 let n=0;const invoke=async a=>{n++;if(a.operationId==="getSearches")return{ok:true,status:200,data:{trip_id:"t",queries:[{supplier:"unknown",request_id:"X1",search:{origin:"YYZ",destination:"LHR"}}]}};return fake(a)};
 await assert.rejects(()=>engine.run({contracts,workflow:recipe,input,approvedOperations:approvals,invoke}),/Unapproved provider route/);
 assert.equal(n,1);
});
test("rejects oversized fanout, duplicate result ids, unknown paths and forbidden prototype bindings",async()=>{
 let data=structuredClone(dataQueries);data.queries=Array.from({length:25},(_,i)=>({...data.queries[0],request_id:"S"+i}));
 const invoke=async a=>a.operationId==="getSearches"?{ok:true,status:200,data}:fake(a);
 await assert.rejects(()=>engine.run({contracts,workflow:recipe,input,approvedOperations:approvals,invoke}),/Fanout items missing or exceed limit/);
 data=structuredClone(dataQueries);data.queries[1].request_id="S1";
 await assert.rejects(()=>engine.run({contracts,workflow:recipe,input,approvedOperations:approvals,invoke}),/Duplicate fanout result key/);
 assert.throws(()=>engine.lookup("steps.__proto__.secret",{steps:{}}),/Unsafe binding/);
 assert.throws(()=>engine.materialize({__proto__:null,$ref:"input.hack"},{input:{}}),/Unresolved|Unsafe/);
});
test("request-body required fields and upstream response contracts fail closed",async()=>{
 const bad=async a=>a.operationId==="getSearches"?{ok:true,status:200,data:{trip_id:"t"}}:fake(a);
 await assert.rejects(()=>engine.run({contracts,workflow:recipe,input,approvedOperations:approvals,invoke:bad}),/response is missing queries/);
 await assert.rejects(()=>engine.run({contracts,workflow:recipe,input:{search:{}},approvedOperations:approvals,invoke:fake}),/body is missing route/);
});
test("trace records operation identity and HTTP status but not fare bodies or credentials",async()=>{
 const result=await engine.run({contracts,workflow:recipe,input,approvedOperations:approvals,invoke:fake});
 const trace=JSON.stringify(result.trace);
 assert.equal(trace.includes("fare"),false);
 assert.equal(trace.includes("trip-fixture"),false);
 assert.equal(trace.includes("secret"),false);
});
test("dependency templates cannot read global environment or prototypes",()=>{
 assert.throws(()=>engine.materialize({x:{$ref:"process.env.OPENAI_API_KEY"}},{input:{},steps:{}}),/Binding must reference/);
 assert.throws(()=>engine.materialize({x:{$ref:"input.constructor"}},{input:{},steps:{}}),/Unsafe binding/);
});
