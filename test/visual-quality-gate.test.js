"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const gate=require("../visual-quality-gate");

test("visual quality is required for changed UI files",()=>{
 assert.equal(gate.required({base:{"src/App.jsx":"a"},current:{"src/App.jsx":"b"},request:"Fix auth"}),true);
 assert.equal(gate.required({base:{"src/lib/math.js":"a"},current:{"src/lib/math.js":"b"},request:"Fix calculation"}),false);
 assert.equal(gate.required({base:{},current:{},request:"Redesign the dashboard"}),true);
});

test("measured major AI-design tells block completion",async()=>{
 const result=await gate.evaluate({
  url:"http://preview",
  request:"Build a clean SaaS dashboard",
  meta:{name:"Demo",messages:[{role:"user",text:"No fake metrics"}]},
  designShots:async()=>[{name:"desktop",issues:[{severity:"major",kind:"card-grids",issue:"Two rows of identical cards",fix:"Use a stronger composition."}],stats:[]}],
 });
 assert.equal(result.passed,false);
 assert.match(result.reason,/major issue/);
 assert.match(gate.failureText(result),/Two rows of identical cards/);
});

test("clean measured screenshots pass, and design-director blockers remain blocking",async()=>{
 const base={
  url:"http://preview",request:"Build a clean product page",meta:{name:"Demo"},
  designShots:async()=>[{name:"desktop",issues:[],stats:[]},{name:"mobile",issues:[],stats:[]}]
 };
 const clean=await gate.evaluate(base);
 assert.equal(clean.passed,true);
 assert.equal(clean.screenshots,2);
 const blocked=await gate.evaluate({...base,reviewLook:async()=>({ok:false,problems:["Hero hierarchy still feels generic."]})});
 assert.equal(blocked.passed,false);
 assert.match(gate.failureText(blocked),/Hero hierarchy still feels generic/);
});
