"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const H=require("../model-switch-handoff");

const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");

test("model switch package carries topic, latest corrections and runtime capabilities",()=>{
  const prepared=H.prepare({
    fromModel:"openai/gpt-6",
    toModel:"anthropic/claude-sonnet-5.5",
    project:"Client Portal",
    messages:[
      {role:"user",content:"Build the client portal and keep the booking flow simple"},
      {role:"assistant",content:"I will keep the booking flow simple."},
      {role:"user",content:"Use a dark theme"},
      {role:"assistant",content:"Okay."},
      {role:"user",content:"No, keep it light and simple instead"},
      {role:"assistant",content:"I will keep it light."},
      {role:"user",content:"Do not ask me about 3D again"}
    ],
    current:"continue",
    capabilities:[
      "Conversation continuity, Kairoq personality and settled-decision enforcement",
      "Public website reading and API documentation research"
    ]
  });
  assert.equal(prepared.ready,true);
  assert.equal(prepared.handoff.from_model,"openai/gpt-6");
  assert.equal(prepared.handoff.to_model,"anthropic/claude-sonnet-5.5");
  assert.equal(prepared.handoff.project,"Client Portal");
  assert.match(prepared.handoff.current_topic,/Do not ask me about 3D again|light and simple/i);
  assert.ok(prepared.handoff.recent_decisions.some(x=>/light and simple/i.test(x)));
  assert.ok(prepared.handoff.recent_decisions.some(x=>/3D again/i.test(x)));
  assert.ok(prepared.handoff.capabilities.some(x=>/API documentation/i.test(x)));
  assert.equal(prepared.checklist.kairoq_capabilities,true);
  assert.equal(prepared.checklist.personality_and_behavior,true);
});

test("multimodal chat content keeps its text during handoff",()=>{
  const prepared=H.prepare({
    fromModel:"openrouter/free",
    toModel:"google/gemini-2.5-pro",
    messages:[
      {role:"user",content:[{type:"text",text:"Use the first screenshot and make that one simpler"},{type:"image_url",image_url:{url:"data:image/png;base64,abc"}}]},
      {role:"assistant",content:"I will simplify the first screenshot."}
    ],
    capabilities:["Conversation continuity"]
  });
  assert.equal(prepared.ready,true);
  assert.match(prepared.handoff.current_topic,/first screenshot/i);
});

test("incoming model is explicitly subordinate to Kairoq continuity and capabilities",()=>{
  const n=H.note({
    fromModel:"a/model",
    toModel:"b/model",
    messages:[{role:"user",content:"Continue the same booking app"}],
    capabilities:["Browser use","API docs"]
  });
  assert.match(n,/incoming model must follow it/i);
  assert.match(n,/Kairoq runtime capabilities are authoritative/i);
  assert.match(n,/Do not reintroduce yourself/i);
  assert.match(n,/Model changes\. Kairoq does not\./i);
});

test("main chat server prepares and injects the verified handoff",()=>{
  const server=read("server.js");
  assert.match(server,/function runtimeConversationCapabilities\(/);
  assert.match(server,/async function handleModelSwitchHandoff\(/);
  assert.match(server,/POST" && url === "\/api\/chat\/model-handoff"/);
  assert.match(server,/conversationSystem=require\("\.\/conversation-handoff"\)\.note/);
  assert.match(server,/body\.modelSwitch&&body\.modelSwitch\.confirmed===true/);
  assert.match(server,/handoffModule\.note\(/);
});

test("model picker warns before switching an existing conversation and only commits after sync",()=>{
  const app=read("public/app.js");
  assert.match(app,/async function requestModelSwitch\(/);
  assert.match(app,/Switch & sync context/);
  assert.match(app,/Continue with /);
  assert.match(app,/up to about 30 seconds on slower models/);
  assert.match(app,/fetch\("\/api\/chat\/model-handoff"/);
  assert.match(app,/if\(!response\.ok\|\|!data\.ready\)throw/);
  assert.match(app,/pendingModelSwitch=\{confirmed:true,fromModel:from,toModel:target/);
  const send=app.slice(app.indexOf("async function send(regenerateFrom=null)"),app.indexOf("async function regenerate",app.indexOf("async function send(regenerateFrom=null)")));
  assert.match(send,/modelSwitch:pendingModelSwitch/);
  assert.match(send,/currentProject/);
});

test("failed sync keeps the previous model selected",()=>{
  const app=read("public/app.js");
  const fn=app.slice(app.indexOf("async function requestModelSwitch"),app.indexOf("// ---- Model picker",app.indexOf("async function requestModelSwitch")));
  assert.match(fn,/modelSelect\.value=from;updateModelUI\(\)/);
  assert.match(fn,/error\.textContent=err\.message/);
});

test("preset and Free Only model changes cannot bypass the switch handoff",()=>{
  const app=read("public/app.js");
  assert.match(app,/async function applyPreset\(/);
  assert.match(app,/modelChanged=await requestModelSwitch\(p\.model/);
  assert.match(app,/freeOnlyEl\.onchange=async\(\)=>/);
  assert.match(app,/await requestModelSwitch\("openrouter\/free","Auto \(free\)"\)/);
});

test("handoff capability inventory includes native Figma and Telegram when available",()=>{
  const server=read("server.js");
  assert.match(server,/Native Figma connection and Figma design evidence import/);
  assert.match(server,/Telegram channel connected to the same Kairoq project\/job engine/);
});


test("preset and Free Only model changes cannot bypass the handoff",()=>{
  const app=read("public/app.js");
  assert.match(app,/async function applyPreset\(/);
  assert.match(app,/modelChanged=await requestModelSwitch\(p\.model,pickerLabel\(p\.model\)\)/);
  assert.match(app,/freeOnlyEl\.onchange=async\(\)=>/);
  assert.match(app,/await requestModelSwitch\("openrouter\/free","Auto \(free\)"\)/);
});
