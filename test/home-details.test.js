"use strict";
// Home details: Plugins has its own icon, and the project search lines up with the tabs and sort.
// (The tools now live in the account menu; see calm-sidebar.test.js.)
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=f=>fs.readFileSync(path.join(__dirname,"../public",f),"utf8");
test("sidebar: Plugins has its own icon",()=>{
 const html=read("create.html");
 const icon=id=>(new RegExp('id="'+id+'"[^>]*><svg[^>]*>(.*?)</svg>').exec(html)||[])[1];
 assert.ok(icon("side-plugins")&&icon("side-connectors"));
 assert.notEqual(icon("side-plugins"),icon("side-connectors"));
});
test("project search sits on the same line as the tabs and sort",()=>{
 assert.match(read("ui/forma.css"),/@media \(min-width:901px\)\{html body\.app #home \.pj-search\{margin:0!important;align-self:center!important\}\}/);
});
