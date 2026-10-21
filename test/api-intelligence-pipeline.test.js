"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const ai=require("../api-intelligence"),pipe=require("../api-intelligence-pipeline");
const form=(name,paths)=>({
 openapi:"3.0.3",info:{title:name,version:"1"},
 servers:[{url:"https://api."+name+".example/v1"}],
 paths:Object.fromEntries(paths.map(([path,id,method,schema])=>[path,{
  [method.toLowerCase()]:{
   operationId:id,
   ...(schema?{requestBody:{required:true,content:{"application/json":{schema}}}}:{}),
   responses:{"200":{content:{"application/json":{schema:{type:"object"}}}}}
  }
 }]))
});
const obj=(required=[],properties={})=>({type:"object",required,properties});
const contracts={
 tripninja:form("tripninja",[
  ["/searches","prepareSearch","POST",obj(["journey"],{journey:{type:"string"}})],
  ["/solutions","solve","POST",obj(["query_id","results"],{query_id:{type:"string"},results:{type:"object"}})]]),
 supplier:form("supplier",[
  ["/fares","getFares","POST",obj(["origin","destination"],{origin:{type:"string"},destination:{type:"string"}})]])
};
const recipe={steps:[
 {id:"plan",type:"call",provider:"tripninja",operationId:"prepareSearch",args:{body:{$ref:"input"}}},
 {id:"responses",type:"fanout",items:{$ref:"steps.plan.queries"},routeField:"source",keyField:"key",
  routes:{supplier:{provider:"supplier",operationId:"getFares",args:{body:{$ref:"item.args"}}}}},
 {id:"final",type:"call",provider:"tripninja",operationId:"solve",
  args:{body:{query_id:{$ref:"steps.plan.query_id"},results:{$ref:"steps.responses"}}}}
]};
const approvals=["tripninja:POST:/searches","tripninja:POST:/solutions","supplier:POST:/fares"];
const publicSnippet="POST /searches returns supplier queries. The caller must search each supplier then POST /solutions with the correlated results.";
const mockVendor=async(url,init)=>{
 const payload=JSON.parse(init.body);
 if(url===ai.ENDPOINTS.classify){
  assert.equal(init.headers["x-api-key"],"fixture-cdm");
  assert.equal(payload.reasoning,false);
  assert.ok(payload.labels.some(l=>l.name==="dependencies"));
  return {ok:true,text:async()=>JSON.stringify({
   top_label:"dependencies",scores:{dependencies:.91,authentication:.03,mapping:.03,errors:.01,other:.02},
   usage:{input_tokens:100,output_tokens:10}})};
 }
 if(url===ai.ENDPOINTS.jev){
  assert.equal(init.headers.Authorization,"Bearer fixture-jev");
  assert.equal(payload.model,"jev-latest");
  assert.ok(payload.questions.next.criteria.workflow);
  return {ok:true,text:async()=>JSON.stringify({answers:{next:{type:"choice",choice:"workflow",
   confidence:.93,probabilities:{workflow:.94,auth:.01,mapping:.02,validation:.01,contract:.01,review:.01}}},
   usage:{input_tokens:110,output_tokens:17}})};
 }
 throw Error("Unknown vendor endpoint");
};
const fakeExecutor=async({provider,operationId,args})=>{
 if(operationId==="prepareSearch")return{ok:true,status:200,data:{query_id:"r-23",queries:[{source:"supplier",key:"s1",args:{origin:"YYZ",destination:"LHR"}}]}};
 if(operationId==="getFares"){assert.equal(args.body.origin,"YYZ");return{ok:true,status:200,data:{fares:[{amount:125}]} };}
 if(operationId==="solve"){assert.equal(args.body.query_id,"r-23");assert.equal(args.body.results.s1.fares[0].amount,125);return{ok:true,status:200,data:{itineraries:[{price:125}]}};}
 throw Error("Unexpected operation");
};
test("ScaleDown CDM request matches documented /classify and Jev typed decision API",async()=>{
 const c=await ai.classifyDocumentation(publicSnippet,{enabled:true,key:"fixture-cdm",fetchImpl:mockVendor});
 assert.equal(c.status,"classified");assert.equal(c.label,"dependencies");
 assert.deepEqual(c.usage,{input:100,output:10});
 const j=await ai.chooseInvestigation("API dependency requires several supplier calls",{enabled:true,key:"fixture-jev",fetchImpl:mockVendor});
 assert.equal(j.status,"advisory");assert.equal(j.next,"workflow");assert.deepEqual(j.usage,{input:110,output:17});
 assert.equal(c.source.bytes,Buffer.byteLength(publicSnippet));
 assert.equal(JSON.stringify(c).includes(publicSnippet),false);
});
test("full pipeline: contracts -> CDM + Jev advice -> SDKs -> four mocked supplier calls",async()=>{
 const prepared=await pipe.prepare({contracts,workflow:recipe,publicDocumentation:[publicSnippet],
  ai:{enabled:true,allowThirdPartyDisclosure:true,scaleDownKey:"fixture-cdm",jevKey:"fixture-jev",
   jevRates:{inputPerMillion:.042,outputPerMillion:0}},fetchImpl:mockVendor});
 assert.equal(prepared.status,"prepared-not-executed");
 assert.equal(prepared.advisory.cdm[0].label,"dependencies");
 assert.equal(prepared.advisory.jev.next,"workflow");
 assert.equal(prepared.graph.providers.length,2);
 assert.equal(prepared.sdks.supplier.status,"generated-unexecuted");
 assert.ok(prepared.sdks.supplier.source.includes("getFares"));
 assert.equal(prepared.advisory.estimatesUSD.jev,.00000462);
 assert.equal(prepared.advisory.estimatesUSD.scaledown,null);
 const output=await pipe.testWorkflow({prepared,contracts,workflow:recipe,
  input:{journey:"YYZ-LHR"},approvedOperations:approvals,invoke:fakeExecutor});
 assert.equal(output.operationCount,3);
 assert.deepEqual(output.output,{itineraries:[{price:125}]});
});
test("baseline and intelligence-assisted workflows yield exactly same deterministic execution",async()=>{
 const disabled=await pipe.prepare({contracts,workflow:recipe,publicDocumentation:[publicSnippet],ai:{enabled:false}});
 assert.equal(disabled.advisory.cdm[0].status,"disabled");
 assert.equal(disabled.advisory.jev.status,"disabled");
 const out=await pipe.testWorkflow({prepared:disabled,contracts,workflow:recipe,input:{journey:"YYZ-LHR"},
  approvedOperations:approvals,invoke:fakeExecutor});
 const enabled=await pipe.prepare({contracts,workflow:recipe,publicDocumentation:[publicSnippet],
  ai:{enabled:true,allowThirdPartyDisclosure:true,scaleDownKey:"fixture-cdm",jevKey:"fixture-jev"},fetchImpl:mockVendor});
 const out2=await pipe.testWorkflow({prepared:enabled,contracts,workflow:recipe,input:{journey:"YYZ-LHR"},
  approvedOperations:approvals,invoke:fakeExecutor});
 assert.deepEqual(out,out2);
});
test("model providers are not called without explicit third-party data disclosure permission",async()=>{
 let calls=0;const fetched=async()=>{calls++;throw Error("must remain offline")};
 const a=await pipe.prepare({contracts,workflow:recipe,publicDocumentation:[publicSnippet],
  ai:{enabled:true,scaleDownKey:"fixture-cdm",jevKey:"fixture-jev"},fetchImpl:fetched});
 assert.equal(a.advisory.cdm[0].status,"disabled");assert.equal(a.advisory.jev.status,"disabled");assert.equal(calls,0);
});
test("missing credentials do not block deterministic API SDK generation or workflow",async()=>{
 const prepared=await pipe.prepare({contracts,workflow:recipe,publicDocumentation:[publicSnippet],
  ai:{enabled:true,allowThirdPartyDisclosure:true,scaleDownKey:"",jevKey:""},fetchImpl:mockVendor});
 assert.equal(prepared.advisory.cdm[0].status,"unavailable");
 assert.equal(prepared.advisory.jev.status,"unavailable");
 assert.equal(prepared.sdks.supplier.status,"generated-unexecuted");
 assert.equal(prepared.advisory.estimatesUSD.jev,null);
 const out=await pipe.testWorkflow({prepared,contracts,workflow:recipe,
  input:{journey:"YYZ-LHR"},approvedOperations:approvals,invoke:fakeExecutor});
 assert.equal(out.status,"completed");
});
test("external provider errors and confidence failures return review/unavailable, never invented operations",async()=>{
 const bad=async()=>({ok:true,text:async()=>JSON.stringify({top_label:"imaginary",scores:{imaginary:1}})});
 assert.equal((await ai.classifyDocumentation(publicSnippet,{enabled:true,key:"fixture",fetchImpl:bad})).status,"review");
 const badJ=async()=>({ok:true,text:async()=>JSON.stringify({answers:{next:{type:"choice",choice:"deploy",confidence:1,probabilities:{deploy:1}}}})});
 assert.equal((await ai.chooseInvestigation("Investigate an API failure",{enabled:true,key:"fixture",fetchImpl:badJ})).status,"review");
 const offline=async()=>{throw Error("network")};
 assert.equal((await ai.chooseInvestigation("Investigate a fixture",{enabled:true,key:"fixture",fetchImpl:offline})).status,"unavailable");
});
test("rejects private credentials before dispatching any vendor request",async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error("unexpected")};
 await assert.rejects(()=>ai.classifyDocumentation("Authorization: Bearer abcdefghijklmnopqrstuv",{enabled:true,key:"fixture",fetchImpl}),/credential/);
 await assert.rejects(()=>ai.chooseInvestigation("client_secret: topsecret",{enabled:true,key:"fixture",fetchImpl}),/credential/);
 assert.equal(calls,0);
});
test("AI suggestions cannot grant write approvals or modify workflow graph",async()=>{
 const prep=await pipe.prepare({contracts,workflow:recipe,publicDocumentation:[publicSnippet],
  ai:{enabled:true,allowThirdPartyDisclosure:true,scaleDownKey:"fixture-cdm",jevKey:"fixture-jev"},fetchImpl:mockVendor});
 await assert.rejects(()=>pipe.testWorkflow({prepared:prep,contracts,workflow:recipe,
  input:{journey:"YYZ-LHR"},approvedOperations:[],invoke:fakeExecutor}),/Explicit approval/);
});
test("no estimated ScaleDown cost when rates are missing; rejecting negative rates",()=>{
 assert.equal(ai.estimateCost({input:100,output:12},null),null);
 assert.equal(ai.estimateCost({input:100,output:12},{inputPerMillion:-.2,outputPerMillion:0}),null);
 assert.equal(ai.estimateCost({input:100,output:12},{inputPerMillion:1,outputPerMillion:2}),.000124);
});
test("unstructured source cannot masquerade as an approved formal API contract",()=>{
 assert.throws(()=>pipe.manifest({tripninja:{format:"unstructured",operations:[{id:"fake",method:"POST",path:"/fake"}]}},
  {steps:[{id:"s",type:"call",provider:"tripninja",operationId:"fake"}]}),/formal API contract/);
});
