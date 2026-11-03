"use strict";
// Home details: rarely used tools sit under "More tools" (opened when one of them is the current
// page), Plugins has its own icon, and the project search lines up with the tabs and sort.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=f=>fs.readFileSync(path.join(__dirname,"../public",f),"utf8");
test("sidebar: More tools group, distinct Plugins icon",()=>{
 const html=read("create.html"),more=html.slice(html.indexOf('id="side-more"'),html.indexOf('</details>',html.indexOf('id="side-more"')));
 for(const id of ["side-plugins","side-api","side-check","side-admin"])assert.match(more,new RegExp('id="'+id+'"'));
 assert.doesNotMatch(more,/id="side-docs"/,"Help stays visible");
 assert.match(read("create.js"),/if\(document\.querySelector\('#side-more \[aria-current\]'\)\)\$\('side-more'\)\.open=true;/);
 const icon=id=>(new RegExp('id="'+id+'"><svg[^>]*>(.*?)</svg>').exec(html)||[])[1];
 assert.notEqual(icon("side-plugins"),icon("side-connectors"));
});
test("project search sits on the same line as the tabs and sort",()=>{
 assert.match(read("ui/forma.css"),/@media \(min-width:901px\)\{html body\.app #home \.pj-search\{margin:0!important;align-self:center!important\}\}/);
});
