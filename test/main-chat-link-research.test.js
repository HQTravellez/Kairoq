"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../server.js"),"utf8");

test("main chat reads direct website links before plain model fallback",()=>{
 assert.match(source,/const siteUrlFromMessage=require\("\.\/chat-url"\)\.extractWebsite\(lastUserText\)/);
 assert.match(source,/await readPublicWebsiteForChat\(siteUrl\)/);
 const readAt=source.indexOf("await readPublicWebsiteForChat(siteUrl)");
 const fallbackAt=source.indexOf("// A model picked by name in the picker",readAt);
 assert.ok(readAt>=0&&fallbackAt>readAt,"website evidence is gathered before plain selected-model fallback");
});

test("main website reader follows canonical redirects internally",()=>{
 const fn=source.slice(source.indexOf("async function readPublicWebsiteForChat"),source.indexOf("async function searchPublicWeb"));
 assert.match(fn,/public-web-fetch/);
 assert.match(fn,/maxRedirects:5/);
 assert.match(fn,/const pageUrl=fetched\.url/);
 assert.match(fn,/redirects:fetched\.redirects/);
 assert.doesNotMatch(fn,/Website redirected\. Please send its final HTTPS URL/);
 assert.doesNotMatch(source,/Please send its final HTTPS URL/);
});

test("main chat capability truth is resolved before model personalities",()=>{
 const apiCapability=source.indexOf('apiCapabilities.capabilityQuestion(capabilityText)');
 const browserCapability=source.indexOf('browserCapabilities.capabilityQuestion(capabilityText)');
 const hermes=source.indexOf('const hermes=require("./hermes-chat")');
 assert.ok(apiCapability>=0&&browserCapability>apiCapability&&hermes>browserCapability);
 assert.match(source,/apiCapabilities\.capabilityAnswer\(\)/);
 assert.match(source,/model:"kairoq\/capability-runtime"/);
 assert.match(source,/browser:require\("\.\/runtime-check"\)\.available\(\),search:true/);
});

test("browser failures disclose the concrete website error instead of pretending the model lacks tools",()=>{
 assert.match(source,/This is a website access error, not a limitation of the text model/);
});

test("interactive browser accepts only validated canonical redirect origins",()=>{
 const runtime=fs.readFileSync(path.join(__dirname,"../runtime-check.js"),"utf8");
 const guard=runtime.slice(runtime.indexOf("async function guardSite"),runtime.indexOf("// What a browsing agent sees",runtime.indexOf("async function guardSite")));
 assert.match(guard,/req\.redirectedFrom\(\)/);
 assert.match(guard,/await checkSite\(u\.href\)/);
 assert.match(guard,/origin=u\.origin/);
 assert.match(runtime,/const allowedOrigin=site\?new URL\(page\.url\(\)\)\.origin/);
});
