"use strict";
// Sidebar like Lovable: New, Search ⌘K, Projects, Connectors; your five most recent projects with
// "See all projects"; and everything else (Settings, Help, the tools, Sign out) in a small menu on
// your name at the bottom. Every tool keeps its button and handler.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=f=>fs.readFileSync(path.join(__dirname,"../public",f),"utf8");
const html=read("create.html"),side=html.slice(html.indexOf('<aside class="side'),html.indexOf('</aside>')),js=read("create.js");
test("four main links, then recent projects, then the account menu",()=>{
 const main=side.slice(side.indexOf('<nav class="side-nav" aria-label="Workspace">'),side.indexOf('</nav>'));
 assert.deepEqual([...main.matchAll(/<button type="button" id="(side-[a-z]+)"(?! class="hidden")/g)].map(m=>m[1]),["side-new","side-search","side-projects","side-connectors"]);
 assert.match(main,/id="side-templates" class="hidden"/,"Templates stays reachable from Home and Search, not the sidebar");
 const acct=side.slice(side.indexOf('id="side-account"'),side.indexOf('</details>',side.indexOf('id="side-account"')));
 for(const id of ["side-settings","side-docs","side-chat","side-memory","side-web","side-leads","side-ideas","side-agents","side-plugins","side-api","side-check","side-admin","logout"])assert.match(acct,new RegExp('id="'+id+'"'),id+" is in the account menu");
 assert.ok(side.indexOf('id="recents"')<side.indexOf('id="side-account"'));
 assert.match(js,/for\(const p of projects\.slice\(0,5\)\)/);
 assert.match(js,/b=el\('button',null,'See all projects'\)/);
});
test("Search ⌘K finds projects, pages and tools and runs the same buttons",()=>{
 assert.match(html,/<dialog class="ks-search" id="search-dlg"/);
 assert.match(js,/\(e\.metaKey\|\|e\.ctrlKey\)&&!e\.shiftKey&&!e\.altKey&&e\.key\.toLowerCase\(\)==='k'/);
 assert.match(js,/\$\('side-search'\)\.onclick=openSearch;/);
 assert.match(js,/else if\(e\.key==='Escape'\)\{e\.preventDefault\(\);\$\('search-dlg'\)\.close\(\)\}/,"Esc closes even with text typed");
 assert.match(js,/run:\(\)=>b\.click\(\)/,"a tool result clicks the tool's own button");
 assert.match(js,/'Nothing matches "'/);
});
