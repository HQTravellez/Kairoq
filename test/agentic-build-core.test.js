"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const routing=require("../build-routing");
test("first build is agentic even when user clicks Build",()=>{
 const meta={current_version:1,versions:[{n:1,summary:"Starter project"}]};
 assert.equal(routing.executionMode({requestedMode:"build",meta,message:"Build a simple portfolio"}),"agent");
});
test("complex existing-app change is agentic, small edit stays fast",()=>{
 const meta={current_version:4,versions:[{n:4,summary:"Working app"}]};
 const complex="Build a CRM with database, authentication, dashboard, workflows, browser testing and automated tests.";
 assert.equal(routing.executionMode({requestedMode:"build",meta,message:complex}),"agent");
 assert.equal(routing.executionMode({requestedMode:"build",meta,message:"Make the button blue"}),"build");
});
test("empty length-limited model response retries once",async()=>{
 const {complete}=require("../model-continue");let calls=0;
 const out=await complete(async msgs=>{calls++;return calls===1?{content:"",finish:"length"}:{content:'{"ok":true}',finish:"stop"}},[{role:"user",content:"x"}],{max:2});
 assert.equal(calls,2);assert.equal(out.content,'{"ok":true}');
});
test("agentic Build path and fail-closed model selection are wired",()=>{
 const api=fs.readFileSync(path.join(__dirname,"..","create-api.js"),"utf8");
 assert.match(api,/executionMode=require\('\.\/build-routing'\)\.executionMode/);
 assert.match(api,/mode==='agent'\|\|executionMode==='agent'/);
 assert.match(api,/will not silently switch models/);
});
test("agent writes are checkpointed before final save",()=>{
 const src=fs.readFileSync(path.join(__dirname,"..","react-agent.js"),"utf8");
 assert.match(src,/agent-checkpoint/);
 assert.match(src,/checkpointStore\.save/);
 assert.match(src,/Resumed saved build progress/);
});
