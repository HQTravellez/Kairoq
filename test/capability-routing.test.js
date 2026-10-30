"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const registry=require("../capability-registry");
const cases=JSON.parse(fs.readFileSync(path.join(__dirname,"..","data","capability-routing-evals.json"),"utf8")).cases;

test("capability routing eval cases select required capabilities",()=>{
 for(const c of cases){
  const ids=registry.recommendCapabilities(c.prompt,12).map(x=>x.id);
  for(const id of c.must||[])assert.ok(ids.includes(id),c.id+" should include "+id+"; got "+ids.join(", "));
  for(const id of c.mustNot||[])assert.ok(!ids.includes(id),c.id+" should not include "+id+"; got "+ids.join(", "));
 }
});

test("recommended capabilities expose prerequisites, evidence and fallback",()=>{
 const rows=registry.recommendCapabilities("Inspect Swagger docs and test the API endpoint",12);
 const api=rows.find(x=>x.id==="api_execution");
 assert.ok(api);
 assert.ok(api.requires.includes("api_docs"));
 assert.ok(api.evidence.some(x=>/observed response/i.test(x)));
 assert.match(api.fallback,/unverified/i);
 assert.equal(api.risk,"high");
});

test("task context is concise, task-specific and honest about status",()=>{
 const text=registry.taskContext("Fix the broken dashboard UI and verify it in the browser");
 assert.match(text,/KAIROQ CAPABILITY ROUTER/);
 assert.match(text,/app_builder/);
 assert.match(text,/test_repair/);
 assert.match(text,/evidence:/);
 assert.doesNotMatch(text,/api_execution/);
});

test("inventory remains available independently of routing",()=>{
 const all=registry.listCapabilities();
 assert.ok(all.length>=20);
 assert.ok(all.every(x=>typeof x.status==="string"&&Array.isArray(x.evidence)&&Array.isArray(x.requires)));
});
