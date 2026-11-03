"use strict";
// Sidebar like Lovable: New, Projects, Templates, Connectors; then your five most recent projects
// (first letter on a tile) and "See all projects"; then Tools folded at the bottom with Settings
// and Help. Every tool keeps its button and handler, just inside the Tools group.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=f=>fs.readFileSync(path.join(__dirname,"../public",f),"utf8");
test("the sidebar has four main links, recent projects, then Tools, Settings and Help",()=>{
 const html=read("create.html"),side=html.slice(html.indexOf('<aside class="side'),html.indexOf('</aside>'));
 const main=side.slice(side.indexOf('<nav class="side-nav" aria-label="Workspace">'),side.indexOf('</nav>'));
 assert.deepEqual([...main.matchAll(/id="(side-[a-z]+)"/g)].map(m=>m[1]),["side-new","side-projects","side-templates","side-connectors"]);
 const tools=side.slice(side.indexOf('id="side-more"'),side.indexOf('</details>'));
 for(const id of ["side-chat","side-memory","side-web","side-leads","side-ideas","side-agents","side-plugins","side-api","side-check","side-admin"])assert.match(tools,new RegExp('id="'+id+'"'),id+" is under Tools");
 assert.ok(side.indexOf('id="recents"')<side.indexOf('id="side-more"'),"projects come before Tools");
 assert.match(side,/<nav class="side-nav side-bottom"[^>]*>\s*<button type="button" id="side-settings"[\s\S]*?id="side-docs"/);
});
test("recent projects: five with a letter tile, then See all projects",()=>{
 const js=read("create.js");
 assert.match(js,/for\(const p of projects\.slice\(0,5\)\)/);
 assert.match(js,/el\('i','r-tile',/);
 assert.match(js,/if\(projects\.length>5\)\{const li=el\('li','see-all'\),b=el\('button',null,'See all projects'\);b\.type='button';b\.onclick=\(\)=>\$\('side-projects'\)\.click\(\)/);
 assert.match(read("ui/forma.css"),/html body\.app #side\{overflow-y:auto!important/,"the sidebar scrolls when Tools is open on a small screen");
});
