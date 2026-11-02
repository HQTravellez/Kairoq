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

test("home greeting or question opens a new chat in Discuss, never a build or the last project",()=>{
 // Changed on purpose (Nov 2): "helo" on the home page started a build, and "hi" reopened the last
 // project. A greeting or a question now opens a new chat in Discuss; build requests still build.
 const ui=fs.readFileSync(path.join(__dirname,"..","public","create.js"),"utf8");
 const greeting=ui.slice(ui.indexOf("const talk=homeTalk(typed);"),ui.indexOf("$('home-error').classList.remove('welcome');"));
 assert.match(greeting,/setChatMode\('discuss'\)/);
 assert.doesNotMatch(greeting,/state\.projects\[0\]/);
 assert.match(ui,/await askThenBuild\(prompt\)/,"a build request still goes to the builder");
});

test("paid model pinning does not disable intent routing or pending-answer execution",()=>{
 const api=fs.readFileSync(path.join(__dirname,"..","create-api.js"),"utf8");
 assert.match(api,/mode==='discuss'&&routing\.explicitExecution\(ownerText\)\)mode='build'/);
 assert.match(api,/if\(!concurrentDiscuss&&!hooks&&\(mode==='build'\|\|mode==='discuss'\)\)/);
 assert.match(api,/if\(mode==='build'&&!routing\.explicitExecution\(ownerText\)/);
 assert.doesNotMatch(api,/!concurrentDiscuss&&!pinnedModel&&!hooks&&\(mode==='build'\|\|mode==='discuss'\)/);
});


test("social acknowledgements never enter code generation with a pinned paid model",()=>{
 const api=fs.readFileSync(path.join(__dirname,"..","create-api.js"),"utf8");
 assert.match(api,/const S=require\('\.\/builder-smalltalk'\),kind=S\.smallTalk\(message\)/);
 assert.match(api,/if\(kind\)\{[\s\S]*mode='discuss'/);
 const S=require("../builder-smalltalk");
 for(const text of ["great work.","thanks","awesome","nice","perfect","love it","looks good","wow"]){
  assert.ok(S.smallTalk(text),text+" should be classified as social chat");
 }
 for(const text of ["great work, now add login","nice, fix the mobile menu","perfect, build the next page"]){
  assert.equal(S.smallTalk(text),null,text+" contains an execution request and must not be social-only");
 }
});
