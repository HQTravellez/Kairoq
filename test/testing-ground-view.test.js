"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("Testing Ground is a first-class Kairoq navigation item",()=>{
  const html=read("public/index.html");
  assert.match(html,/id="testingGroundNavBtn"/);
  assert.match(html,/>Testing Ground</);
  assert.match(html,/class="kn-new-badge">NEW</);
});

test("Testing Ground is an internal Kairoq view backed by the live launch lab",()=>{
  const html=read("public/index.html");
  assert.match(html,/id="testingGroundView"/);
  assert.match(html,/id="testingGroundFrame"/);
  assert.match(html,/modeldrop-production-d2a9\.up\.railway\.app\/\?embed=1/);
  assert.doesNotMatch(html,/id="testingGroundNavBtn"[^>]*href=/);
});

test("view router loads Testing Ground lazily and keeps Kairoq shell active",()=>{
  const js=read("public/app.js");
  assert.match(js,/\["chat","command","studio","build","plugins","testing"\]/);
  assert.match(js,/mainView === "testing" \? "Testing Ground"/);
  assert.match(js,/function loadTestingGround\(\)/);
  assert.match(js,/testingGroundNavBtn/);
  assert.match(js,/setMainView\("testing"\)/);
});

test("Testing Ground owns the main canvas without the chat composer",()=>{
  const css=read("public/kairoq-ui.css");
  assert.match(css,/\.main\[data-view="testing"\]>\.composer-shell/);
  assert.match(css,/\.testing-ground-view/);
  assert.match(css,/\.testing-ground-shell iframe/);
});
