"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const api=require("../api-learning");
const spec={
 openapi:"3.0.3",info:{title:"Complex Travel API",version:"2026-10"},
 servers:[{url:"https://api.example.com/v1"}],
 components:{securitySchemes:{bearerAuth:{type:"http",scheme:"bearer"}},schemas:{Traveler:{type:"object",required:["email"],properties:{email:{type:"string"},name:{type:"string"}}}}},
 security:[{bearerAuth:[]}],
 paths:{
  "/travelers":{post:{operationId:"createTraveler",summary:"Create traveler",requestBody:{content:{"application/json":{schema:{$ref:"#/components/schemas/Traveler"}}}},responses:{"201":{description:"Created"}}}},
  "/trips/{id}":{get:{operationId:"getTrip",parameters:[{name:"id",in:"path",required:true,schema:{type:"string"}}],responses:{"200":{description:"OK"}}}},
  "/expenses":{post:{operationId:"submitExpense",requestBody:{content:{"application/json":{schema:{type:"object",required:["amount"],properties:{amount:{type:"number"},currency:{type:"string"}}}}}},responses:{"201":{description:"Created"}}}}
 }
};
test("learns documented operations, schemas, auth and required parameters",()=>{
 const p=api.learn(spec);assert.equal(p.title,"Complex Travel API");assert.equal(p.operations.length,3);
 assert.equal(p.operations[0].authenticationRequired,true);
 assert.deepEqual(p.operations[0].bodyFields.map(f=>f.name),["email","name"]);
 assert.equal(p.operations[0].bodyFields[0].required,true);
 assert.equal(p.operations[1].requiredParameters[0].name,"id");
 assert.equal(p.operations[2].bodyFields[0].type,"number");
 assert.match(api.instructions(p),/server-side adapter/);
});
test("API contract is read-only and never fetches remote references",()=>{
 const clone=structuredClone(spec);clone.paths["/travelers"].post.requestBody.content["application/json"].schema={$ref:"https://untrusted.example/schema.json"};
 const p=api.learn(clone);assert.deepEqual(p.operations[0].bodyFields,[]);
 assert.match(p.limitations.join(" " ),/not fetched/);
});
test("rejects invalid, oversized, missing and unsupported specifications",()=>{
 assert.throws(()=>api.learn("{}"),/Only OpenAPI/);
 assert.throws(()=>api.learn({openapi:"3.1.0",paths:{}}),/no supported HTTP operations/);
 assert.throws(()=>api.learn("x".repeat(400001)),/400 KB/);
 assert.throws(()=>api.learn({swagger:"1.2",paths:{"/x":{get:{}}}}),/Only OpenAPI/);
});
test("rejects API specifications with excessive operations",()=>{
 const large={openapi:"3.0.0",paths:{}};
 for(let i=0;i<151;i++)large.paths["/endpoint"+i]={get:{responses:{"200":{}}}};
 assert.throws(()=>api.learn(large),/150 operations/);
});
test("supports Swagger 2.0 input without executing operations",()=>{
 const p=api.learn({swagger:"2.0",info:{title:"Legacy",version:"1"},host:"api.example.com",schemes:["https"],basePath:"/v2",securityDefinitions:{key:{type:"apiKey",in:"header",name:"X-Key"}},paths:{"/items":{get:{responses:{"200":{}}}}}});
 assert.equal(p.format,"swagger2");assert.equal(p.baseUrl,"https://api.example.com/v2");assert.equal(p.operations.length,1);assert.equal(p.auth[0].type,"apiKey");
});
