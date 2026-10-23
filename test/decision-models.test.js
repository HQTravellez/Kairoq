"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const d=require("../integration-lab/decision-models");
const answer={answers:{route:{type:"choice",choice:"api",probabilities:{api:0.94,coding:0.03,qa:0.03},confidence:0.96}}};
function mockHttp(value,spy){return async(url,options)=>{spy&&spy(url,options);return{ok:true,status:200,text:async()=>JSON.stringify(value)}}}
test("Jev dispatches an API task with verified typed output",async()=>{
 let seen;
 const r=await d.routeTask("Read this OpenAPI spec and generate a client",{
  key:"test-secret",fetchImpl:mockHttp(answer,(url,opts)=>{seen={url,opts}})
 });
 assert.equal(r.status,"routed");assert.equal(r.route,"api");
 assert.equal(seen.url,d.ENDPOINTS.jev);
 assert.equal(seen.opts.headers.Authorization,"Bearer test-secret");
 assert.equal(JSON.parse(seen.opts.body).questions.route.type,"choice");
});
test("CDM Classify provider uses dedicated API key header",async()=>{
 let headers;
 const r=await d.routeTask("Review responsive app visuals",{
  provider:"scaledown",key:"fake-key",
  fetchImpl:mockHttp({...answer,answers:{route:{...answer.answers.route,choice:"design",probabilities:{design:0.94}}}},(url,options)=>{headers=options.headers;assert.equal(url,d.ENDPOINTS.scaledown)})
 });
 assert.equal(r.route,"design");assert.equal(headers["x-api-key"],"fake-key");
 assert.equal(headers.Authorization,undefined);
});
test("No unrecognized choice or uncertain decision auto-routes",async()=>{
 assert.equal(d.parseRouting({answers:{route:{type:"choice",choice:"delete_all",confidence:1,probabilities:{delete_all:1}}}}).status,"fallback");
 assert.equal(d.parseRouting({answers:{route:{...answer.answers.route,confidence:0.4}}}).status,"review");
 assert.equal(d.parseRouting({answers:{route:{...answer.answers.route,probabilities:{api:0.4}}}}).status,"review");
});
test("High-impact requests never go to a decision model for approval",async()=>{
 let called=false;
 const r=await d.routeTask("deploy the app",{
  action:"deploy production",key:"key",fetchImpl:async()=>{called=true;throw Error("No")}
 });
 assert.equal(r.status,"review");assert.equal(called,false);
});
test("Unavailable key and network failures fall back without claiming success",async()=>{
 const none=await d.routeTask("make a page",{key:"",fetchImpl:async()=>{throw Error("should not fetch")}});
 assert.ok(["unavailable","fallback"].includes(none.status));
 const broken=await d.routeTask("make a page",{key:"fake",fetchImpl:async()=>{throw Error("Network error")}});
 assert.equal(broken.status,"fallback");
});
test("Reject oversized state and unknown providers",async()=>{
 await assert.rejects(d.routeTask("x".repeat(24001),{key:"fake"}),/12000/);
 await assert.rejects(d.routeTask("hello",{provider:"custom",key:"fake"}),/Unknown/);
});
test("ScaleDown compression produces a smaller optional context",async()=>{
 const raw="Long agent tool trace. ".repeat(350);let req;
 const result=await d.compressToolResult(raw,"Find the API request error",{key:"fake",
  fetchImpl:mockHttp({results:{success:true,compressed_prompt:"The API returned an HTTP 400 error."}},(_u,options)=>{req=JSON.parse(options.body)})});
 assert.equal(result.status,"compressed");assert.ok(result.compressedLength<raw.length);
 assert.equal(req.context,raw);assert.equal(req.scaledown.rate,"auto");
});
test("No key, malformed compression, and network failure preserve full original input",async()=>{
 const original="abc ".repeat(1200);
 const missing=await d.compressToolResult(original,"problem",{key:""});
 assert.equal(missing.content,original);
 const invalid=await d.compressToolResult(original,"problem",{key:"fake",fetchImpl:mockHttp({bad:"shape"})});
 assert.equal(invalid.status,"fallback");assert.equal(invalid.content,original);
 const bad=await d.compressToolResult(original,"problem",{key:"fake",fetchImpl:async()=>{throw Error("offline")}});
 assert.equal(bad.content,original);
});

test("Public fixture credential guard prevents external routing requests",async()=>{
 let requested=false;
 await assert.rejects(d.routeTask("api_key=VERYSECRET",{key:"fake",fetchImpl:async()=>{requested=true}}),/credential/i);
 assert.equal(requested,false);
});
