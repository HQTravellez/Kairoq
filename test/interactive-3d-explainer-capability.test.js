"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const registry=require("../capability-registry");

test("plain-English mechanism requests select Interactive 3D Explainer",()=>{
 const rows=registry.recommendCapabilities("Show me how a turbocharger works as an interactive 3D cutaway",12);
 const ids=rows.map(x=>x.id);
 assert(ids.includes("interactive_3d_explainer"));
 const cap=rows.find(x=>x.id==="interactive_3d_explainer");
 assert(cap.requires.includes("app_builder"));
 assert(cap.requires.includes("design_skills"));
 assert(cap.requires.includes("test_repair"));
 assert(cap.evidence.some(x=>/3d:teardown-simulator/i.test(x)));
});

test("ordinary app requests do not select Interactive 3D Explainer",()=>{
 const ids=registry.recommendCapabilities("Build a CRM for my small agency",12).map(x=>x.id);
 assert(!ids.includes("interactive_3d_explainer"));
});

test("home exposes a product-level Interactive 3D Explainer starting point",()=>{
 const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
 assert.match(html,/Interactive 3D explainer/);
 assert.match(html,/Machines, mechanisms, cutaways/);
 assert.doesNotMatch(html,/elvarofficial\/teardown/);
});
