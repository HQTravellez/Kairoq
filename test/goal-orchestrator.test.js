"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const goal=require("../goal-orchestrator");

test("goal orchestrator forms the smallest relevant team",()=>{
 const api=goal.teamFor("Integrate Stripe API with OAuth and verify checkout");
 assert.ok(api.includes("api"));
 assert.ok(api.includes("security"));
 assert.ok(api.includes("qa"));
 assert.ok(api.length<=3);

 const ui=goal.teamFor("Redesign the customer dashboard and mobile flow");
 assert.ok(ui.includes("design"));
 assert.ok(ui.length<=3);
});

test("goal state follows understand plan execute verify ready",()=>{
 let s=goal.create("Build a booking workflow");
 assert.equal(s.phase,"understand");
 s=goal.next(s,{type:"understood",evidence:"scope inspected"});
 assert.equal(s.phase,"plan");
 s=goal.next(s,{type:"planned"});
 assert.equal(s.phase,"execute");
 s=goal.next(s,{type:"implemented"});
 assert.equal(s.phase,"verify");
 s=goal.next(s,{type:"verified",ok:true,evidence:"browser and tests passed"});
 assert.equal(s.phase,"ready");
 assert.equal(goal.summary(s).ready,true);
});

test("failed verification enters repair and must reverify",()=>{
 let s=goal.create("Fix checkout");
 s=goal.next(s,{type:"understood"});
 s=goal.next(s,{type:"planned"});
 s=goal.next(s,{type:"implemented"});
 s=goal.next(s,{type:"verified",ok:false,evidence:"browser checkout failed"});
 assert.equal(s.phase,"repair");
 assert.equal(s.repairRounds,1);
 s=goal.next(s,{type:"repaired"});
 assert.equal(s.phase,"verify");
 s=goal.next(s,{type:"verified",ok:true});
 assert.equal(s.phase,"ready");
});

test("blocked state records the concrete blocker and next action",()=>{
 let s=goal.create("Connect a private supplier API");
 s=goal.next(s,{type:"blocked",reason:"OAuth credentials are not configured",action:"Connect the supplier OAuth account"});
 assert.equal(s.phase,"blocked");
 assert.match(s.blockers[0].reason,/OAuth credentials/);
 assert.match(s.blockers[0].action,/Connect/);
});

test("invalid phase transitions are rejected",()=>{
 const s=goal.create("Build an app");
 assert.throws(()=>goal.next(s,{type:"implemented"}),/Invalid orchestration transition/);
});

test("specialist question is phase-aware and uses selected team",()=>{
 const s=goal.create("Integrate an API into a dashboard");
 const q=goal.specialistQuestion(s);
 assert.deepEqual(q.roles,s.team);
 assert.match(q.question,/Current phase: understand/);
});
