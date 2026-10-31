"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {protocol,parseStep}=require("../react-agent");
const {findCapabilities}=require("../capability-registry");
test("agent advertises capability discovery and API document inspection",()=>{
 const prompt=protocol({vision:false,web:true,maxSteps:10,images:false,figmaAccess:true});
 assert.match(prompt,/"tool":"list_capabilities"/);
 assert.match(prompt,/"tool":"inspect_github_repo"/);
 assert.match(prompt,/"tool":"inspect_figma"/);
 assert.match(prompt,/"tool":"inspect_api_docs"/);
 assert.match(prompt,/GitHub repository and API-source inspection/);
 assert.match(prompt,/Connected Figma design inspection and frame import/);
 assert.match(prompt,/Browser research and website interaction/);
 assert.match(prompt,/disabled-by-default/);
});
test("agent understands capability discovery tool commands",()=>{
 const step=parseStep(JSON.stringify({actions:[{tool:"list_capabilities",query:"browser"},{tool:"inspect_github_repo",url:"https://github.com/example/api"},{tool:"inspect_figma",url:"https://www.figma.com/design/AbC1234567890/Product?node-id=12-34"},{tool:"inspect_api_docs",url:"https://docs.example.com/openapi.json"}]}));
 assert.equal(step.actions[0].tool,"list_capabilities");
 assert.equal(step.actions[1].tool,"inspect_github_repo");
 assert.equal(step.actions[2].tool,"inspect_figma");
 assert.equal(step.actions[3].tool,"inspect_api_docs");
});
test("inventory keeps disabled integrations visible but not executable",()=>{
 const mem0=findCapabilities("mem0");
 assert.equal(mem0[0].status,"disabled-by-default");
 assert.equal(mem0[0].tools.length,0);
});

test("GitHub repository URLs route to repository intelligence",()=>{
 const rows=require("../capability-registry").recommendCapabilities("Review https://github.com/acme/payments-api and integrate its API",12);
 const ids=rows.map(x=>x.id);
 assert.ok(ids.includes("github_repository"),ids.join(", "));
 assert.ok(ids.includes("browser"),ids.join(", "));
});

test("Figma URLs route to the connected design capability",()=>{
 const rows=require("../capability-registry").recommendCapabilities("Build https://www.figma.com/design/AbC1234567890/Product?node-id=12-34",12);
 const figma=rows.find(x=>x.id==="figma_design");
 assert.ok(figma,rows.map(x=>x.id).join(", "));
 assert.ok(figma.tools.includes("inspect_figma"));
 assert.ok(rows.some(x=>x.id==="design_skills"));
});

test("Figma inspection is not advertised to non-owner Agent sessions",()=>{
 const prompt=protocol({vision:false,web:true,maxSteps:10,images:false,figmaAccess:false});
 assert.doesNotMatch(prompt,/"tool":"inspect_figma"/);
});
