"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");

test("signed-in start screen is one natural-language prompt",()=>{
 const html=read("public/create.html");
 assert.match(html,/What should Kairoq get done\?/);
 assert.match(html,/Describe the outcome in your own words/);
 assert.doesNotMatch(html,/id="new-kind"/);
 assert.doesNotMatch(html,/>Website<\/button>\s*<button[^>]*>Web app/);
});

test("first build has no mandatory look, 3D, or plan approval wizard",()=>{
 const js=read("public/create.js");
 const start=js.indexOf("async function askThenBuild(prompt)");
 const end=js.indexOf("// A first request with the owner's answers",start);
 assert.ok(start>=0&&end>start);
 const flow=js.slice(start,end);
 assert.match(flow,/Understanding what you want/);
 assert.match(flow,/questions\[0\]/);
 assert.match(flow,/Build anyway/);
 assert.doesNotMatch(flow,/KairoqLook/);
 assert.doesNotMatch(flow,/three_d/);
 assert.doesNotMatch(flow,/\/projects\/.*\/look/);
 assert.doesNotMatch(flow,/\/projects\/.*\/plan/);
 assert.doesNotMatch(flow,/showBuildPlan/);
 assert.doesNotMatch(flow,/Decide for me/);
});

test("home examples teach natural outcomes instead of product-type selection",()=>{
 const js=read("public/create.js");
 assert.match(js,/Build a CRM for my sales team/);
 assert.match(js,/Connect Stripe checkout and verify the payment journey/);
 assert.match(js,/Make this GitHub repo production ready/);
 assert.match(js,/const home=\{kind:'auto'/);
 assert.doesNotMatch(js,/const home=\{kind:'site'/);
});
