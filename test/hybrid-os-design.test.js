"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");

function read(name){return fs.readFileSync(path.join(__dirname,"..",name),"utf8")}

test("main shell loads hybrid OS as the final visual layer",()=>{
 const html=read("public/index.html");
 const ui=html.indexOf("/kairoq-ui.css");
 const hybrid=html.indexOf("/hybrid-os.css");
 assert.ok(ui>=0);
 assert.ok(hybrid>ui,"hybrid OS must load after existing visual layers");
});

test("shell mode switch exposes Space OS and Operator Console",()=>{
 const js=read("public/app.js");
 assert.match(js,/simpleMode \? "Operator" : "Space OS"/);
 assert.match(js,/Switch to Operator Console/);
 assert.match(js,/Switch to Space OS/);
});

test("hybrid stylesheet separates default and operator identities",()=>{
 const css=read("public/hybrid-os.css");
 assert.match(css,/body\.simple-mode/);
 assert.match(css,/Space OS/);
 assert.match(css,/body\.advanced-mode/);
 assert.match(css,/Operator Console/);
 assert.match(css,/prefers-reduced-motion/);
 assert.doesNotMatch(css,/animation:\s*[^;]*infinite/i);
});

test("redesign blueprint keeps factual product states and progressive rollout",()=>{
 const doc=read("docs/design/KAIROQ-HYBRID-OS.md");
 assert.match(doc,/Do not claim model\/tool\/deploy states that are not observed/);
 assert.match(doc,/Slice 1 — shared shell/);
 assert.match(doc,/Slice 6 — visual QA/);
 assert.match(doc,/Space OS/);
 assert.match(doc,/Operator Console/);
});
