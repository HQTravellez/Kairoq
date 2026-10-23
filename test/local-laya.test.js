"use strict";
const t=require("node:test"),assert=require("node:assert/strict");
const {routeLocal,parseLaya,layaEndpoint}=require("../integration-lab/local-laya");
const sample=(choice="api",confidence=.93)=>({answers:{route:{
 type:"choice",choice,confidence:.15,answer_confidence:confidence,
 probabilities:{coding:.01,api:confidence,design:.02,qa:.02,discussion:.02}}},usage:{input_tokens:41,output_tokens:0}});
t("Laya is pinned to IPv4 loopback and has no remote URL override",()=>{
 assert.equal(layaEndpoint(8000),"http://127.0.0.1:8000/v1/systemone");
 assert.throws(()=>layaEndpoint("8000@attacker"),/Invalid/);
 assert.throws(()=>layaEndpoint(0),/Invalid/);
 assert.throws(()=>layaEndpoint(70000),/Invalid/);
});
t("Laya checks answer_confidence, never entropy confidence",()=>{
 assert.equal(parseLaya(sample("api",.93)).route,"api");
 assert.equal(parseLaya(sample("api",.61)).status,"review");
 assert.equal(parseLaya({answers:{route:{type:"choice",choice:"secret",answer_confidence:.99}}}).status,"fallback");
 assert.equal(parseLaya({answers:{route:{type:"choice",choice:"api",confidence:.99}}}).status,"review");
 assert.equal(parseLaya({answers:{route:{type:"choice",choice:"api",probabilities:{api:.90}}}}).route,"api");
 assert.equal(parseLaya({answers:{route:{type:"choice",choice:"api",answer_confidence:.99,abstention:"abstained"}}}).status,"review");
});
t("local mock response routes no privileges and parses token usage",async()=>{
 let called=false;
 const fetchImpl=async(url,init)=>{
  called=true;
  assert.equal(url,"http://127.0.0.1:8000/v1/systemone");
  assert.equal(init.redirect,"error");
  assert.equal(JSON.parse(init.body).questions.route.criteria.api.includes("API"),true);
  assert.equal(JSON.parse(init.body).model,"english");
  assert.equal(init.headers.authorization,undefined);
  return{ok:true,text:async()=>JSON.stringify(sample())};
 };
 const r=await routeLocal("Read an OpenAPI spec",{fetchImpl});
 assert.equal(r.status,"routed");assert.equal(r.route,"api");assert.equal(r.inputTokens,41);assert.equal(called,true);
});
t("high-impact actions and apparent credentials never reach inference",async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error("not expected")};
 assert.equal((await routeLocal("deploy the app",{action:"deploy",fetchImpl})).status,"review");
 await assert.rejects(()=>routeLocal("password: TOPSECRET",{fetchImpl}),/credential/i);
 assert.equal(calls,0);
});
t("offline, malformed, oversized or unexpected responses safely abstain",async()=>{
 const offline=await routeLocal("Improve design",{fetchImpl:async()=>{throw Error("offline")}});
 assert.equal(offline.status,"unavailable");
 const bad=await routeLocal("Improve design",{fetchImpl:async()=>({ok:true,text:async()=>"{oops"})});
 assert.equal(bad.status,"unavailable");
 const huge=await routeLocal("Improve design",{fetchImpl:async()=>({ok:true,text:async()=>"x".repeat(64001)})});
 assert.equal(huge.status,"unavailable");
});
