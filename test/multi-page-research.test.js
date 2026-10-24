"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {researchPages}=require("../multi-page-research");
const {protocol}=require("../react-agent");
test("multi-page research rejects empty and excessive URL batches",async()=>{
 await assert.rejects(researchPages([]),/Provide 1-6/);
 await assert.rejects(researchPages(Array(7).fill("https://example.com")),/Provide 1-6/);
});
test("agent advertises guarded multipage browser capability",()=>{
 const p=protocol({vision:false,web:true,maxSteps:12,images:false});
 assert.match(p,/"tool":"research_pages"/);
 assert.match(p,/public HTTPS documentation pages/);
 assert.match(p,/"tool":"build_and_test"/);
 assert.match(p,/"tool":"test_ui"/);
});
