"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const team=require("../agent-team");
const {protocol,parseStep}=require("../react-agent");

test("normalizes to at most three known specialist roles",()=>{
 assert.deepEqual(team.normalizeRoles(["architect","qa","design","security"]),["architect","qa","design"]);
 assert.deepEqual(team.normalizeRoles(["unknown"]),["architect","product","qa"]);
});

test("specialists consult in parallel and remain advisory-only",async()=>{
 let active=0,maxActive=0,calls=[];
 const callModel=async(opts,parse)=>{
  active++;maxActive=Math.max(maxActive,active);
  const role=opts.messages[0].content.match(/Kairoq's ([^.]+) specialist/)?.[1]||"specialist";
  calls.push(role);
  await new Promise(r=>setTimeout(r,25));
  active--;
  return parse("FINDINGS: observed supplied snapshot only. RECOMMENDED ACTIONS: inspect before edit. VERIFICATION/UNKNOWNs: no tests ran.");
 };
 const result=await team.consult({
  callModel,request:"Add auth",files:{"src/App.jsx":"export default function App(){return null}"},
  roles:["architect","security","qa"],question:"Review the plan"
 });
 assert.equal(result.parallel,true);
 assert.equal(result.status,"advisory-only");
 assert.equal(result.results.length,3);
 assert.ok(maxActive>=2,"expected overlapping sub-agent calls");
 assert.match(result.warning,/did not call tools, edit files, run tests, or verify runtime behavior/i);
});

test("agent protocol advertises specialist consultation and keeps Lead Agent as writer",()=>{
 const prompt=protocol({vision:false,web:true,maxSteps:10,images:false});
 assert.match(prompt,/"tool":"consult_agents"/);
 assert.match(prompt,/architect, product, qa, security, api, design/);
 assert.match(prompt,/Only the Lead Agent writes files or claims verification/);
 const step=parseStep(JSON.stringify({actions:[{tool:"consult_agents",roles:["architect","product","qa"],question:"Review this"}]}));
 assert.equal(step.actions[0].tool,"consult_agents");
});
