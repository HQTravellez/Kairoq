"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const api=require("../api-chat-routing");

test("API capability questions get a truthful Kairoq-owned answer",()=>{
 for(const q of ["Can you work with any API?","Can Kairoq read API docs?","What can you do with APIs?"]){
  assert.equal(api.capabilityQuestion(q),true,q);
  const a=api.capabilityAnswer();
  assert.match(a,/inspect public API documentation from a URL/i);
  assert.match(a,/allowlisted/i);
  assert.match(a,/explicitly approve/i);
  assert.doesNotMatch(a,/can't browse|cannot browse/i);
 }
});

test("API documentation URLs route to the tool-using path",()=>{
 for(const q of [
  "Check this API documentation https://example.com/openapi.json",
  "Can you inspect this Swagger API https://example.com/docs",
  "Integrate this API https://example.com/openapi.json"
 ])assert.equal(api.docsResearchRequest(q),true,q);
 assert.equal(api.docsResearchRequest("Can you work with any API?"),false);
});

test("generic model capability denials are replaced",()=>{
 const bad="I can't browse the live web or fetch API documentation. Only if you paste the docs can I help.";
 const fixed=api.guardDiscussAnswer("Can you work with APIs?",bad);
 assert.notEqual(fixed,bad);
 assert.match(fixed,/documentation from a URL/i);
});

test("create API promotes docs research to agent and bypasses model for capability questions",()=>{
 const src=fs.readFileSync(path.join(__dirname,"..","create-api.js"),"utf8");
 assert.match(src,/apiChat\.capabilityQuestion\(ownerText\)/);
 assert.match(src,/apiChat\.docsResearchRequest\(ownerText\)/);
 assert.match(src,/mode='agent'/);
 const builder=fs.readFileSync(path.join(__dirname,"..","react-builder.js"),"utf8");
 assert.match(builder,/guardDiscussAnswer\(text,answer\)/);
});
