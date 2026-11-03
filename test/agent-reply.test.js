"use strict";
// Kairoq Agent writes its own closing message from the facts, and the draft is checked against
// them: a draft that claims more than the evidence shows is rewritten once, then replaced by a
// plain factual line. Uses the Pulse failure (nothing built) and a draft with a failed look check.
const test=require("node:test"),assert=require("node:assert/strict");
delete process.env.KAIROQ_AGENT_REPLY;
const reply=require("../agent-reply");

const draftVerification={verified:false,issues:["Visual quality review did not pass: the hero image is missing on phones."],
 evidence:{build:"passed",browser:"passed",browser_interactions:6,visual_quality:"failed",unit_tests:"not-required",saved_checks:"not-required",engineering_review:"passed",repairs:1}};
const draft=reply.facts({request:"A product page for Pulse",outcome:"draft",changed:["src/App.jsx","src/pages/Home.jsx"],pages:["home"],verification:draftVerification,steps:9,summary:"Built the Pulse page."});
const pulse=reply.facts({request:"A product page for Pulse",outcome:"not_built",notBuilt:{unreadable:3,writers_failed:true,steps:8},steps:8,charged:false});

function scripted(...answers){const seen=[];const fn=async(o,parse)=>{seen.push(o.messages);return parse(answers.shift()??"")};fn.seen=seen;return fn}

test("the model's message is used when it sticks to the facts",async()=>{
 const good="Your Pulse home page is in place and I clicked through it in a browser: 6 actions, no errors. The look check still fails: the hero image is missing on phones. Want me to fix that next?";
 const callModel=scripted(good);
 const r=await reply.write({callModel,facts:draft});
 assert.equal(r.source,"model");assert.equal(r.text,good);
 const sent=JSON.stringify(callModel.seen[0]);
 assert.match(sent,/hero image is missing on phones/,"the real problem text is in the facts");
 assert.doesNotMatch(sent,/thought/i,"no private reasoning is passed in");
});

test("a draft that claims success is rewritten, then replaced by a factual line",async()=>{
 const callModel=scripted("All checks passed — everything works perfectly!","Fully tested and verified. Ready to publish.");
 const r=await reply.write({callModel,facts:draft});
 assert.equal(callModel.seen.length,2,"one rewrite");
 assert.match(JSON.stringify(callModel.seen[1].at(-1)),/does not match the facts/);
 assert.equal(r.source,"factual");
 assert.match(r.text,/^This is a draft: not every check passed\./);
 assert.match(r.text,/hero image is missing on phones/);
});

test("nothing built: the message has to say so, and the fallback is the plain line",async()=>{
 assert.deepEqual(reply.check("I didn't get to build Pulse: my replies were too large to read, three times. Nothing was saved and you weren't charged. Try again and I'll write it in smaller pieces.",pulse),[]);
 assert.ok(reply.check("Here's your Pulse page, it is ready!",pulse).length,"claiming it was built is rejected");
 const r=await reply.write({callModel:scripted("Here's your Pulse page!","Your page is ready."),facts:pulse});
 assert.equal(r.text,"I didn't get to build this. The page is still the starter: my replies came back too large to read 3 times, after the first all-at-once write also failed. Nothing was saved and you were not charged.");
});

test("internal labels, agent JSON and long replies are rejected; a model error falls back",async()=>{
 assert.ok(reply.check("UNVERIFIED DRAFT. Builder notes: ok",draft).length);
 assert.ok(reply.check('{"thought":"x","actions":[]}',draft).length);
 assert.ok(reply.check("word ".repeat(400),draft).length);
 const r=await reply.write({callModel:async()=>{throw Error("model down")},facts:draft});
 assert.equal(r.source,"factual");
});
