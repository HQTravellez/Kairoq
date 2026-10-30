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


test("verification runner executes current project logic and reports pass/fail",()=>{
 const runner=require("../project-test-runner");
 const passFiles={
  "src/lib/physics.js":"export function projectileRange(v,theta,g){const r=theta*Math.PI/180;return v*v*Math.sin(2*r)/g}\n",
  "src/verification/physics.test.js":"import { projectileRange } from '../lib/physics.js';\nconst got=projectileRange(20,45,9.81);\nif(Math.abs(got-40.7747196738)>0.01)throw Error('range '+got);\n"
 };
 const ok=runner.run(passFiles,{timeoutMs:3000});
 assert.equal(ok.ok,true,ok.output);
 const failFiles={...passFiles,"src/verification/physics.test.js":"import { projectileRange } from '../lib/physics.js';\nconst got=projectileRange(20,45,9.81);\nif(Math.abs(got-42)>0.01)throw Error('expected 42, got '+got);\n"};
 const bad=runner.run(failFiles,{timeoutMs:3000});
 assert.equal(bad.ok,false);
 assert.ok(bad.failed>=1);
});

test("verification runner rejects network, process and external imports",()=>{
 const runner=require("../project-test-runner");
 const bad=runner.run({"src/verification/unsafe.test.js":"const x=process.env.SECRET; if(!x) throw Error('x');\n"});
 assert.equal(bad.ok,false);
 assert.match(bad.output,/forbidden capability/);
});

test("completion gate requires executable tests for numerical work",()=>{
 const gate=require("../engineering-completion-gate");
 const base={built:{},dirty:false,inspect:()=>{},lastTest:{errors:[],failed:0,steps:2},checks:null,requirements:[{id:"numerical_accuracy"}],files:{"src/verification/math.test.js":"if(1+1!==2)throw Error('bad')"}};
 const missing=gate.evaluate(base);
 assert.equal(missing.verified,false);
 assert.match(missing.issues.join(" "),/verification tests were not executed/i);
 const passed=gate.evaluate({...base,unitTests:{ok:true,skipped:false,ran:1,passed:1,failed:0}});
 assert.equal(passed.verified,true);
 assert.equal(passed.evidence.unit_tests,"passed");
});

test("agent finish cannot bypass incomplete verification",()=>{
 const src=fs.readFileSync(path.join(__dirname,"..","react-agent.js"),"utf8");
 assert.match(src,/Calling finish again cannot bypass this gate/);
 assert.match(src,/finish cannot bypass verification/);
 assert.doesNotMatch(src,/call finish again to save an explicitly UNVERIFIED draft/);
 assert.match(src,/project-test-runner/);
 assert.match(src,/tool":"run_tests"/);
});
