"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("Home exposes only supported primary modes",()=>{
  const html=read("public/index.html");
  assert.match(html,/data-mode="ask"/);
  assert.match(html,/data-mode="web"/);
  assert.match(html,/data-mode="mobile"/);
  assert.doesNotMatch(html,/data-mode="video"/);
});

test("Home mode tabs use the list selector helper",()=>{
  const js=read("public/app.js");
  assert.ok(js.includes('$$(".kh-mode").forEach(t=>t.onclick'),"mode tabs must bind with $$()");
  assert.doesNotMatch(js,/\$\("\.kh-mode"\)\.forEach/);
});

test("project tabs remain visible on Home and Build despite legacy topbar rules",()=>{
  const css=read("public/home.css");
  assert.match(css,/\.main\[data-view=command\] \.topbar > \.workspace-tabs/);
  assert.match(css,/\.main\[data-view=build\] \.topbar > \.workspace-tabs/);
  assert.match(css,/visibility:visible!important/);
});

test("Home uses a real background image with fallbacks",()=>{
  const css=read("public/home.css");
  assert.match(css,/images\.pexels\.com\/photos\/20884933/);
  assert.match(css,/linear-gradient\(180deg/);
  assert.match(css,/background-position:center top/);
});

test("Testing Ground and project tabs remain present",()=>{
  const html=read("public/index.html");
  assert.match(html,/id="testingGroundNavBtn"/);
  assert.match(html,/id="workspaceProjectTabs"/);
});
