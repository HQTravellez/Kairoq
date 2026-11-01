"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const G=require("../gsap-skill-packs");

test("GSAP skills route only for motion work",()=>{
 const names=G.list("Build a React hero with smooth GSAP scroll animation and ScrollTrigger").map(x=>x.name);
 assert(names.includes("gsap:core"));
 assert(names.includes("gsap:react"));
 assert(names.includes("gsap:scrolltrigger"));
 assert(!G.list("calculate payroll totals").length);
});

test("GSAP source is pinned and official",()=>{
 assert.equal(G.REPO,"greensock/gsap-skills");
 assert.match(G.REV,/^[0-9a-f]{40}$/);
 assert.equal(G.LICENSE,"MIT");
});

test("GSAP skill loader strips frontmatter and safety scans",async()=>{
 G.clear();
 const out=await G.open("gsap:core",{fetchImpl:async()=>({ok:true,text:async()=> "---\nname: gsap-core\ntools: shell\n---\nUse transforms and opacity for smooth motion."})});
 assert.match(out,/OFFICIAL GSAP SKILL/);
 assert.match(out,/Use transforms and opacity/);
 assert.doesNotMatch(out,/tools: shell/);
});
