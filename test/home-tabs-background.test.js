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
  assert.doesNotMatch(js,/(^|[^$])\$\("\.kh-mode"\)\.forEach/m);
});

test("project tabs remain visible on Home and Build despite legacy topbar rules",()=>{
  const css=read("public/home.css");
  assert.match(css,/\.main\[data-view=command\] \.topbar > \.workspace-tabs/);
  assert.match(css,/\.main\[data-view=build\] \.topbar > \.workspace-tabs/);
  assert.match(css,/visibility:visible!important/);
});

test("Home uses an original local graphic with a gradient fallback",()=>{
  const css=read("public/redesign.css");
  assert.match(css,/assets\/kairoq-horizon\.svg/);
  assert.match(css,/radial-gradient/);
  assert.doesNotMatch(read("public/home.css"),/images\.pexels\.com/);
});

test("Testing Ground and project tabs remain present",()=>{
  const html=read("public/index.html");
  assert.match(html,/id="testingGroundNavBtn"/);
  assert.match(html,/id="workspaceProjectTabs"/);
});
