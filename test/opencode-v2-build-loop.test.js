"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {makeClient}=require("../opencode-v2-client");
test("direct OpenCode V2 model -> build -> wait -> inspect diff -> repair -> wait pipeline",async()=>{
 const seen=[];
 const fetchImpl=async(url,opts)=>{
  seen.push({url,method:opts.method,body:opts.body?JSON.parse(opts.body):null});
  return{ok:true,json:async()=>url.endsWith("/api/session")?{data:{id:"ses_test"}}:{data:url.endsWith("/diff")?[{file:"app.ts",additions:1}]:[]}};
 };
 const client=makeClient({fetchImpl});
 const result=await client.runTurn({directory:"/tmp/kairoq-sandbox",model:{providerID:"opencode",modelID:"an-authorized-model"},text:"Build an app",repairPrompt:"Fix failed tests"});
 assert.equal(result.sessionID,"ses_test");
 assert.ok(result.repair);
 assert.equal(seen.filter(x=>x.url.endsWith("/prompt")).length,2);
 assert.equal(seen.filter(x=>x.url.endsWith("/wait")).length,2);
 assert.equal(seen.filter(x=>x.url.endsWith("/diff")).length,2);
 assert.equal(seen.find(x=>x.url.endsWith("/model")).body.model.modelID,"an-authorized-model");
});
test("isolated workspace is required",async()=>{
 await assert.rejects(makeClient().runTurn({directory:"relative/path",text:"Build"}),/isolated absolute/);
});
