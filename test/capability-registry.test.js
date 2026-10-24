"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {listCapabilities,findCapabilities,agentCapabilityContext} = require("../capability-registry");
test("registry identifiers are unique, statuses disclosed and entries present",()=>{
 const all=listCapabilities(); assert.ok(all.length>=18);
 assert.equal(new Set(all.map(x=>x.id)).size,all.length);
 for(const cap of all){assert.ok(cap.status);assert.ok(cap.entry);assert.ok(Array.isArray(cap.tools));}
});
test("discover browser and API documentation with honest status",()=>{
 assert.ok(findCapabilities("browser").some(x=>x.id==="browser"));
 assert.ok(findCapabilities("OpenAPI documentation").some(x=>x.id==="api_docs"));
 assert.match(agentCapabilityContext(),/disabled-by-default/);
});
test("registry does not expose direct executable handler functions",()=>{
 assert.equal(typeof listCapabilities()[0].execute,"undefined");
});
