"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const routing=require("../conversation-routing");

test("explicit app-change commands execute from a conversational composer",()=>{
 for(const text of ["build it","Implement this plan.","please fix the login","Can you add a pricing page?","go ahead","finish it","redesign the dashboard"]){
  assert.equal(routing.explicitExecution(text),true,text);
 }
});

test("questions stay conversational even when they contain build/change words",()=>{
 for(const text of ["What should we build next?","Why did you change the header?","How does the login work?","Can you explain this build?","Should we fix this now?"]){
  assert.equal(routing.explicitExecution(text),false,text);
 }
});

test("short approvals can bind to the latest explicit proposal",()=>{
 for(const text of ["yes","ok","go ahead","do it","build it","Implement this plan."]){
  assert.equal(routing.proposalApproval(text),true,text);
 }
 assert.equal(routing.proposalApproval("build a CRM"),false);
});

test("home greeting returns to the normal build-capable composer",()=>{
 const ui=fs.readFileSync(path.join(__dirname,"..","public","create.js"),"utf8");
 const greeting=ui.slice(ui.indexOf("// Greetings are conversation openers"),ui.indexOf("// A card-sized app name"));
 assert.match(greeting,/setChatMode\('build'\)/);
 assert.doesNotMatch(greeting,/setChatMode\('discuss'\)/);
});

test("paid model pinning does not disable intent routing or pending-answer execution",()=>{
 const api=fs.readFileSync(path.join(__dirname,"..","create-api.js"),"utf8");
 assert.match(api,/mode==='discuss'&&routing\.explicitExecution\(ownerText\)\)mode='build'/);
 assert.match(api,/if\(!concurrentDiscuss&&!hooks&&\(mode==='build'\|\|mode==='discuss'\)\)/);
 assert.match(api,/if\(mode==='build'&&!routing\.explicitExecution\(ownerText\)/);
 assert.doesNotMatch(api,/!concurrentDiscuss&&!pinnedModel&&!hooks&&\(mode==='build'\|\|mode==='discuss'\)/);
});
