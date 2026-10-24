"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {protocol,parseStep}=require("../react-agent");
const {findCapabilities}=require("../capability-registry");
test("agent advertises capability discovery and API document inspection",()=>{
 const prompt=protocol({vision:false,web:true,maxSteps:10,images:false});
 assert.match(prompt,/"tool":"list_capabilities"/);
 assert.match(prompt,/"tool":"inspect_api_docs"/);
 assert.match(prompt,/Browser research and website interaction/);
 assert.match(prompt,/disabled-by-default/);
});
test("agent understands capability discovery tool commands",()=>{
 const step=parseStep(JSON.stringify({actions:[{tool:"list_capabilities",query:"browser"},{tool:"inspect_api_docs",url:"https://docs.example.com/openapi.json"}]}));
 assert.equal(step.actions[0].tool,"list_capabilities");
 assert.equal(step.actions[1].tool,"inspect_api_docs");
});
test("inventory keeps disabled integrations visible but not executable",()=>{
 const mem0=findCapabilities("mem0");
 assert.equal(mem0[0].status,"disabled-by-default");
 assert.equal(mem0[0].tools.length,0);
});
