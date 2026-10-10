"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const docs=require("../api-docs"),api=require("../api-learning"),evolution=require("../api-evolution");
const before={openapi:"3.0.3",info:{title:"Payments",version:"1"},paths:{"/payments":{get:{operationId:"listPayments",responses:{"200":{}}},post:{operationId:"createPayment",requestBody:{content:{"application/json":{schema:{type:"object",properties:{amount:{type:"number"}}}}}},responses:{"201":{}}}}}};
test("Postman v2 documentation imports operations without executing them",()=>{
 const data={info:{name:"Travel Collection",schema:"https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},item:[{name:"Travel",item:[{name:"Find hotels",request:{method:"GET",url:{raw:"https://api.example.com/hotels",path:["hotels"]}}},{name:"Book hotel",request:{method:"POST",url:{raw:"https://api.example.com/bookings",path:["bookings"]}}}]}]};
 const result=docs.infer(JSON.stringify(data));assert.equal(result.format,"postman-v2");assert.equal(result.operations.length,2);assert.equal(result.operations[1].method,"POST");
 assert.match(result.limitations.join(" "),/not verified/);
});
test("API drift detects breaking changes and additions",()=>{
 const next=structuredClone(before);next.info.version="2";delete next.paths["/payments"].get;
 next.paths["/payments"].post.requestBody.content["application/json"].schema.properties.currency={type:"string"};
 next.paths["/payments"].post.requestBody.content["application/json"].schema.required=["currency"];
 next.paths["/refunds"]={get:{responses:{"200":{}}}};
 const result=evolution.diff(before,next);
 assert.equal(result.breaking,true);assert.ok(result.removed.includes("GET /payments"));assert.ok(result.added.includes("GET /refunds"));assert.deepEqual(result.changed[0].newRequiredFields,["currency"]);
});
test("nonbreaking added API operations do not require review",()=>{
 const next=structuredClone(before);next.paths["/refunds"]={get:{responses:{"200":{}}}};
 const result=evolution.diff(before,next);assert.equal(result.breaking,false);assert.equal(result.requiresReview,false);assert.equal(result.added.length,1);
});
