"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const review=require("../repository-review-contract");

test("repository review contract requires the senior-engineer section order",()=>{
 const text=review.contract({repository:"acme/payments",hasApiDocs:true});
 const expected=[
  "What this repo does",
  "Architecture",
  "Important files",
  "APIs and contracts",
  "What we can reuse",
  "Conflicts or overlap with Kairoq",
  "Implementation plan",
  "Verification and unknowns"
 ];
 let last=-1;
 for(const heading of expected){
  const i=text.indexOf(heading);
  assert.ok(i>last,heading+" should be present in order");
  last=i;
 }
 assert.match(text,/Tie claims to inspected repository evidence/);
 assert.match(text,/check whether Kairoq already has equivalent capability/);
 assert.match(text,/prefer Kairoq-native adaptation/);
 assert.match(text,/not executed, not tested/);
});

test("repository review contract changes API guidance when no formal contract is found",()=>{
 assert.match(review.contract({hasApiDocs:false}),/No formal API contract was confirmed/);
 assert.match(review.contract({hasApiDocs:true}),/contains likely API documentation candidates/);
});

test("completion helper detects missing engineering sections",()=>{
 const full=review.SECTIONS.join("\n");
 assert.equal(review.complete(full),true);
 assert.equal(review.complete("What this repo does\nArchitecture"),false);
});
