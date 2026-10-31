"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const H=require("../conversation-handoff");
const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");

function meta(messages){
 return{name:"Client Portal",messages,pending_question:null};
}

test("short follow-ups inherit the previous substantive topic",()=>{
 const m=meta([
  {role:"user",text:"Build a customer portal with booking and invoices",mode:"build"},
  {role:"assistant",text:"I’ll keep booking and invoices in the same portal."},
  {role:"user",text:"Use blue and white and keep it very clean",mode:"discuss"},
  {role:"assistant",text:"I’ll keep the design clean and use blue and white."}
 ]);
 const s=H.state(m,"do that");
 assert.equal(s.active_goal,"Build a customer portal with booking and invoices");
 assert.equal(s.current_topic,"Use blue and white and keep it very clean");
 assert.equal(s.latest_user_message,"do that");
});

test("an explicit new direction becomes the current topic without erasing the active goal",()=>{
 const m=meta([
  {role:"user",text:"Build a customer portal with booking and invoices",mode:"build"},
  {role:"assistant",text:"Working on the customer portal."}
 ]);
 const s=H.state(m,"Also add a mobile-friendly approval flow for managers");
 assert.equal(s.active_goal,"Build a customer portal with booking and invoices");
 assert.equal(s.current_topic,"Also add a mobile-friendly approval flow for managers");
});

test("newer user corrections remain visible to every model",()=>{
 const m=meta([
  {role:"user",text:"Use a dark theme",mode:"discuss"},
  {role:"assistant",text:"Okay."},
  {role:"user",text:"No, keep it light and simple instead",mode:"discuss"},
  {role:"assistant",text:"I’ll keep it light."},
  {role:"user",text:"Do not ask me about 3D again",mode:"discuss"}
 ]);
 const s=H.state(m,"continue");
 assert.deepEqual(s.recent_decisions,[
  "Use a dark theme",
  "No, keep it light and simple instead",
  "Do not ask me about 3D again"
 ]);
 const n=H.note(m,"continue");
 assert.match(n,/newest explicit user direction wins/);
 assert.match(n,/Do not ask me about 3D again/);
});

test("conversation handoff carries previous assistant context for ambiguous references",()=>{
 const m=meta([
  {role:"user",text:"Give me three ways to connect Figma",mode:"discuss"},
  {role:"assistant",text:"I recommend native OAuth first, then MCP later, and a token fallback only for legacy projects."}
 ]);
 const s=H.state(m,"what about the other one?");
 assert.equal(s.current_topic,"Give me three ways to connect Figma");
 assert.match(s.previous_assistant_context,/native OAuth first/);
});

test("greetings do not reset the active conversation",()=>{
 const m=meta([
  {role:"user",text:"Fix the checkout flow and verify the payment journey",mode:"build"},
  {role:"assistant",text:"I’m testing checkout now."},
  {role:"user",text:"hello",mode:"discuss"}
 ]);
 const s=H.state(m,"hi");
 assert.equal(s.active_goal,"Fix the checkout flow and verify the payment journey");
 assert.equal(s.current_topic,"Fix the checkout flow and verify the payment journey");
});

test("all model execution paths receive the same runtime-owned handoff",()=>{
 const builder=read("react-builder.js"),agent=read("react-agent.js");
 assert.match(builder,/DISCUSS_PROMPT[\s\S]{0,1200}conversationNote\(meta,text\)/);
 assert.match(builder,/SYSTEM_PROMPT[\s\S]{0,1400}conversationNote\(meta,text\)/);
 assert.match(builder,/oc\.rules\(SYSTEM_PROMPT,[\s\S]{0,900}conversationNote\(meta,text\)/);
 assert.match(agent,/builder\.conversationNote\(meta,text\)/);
});

test("handoff explicitly forbids personality/topic reset on model or mode changes",()=>{
 const n=H.note(meta([{role:"user",text:"Build a booking app",mode:"build"}]),"continue");
 assert.match(n,/model switch, mode switch/);
 assert.match(n,/never resets the thread/);
 assert.match(n,/Do not reintroduce yourself/);
 assert.match(n,/Do not ask again for a decision already made/);
});
