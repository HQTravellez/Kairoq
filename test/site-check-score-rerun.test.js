"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const check=require("../site-check");
const root=path.join(__dirname,"..");
test("PlanURstay-style 4 agent errors and one abandonment is inconclusive, not 26/100",()=>{
 const technical=[...Array.from({length:7},(_,i)=>({ok:i<6}))];
 assert.equal(check.score({visitors:5,completed:0,blocked:0,errors:4,inconclusive:true,completion_rate:0},technical),null);
 assert.equal(check.score({visitors:5,completed:0,blocked:5,inconclusive:true,completion_rate:0},technical),null);
});
test("reliable completed journeys preserve a 0-100 score",()=>{
 assert.equal(check.score({visitors:5,completed:5,inconclusive:false,completion_rate:100},[{ok:true}]),100);
 assert.equal(check.score({visitors:5,completed:0,inconclusive:false,completion_rate:0},[{ok:false}]),0);
});
test("website check supports explicit fresh rerun without disabling rate limits",()=>{
 const service=fs.readFileSync(path.join(root,"site-check.js"),"utf8");
 const router=fs.readFileSync(path.join(root,"create-api.js"),"utf8");
 const client=fs.readFileSync(path.join(root,"public/create.js"),"utf8");
 assert.match(service,/if\(same&&!opts\.force\)/);
 assert.match(service,/if\(!opts\.owner\)/);
 assert.match(router,/force:b\.force===true/);
 assert.match(client,/force:true/);
 assert.match(client,/inconclusive\?'—':sc/);
});
