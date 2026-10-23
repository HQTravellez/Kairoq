"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const mod=require("../integration-lab/decision-layer");
const result=(body)=>async(url,opts)=>({ok:true,json:async()=>body});
test("Jev decision is advisory and thresholded",async()=>{
 const r=await mod.classifyFailure("Vite build error: unexpected token",{key:"fixture-key",fetchImpl:result({
  answers:{cause:{type:"choice",choice:"build",confidence:0.93},human_review:{type:"noul",noul:0.12}}
 })});
 assert.equal(r.status,"classified");assert.equal(r.route,"build");
});
test("uncertainty and human review prevent automatic routing",async()=>{
 const data={answers:{cause:{type:"choice",choice:"auth",confidence:0.72},human_review:{type:"noul",noul:0.2}}};
 assert.equal((await mod.classifyFailure("Login failure",{key:"fixture",fetchImpl:result(data)})).route,"review");
 data.answers.cause.confidence=0.99;data.answers.human_review.noul=0.9;
 assert.equal((await mod.classifyFailure("Login failure",{key:"fixture",fetchImpl:result(data)})).route,"review");
});
test("invalid or missing responses do not make decisions",async()=>{
 assert.equal((await mod.classifyFailure("Trace",{key:"fixture",fetchImpl:result({answers:{}})})).route,"review");
 assert.equal((await mod.classifyFailure("Trace",{key:""})).status,"unavailable");
});
test("credentials are blocked before outgoing requests",async()=>{
 let invoked=false;
 await assert.rejects(mod.classifyFailure("api_key=SECRETTHING",{key:"fixture",fetchImpl:async()=>{invoked=true;}}),/credential/);
 assert.equal(invoked,false);
});
test("ScaleDown only returns shorter informational context",async()=>{
 const original="A".repeat(1000),short="A".repeat(140);
 const r=await mod.compressToolOutput(original,"Find the relevant section",{key:"fixture",fetchImpl:result({
  results:{success:true,compressed_prompt:short}
 })});
 assert.equal(r.status,"compressed");assert.equal(r.compressedLength,140);
 const bad=await mod.compressToolOutput(original,"Find the relevant section",{key:"fixture",fetchImpl:result({
  results:{success:true,compressed_prompt:original+"invalid"}
 })});
 assert.equal(bad.status,"unavailable");assert.equal(bad.original,original);
});
test("ScaleDown provider failure falls back to full context",async()=>{
 const r=await mod.compressToolOutput("Public documentation fragment","Find URL",{key:"fixture",fetchImpl:async()=>({ok:false,status:429})});
 assert.equal(r.status,"unavailable");assert.equal(r.original,"Public documentation fragment");
});
