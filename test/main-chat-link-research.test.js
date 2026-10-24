"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync(require("node:path").join(__dirname,"../server.js"),"utf8");
test("main chat opens API documentation links before plain model fallback",()=>{
 assert.match(source,/if\(websiteUrlMatch && \(lastUserText\.trim\(\)\.length<350/);
 assert.match(source,/about\|api\|docs\|documentation\|integrat\|build/);
 assert.match(source,/await readPublicWebsiteForChat\(siteUrl\)/);
});
test("browser failures are disclosed instead of inventing research",()=>{
 assert.match(source,/This is a website access error, not a limitation of the text model/);
});
