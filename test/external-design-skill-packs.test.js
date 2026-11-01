"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const D=require("../external-design-skill-packs");

test("design skill menu is task matched",()=>{
 const names=D.list("redesign this generic dashboard and polish the responsive UI").map(x=>x.name);
 assert(names.includes("hallmark:redesign"));
 assert(names.includes("impeccable:polish"));
 assert(!D.list("calculate compound interest").length);
});

test("design skill source revisions are pinned",()=>{
 assert.match(D.SOURCES.hallmark.rev,/^[0-9a-f]{40}$/);
 assert.match(D.SOURCES.impeccable.rev,/^[0-9a-f]{40}$/);
 assert.equal(D.SOURCES.hallmark.license,"MIT");
 assert.equal(D.SOURCES.impeccable.license,"Apache-2.0");
});

test("open loads main and targeted reference and strips tool authority",async()=>{
 D.clear();
 const calls=[];
 const fetchImpl=async url=>{
  calls.push(url);
  return {ok:true,text:async()=>url.includes("SKILL")?"---\nname: demo\ntools: shell\n---\nDesign rules.":"Polish rules."};
 };
 const out=await D.open("impeccable:polish",{fetchImpl});
 assert.match(out,/EXTERNAL DESIGN SKILL/);
 assert.match(out,/Design rules/);
 assert.match(out,/Polish rules/);
 assert.doesNotMatch(out,/tools: shell/);
 assert.equal(calls.length,2);
});
