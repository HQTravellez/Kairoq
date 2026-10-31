"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const agent=require("../react-agent");

test("agent recovery budget defaults to four bounded repair steps",()=>{
 const old=process.env.KAIROQ_AGENT_RECOVERY_STEPS;
 delete process.env.KAIROQ_AGENT_RECOVERY_STEPS;
 try{assert.equal(agent.recoveryStepsDefault(),4)}
 finally{if(old===undefined)delete process.env.KAIROQ_AGENT_RECOVERY_STEPS;else process.env.KAIROQ_AGENT_RECOVERY_STEPS=old}
});

test("agent recovery budget is bounded between zero and eight",()=>{
 const old=process.env.KAIROQ_AGENT_RECOVERY_STEPS;
 try{
  process.env.KAIROQ_AGENT_RECOVERY_STEPS="99";assert.equal(agent.recoveryStepsDefault(),8);
  process.env.KAIROQ_AGENT_RECOVERY_STEPS="-4";assert.equal(agent.recoveryStepsDefault(),0);
  process.env.KAIROQ_AGENT_RECOVERY_STEPS="2";assert.equal(agent.recoveryStepsDefault(),2);
 }finally{if(old===undefined)delete process.env.KAIROQ_AGENT_RECOVERY_STEPS;else process.env.KAIROQ_AGENT_RECOVERY_STEPS=old}
});
