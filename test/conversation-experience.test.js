"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");

test("conversation stylesheet is loaded after the workspace styles",()=>{
 const html=read("public/create.html");
 const split=html.indexOf("/builder-split-preview.css");
 const bubbles=html.indexOf("/conversation-bubbles.css");
 assert.ok(split>=0&&bubbles>split);
});

test("assistant replies render inside a dedicated message bubble",()=>{
 const js=read("public/create.js");
 assert.match(js,/reply\.classList\.add\('message-bubble'\)/);
 assert.match(js,/What would you like Kairoq to get done\?/);
 assert.match(js,/m\.question\.options\.slice\(0,3\)/);
 assert.match(js,/m\.ideas\.slice\(0,3\)/);
});

test("bubble styling keeps the conversation lightweight and numbered",()=>{
 const css=read("public/conversation-bubbles.css");
 assert.match(css,/\.messages \.user/);
 assert.match(css,/\.message-bubble/);
 assert.match(css,/counter-reset:quick-reply/);
 assert.match(css,/content:counter\(quick-reply\)/);
 assert.match(css,/border-radius:20px 20px 20px 6px/);
});

test("Discuss mode recommends no more than three next ideas",()=>{
 const js=read("react-builder.js");
 assert.match(js,/give up to 3 strong ideas/);
 assert.match(js,/slice\(0,3\)\.map/);
 assert.doesNotMatch(js,/give 3 to 5 ideas/);
});
