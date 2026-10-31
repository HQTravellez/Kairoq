"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const routing=require("../build-routing"),goal=require("../goal-orchestrator"),caps=require("../capability-registry");
const cases=JSON.parse(fs.readFileSync(path.join(__dirname,"..","benchmarks","goal-completion-cases.json"),"utf8")).cases;
const meta={current_version:3,versions:[{n:3,summary:"Working app"}]};

test("goal-completion benchmark routes each case to the expected execution path",()=>{
 for(const c of cases){
  assert.equal(routing.executionMode({requestedMode:"build",meta,message:c.goal}),c.route,c.id);
 }
});

test("goal-completion benchmark selects required specialists",()=>{
 for(const c of cases.filter(x=>x.route==="agent"&&x.roles)){
  const team=goal.teamFor(c.goal);
  for(const role of c.roles)assert.ok(team.includes(role),c.id+" should include "+role+"; got "+team.join(", "));
  assert.ok(team.length<=3,c.id+" exceeded 3 specialists");
 }
});

test("goal-completion benchmark exposes required runtime capabilities",()=>{
 for(const c of cases){
  const ids=caps.recommendCapabilities(c.goal,14).map(x=>x.id);
  for(const id of c.mustCapabilities||[])assert.ok(ids.includes(id),c.id+" should include "+id+"; got "+ids.join(", "));
 }
});

test("Ready is impossible before execute and verify complete",()=>{
 for(const c of cases.filter(x=>x.route==="agent")){
  let s=goal.create(c.goal);
  assert.equal(s.phase,"understand");
  assert.throws(()=>goal.next(s,{type:"verified",ok:true}),/Invalid orchestration transition/);
  s=goal.next(s,{type:"understood"});
  s=goal.next(s,{type:"planned"});
  s=goal.next(s,{type:"implemented"});
  assert.equal(s.phase,"verify");
  s=goal.next(s,{type:"verified",ok:true,evidence:"executor completion gate passed"});
  assert.equal(s.phase,"ready");
 }
});

test("failed verification cannot skip Repair",()=>{
 let s=goal.create("Fix booking and prove it works");
 s=goal.next(s,{type:"understood"});
 s=goal.next(s,{type:"planned"});
 s=goal.next(s,{type:"implemented"});
 s=goal.next(s,{type:"verified",ok:false,evidence:"browser flow failed"});
 assert.equal(s.phase,"repair");
 assert.throws(()=>goal.next(s,{type:"verified",ok:true}),/Invalid orchestration transition/);
 s=goal.next(s,{type:"repaired"});
 assert.equal(s.phase,"verify");
});
