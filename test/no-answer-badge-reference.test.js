"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const app=fs.readFileSync(path.join(__dirname,"../public/app.js"),"utf8");
test("removed answer badges leave no dangling function calls in chat, image or video workflows",()=>{
 assert.doesNotMatch(app,/\baddAnswerBadge\s*\(/);
 assert.match(app,/function addAnswerActions\(/);
});
