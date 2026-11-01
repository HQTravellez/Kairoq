"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const T=require("../teardown-skill-pack");

test("teardown skill routes only for mechanism simulator work",()=>{
 assert(T.list("Build an interactive 3D teardown of a V8 engine with exploded view").some(x=>x.name==="3d:teardown-simulator"));
 assert.equal(T.list("make me a CRM dashboard").length,0);
});

test("teardown source is pinned and licensed",()=>{
 assert.equal(T.REPO,"elvarofficial/teardown");
 assert.match(T.REV,/^[0-9a-f]{40}$/);
 assert.equal(T.LICENSE,"MIT");
});

test("teardown loader strips frontmatter and retains safe guidance",async()=>{
 T.clear();
 const out=await T.open("3d:teardown-simulator",{fetchImpl:async()=>({ok:true,text:async()=> "---\nname: teardown\ntools: shell\n---\nUse one input to drive all mechanism state."})});
 assert.match(out,/SPECIALIST 3D TEARDOWN SKILL/);
 assert.match(out,/one input to drive all mechanism state/i);
 assert.doesNotMatch(out,/tools: shell/);
 assert.match(out,/Do not run npm/);
});
