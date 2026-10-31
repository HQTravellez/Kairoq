"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const routing=require("../browser-chat-routing"),web=require("../web");

test("bare domains are normalized and treated as browser requests",()=>{
 assert.equal(routing.reference("check travellez.com"),"https://travellez.com/");
 assert.equal(routing.directIntent("check travellez.com"),true);
 assert.equal(routing.route("travellez.com",[]).execute,true);
 assert.equal(web.needsWeb("check travellez.com"),true);
});

test("short follow-up keeps the previous website instead of losing browser context",()=>{
 const history=[
  {role:"user",text:"you can check travellez.com"},
  {role:"assistant",text:"I opened travellez.com and checked Pricing."}
 ];
 const r=routing.route("check again and tell me whats going on",history);
 assert.equal(r.execute,true);
 assert.equal(r.reference,"https://travellez.com/");
 assert.match(r.message,/Browser continuity:/);
 assert.match(r.message,/https:\/\/travellez\.com\//);
});

test("browser capability answers come from Kairoq runtime, not model persona",()=>{
 assert.equal(routing.capabilityQuestion("Can you browse live websites?"),true);
 const yes=routing.capabilityAnswer({browser:true,search:true});
 assert.match(yes,/Kairoq can search the public web/i);
 assert.match(yes,/open and interact with public websites/i);
 assert.doesNotMatch(yes,/cannot browse|can't browse/i);
 const down=routing.capabilityAnswer({browser:false,search:false});
 assert.match(down,/runtime tools are not available/i);
});

test("generic model browser denials are blocked",()=>{
 const bad="I cannot browse live websites or check travellez.com directly. I can only work with content you paste.";
 assert.equal(routing.falseCapabilityDenial(bad),true);
 assert.equal(routing.falseCapabilityDenial("I don't have web browsing capabilities."),true);
 const fixed=routing.guardDiscussAnswer("check travellez.com",bad,{browser:true,search:true});
 assert.notEqual(fixed,bad);
 assert.match(fixed,/Kairoq can/i);
 assert.doesNotMatch(fixed,/I cannot browse/i);
});

test("website checks route to the read-only agent before Discuss",()=>{
 const src=fs.readFileSync(path.join(__dirname,"..","create-api.js"),"utf8");
 assert.match(src,/browserChat\.route\(ownerText/);
 assert.match(src,/browserResearchOnly/);
 assert.match(src,/researchOnly=browserResearchOnly/);
 assert.match(src,/initialBrowserUrl:researchOnly\?browserDecision\.reference/);
 assert.match(src,/executionMode='agent'/);
 const agentAt=src.indexOf("else if(mode==='agent'||executionMode==='agent')");
 const discussAt=src.indexOf("else if(mode==='discuss')",agentAt);
 assert.ok(agentAt>=0&&discussAt>agentAt,"agent execution must be evaluated before generic Discuss");
 assert.match(src,/p\.browser\?\{browser:p\.browser\}/);
});

test("research-only agent cannot mutate the project and publishes browser state",()=>{
 const src=fs.readFileSync(path.join(__dirname,"..","react-agent.js"),"utf8");
 assert.match(src,/researchOnly=false/);
 assert.match(src,/RESEARCH-ONLY TASK/);
 assert.match(src,/research-only browser task; project mutation\/runtime app tools are disabled/);
 assert.match(src,/async function publishBrowser/);
 assert.match(src,/researchOnly&&initialBrowserUrl&&wb\.available\(\)/);
 assert.match(src,/Opened .* before model reasoning/);
 assert.match(src,/screenshot=await wb\.screenshot/);
 assert.match(src,/report\(\{status:'researching',browser\}\)/);
 assert.match(src,/const storedMode=researchOnly\?'discuss':'agent'/);
});
