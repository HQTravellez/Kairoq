"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const response=require("../agent-response-contract");
const {protocol}=require("../react-agent");

test("response prompt makes runtime capability and executor proof authoritative",()=>{
 const p=response.prompt();
 assert.match(p,/Speak as Kairoq, the product/);
 assert.match(p,/Runtime\/tool state is authoritative/);
 assert.match(p,/PROOF\/UNVERIFIED block is authoritative/);
 assert.match(p,/Do not expose internal framework names/);
});

test("generic model capability denial is corrected when Kairoq has a runtime path",()=>{
 const answer=response.guard(
  "Can you browse and inspect this website?",
  "I can't browse websites or access the internet."
 );
 assert.doesNotMatch(answer,/I can't browse/i);
 assert.match(answer,/Kairoq has a runtime path/);
 assert.match(answer,/Browser research and website interaction/);
});

test("real unsupported statements are left alone when no relevant runtime capability exists",()=>{
 const input="I can't teleport a physical package.";
 assert.equal(response.guard("Can you teleport this box?",input),input);
});

test("internal framework names are hidden unless technical internals were requested",()=>{
 const hidden=response.guard("Build this feature","Hermes and Mem0 helped with the task.");
 assert.doesNotMatch(hidden,/Hermes|Mem0/i);
 assert.match(hidden,/Kairoq's internal tooling/);
 const technical=response.guard("Explain the internal agent architecture","Hermes and Mem0 helped with the task.",{technical:true});
 assert.match(technical,/Hermes and Mem0/);
});

test("technical-request detector preserves requested implementation detail",()=>{
 assert.equal(response.technicalRequest("How does the sub-agent architecture work?"),true);
 assert.equal(response.technicalRequest("Make the booking button blue"),false);
});

test("Agent Mode protocol embeds the same Kairoq response contract",()=>{
 const p=protocol({vision:false,web:true,maxSteps:8,images:false});
 assert.match(p,/KAIROQ RESPONSE CONTRACT/);
 assert.match(p,/Speak as Kairoq, the product/);
});
