"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const discipline=require("../execution-discipline"),ledger=require("../execution-ledger"),hermes=require("../hermes-superpowers");

test("execution discipline chooses bug, refactor and feature workflows",()=>{
 assert.equal(discipline.classify("Fix the broken splitter regression"),"bug");
 assert.equal(discipline.classify("Refactor the auth architecture"),"refactor");
 assert.equal(discipline.classify("Build a booking dashboard"),"feature");
 const bug=discipline.prompt("Fix this failing login bug");
 assert.match(bug,/red-capable reproduction/i);
 assert.match(bug,/root cause/i);
 assert.match(bug,/three failed repair hypotheses/i);
 const feature=discipline.prompt("Build a booking dashboard");
 assert.match(feature,/vertical slices/i);
 assert.match(feature,/browser/i);
 assert.match(feature,/fresh executor evidence/i);
});

test("execution ledger survives a model/provider handoff and resumes evidence",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"kq-ledger-"));
 try{
  const instruction="Fix the booking regression",id="000000000000";
  const workflow=discipline.workflow(instruction);
  ledger.start(id,{instruction,baseVersion:7,workflow,root});
  ledger.record(id,instruction,{step:1,tool:"project_graph",status:"ok",result:"auth -> booking"},{root});
  ledger.record(id,instruction,{step:2,tool:"run_tests",status:"failed",result:"1 failing"},{root});
  const resumed=ledger.current(id,instruction,{root});
  assert.equal(resumed.status,"active");
  assert.equal(resumed.events.length,2);
  assert.match(ledger.summary(resumed),/project_graph: ok/);
  assert.match(ledger.summary(resumed),/run_tests: failed/);
  const done=ledger.complete(id,instruction,{verified:true,version:8,message:"verified",root});
  assert.equal(done.status,"complete");
  assert.equal(done.version,8);
  assert.equal(ledger.current(id,instruction,{root}),null);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test("Hermes receives Superpowers bootstrap without mutating visible history",()=>{
 const messages=[{role:"user",content:"Debug this failing API integration"}];
 const out=hermes.inject(messages);
 assert.equal(messages.length,1);
 assert.equal(out[0].role,"system");
 assert.match(out[0].content,/Superpowers engineering skill library/);
 assert.match(out[0].content,/systematic-debugging/);
 assert.match(out[0].content,/verification-before-completion/);
 assert.equal(out.at(-1).content,messages[0].content);
});

test("builder wires persistent ledger into every agent execution",()=>{
 const src=fs.readFileSync(path.join(__dirname,"..","react-agent.js"),"utf8");
 assert.match(src,/executionLedger\.start/);
 assert.match(src,/executionLedger\.record/);
 assert.match(src,/executionLedger\.complete/);
 assert.match(src,/discipline\.prompt\(text\)/);
 const chat=fs.readFileSync(path.join(__dirname,"..","hermes-chat.js"),"utf8");
 assert.match(chat,/hermes-superpowers/);
});

test("Capability OS exposes execution discipline with evidence contract",()=>{
 const rows=require("../capability-registry").recommendCapabilities("Fix this broken regression and verify it",12);
 const c=rows.find(x=>x.id==="execution_discipline");
 assert.ok(c);
 assert.equal(c.status,"wired");
 assert.ok(c.evidence.some(x=>/execution ledger/i.test(x)));
 assert.ok(c.evidence.some(x=>/verification/i.test(x)));
});
