"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("home shell has project tabs and only supported builder modes",()=>{
  const html=read("public/index.html");
  for(const id of ["workspaceHomeTab","workspaceProjectTabs","workspaceNewTab","khComposerSlot"]){
    assert.match(html,new RegExp('id="'+id+'"'),id+" must exist");
  }
  for(const mode of ["ask","web","mobile"])assert.match(html,new RegExp('data-mode="'+mode+'"'));
  assert.doesNotMatch(html,/data-mode="video"/);
});

test("plus menu exposes the compact workflow controls",()=>{
  const html=read("public/index.html");
  assert.match(html,/data-plus="file">Upload file/);
  assert.match(html,/data-plus="github">Import from GitHub/);
  assert.match(html,/data-plus="model">Auto · select model/);
  assert.match(html,/data-plus="advanced">Advanced controls/);
});

test("home composer is moved into the hero only on Home",()=>{
  const js=read("public/app.js");
  assert.match(js,/if\(mainView==="command" && shell\.parentElement!==slot\) slot\.appendChild\(shell\)/);
  assert.match(js,/else if\(mainView!=="command" && shell\.parentElement!==main\) main\.appendChild\(shell\)/);
});

test("top and mode tabs use list selectors and preserve memory context",()=>{
  const js=read("public/app.js");
  assert.match(js,/function renderWorkspaceProjectTabs\(projects\)/);
  assert.ok(js.includes('$$(".project-tab").forEach'),"project tabs must use list selector");
  assert.ok(js.includes('$$(".kh-mode").forEach'),"home modes must use list selector");
  assert.ok(js.includes('$$("#plusMenu [data-plus]").forEach'),"plus menu must use list selector");
  assert.doesNotMatch(js,/mode==="video"/);
  assert.match(js,/let activeBuilderProjectId=""/);
  assert.match(js,/activeBuilderProjectId\|\|""/);
  assert.doesNotMatch(js,/if\(pid\)currentProject=pid/);
});

test("real sky and visible project tabs override legacy shell rules",()=>{
  const css=read("public/home.css");
  assert.match(css,/images\.pexels\.com\/photos\/20884933/);
  assert.match(css,/\.main\[data-view=command\] \.topbar > \.workspace-tabs/);
  assert.match(css,/visibility:visible!important/);
});

test("Testing Ground remains intact",()=>{
  const html=read("public/index.html");
  assert.match(html,/id="testingGroundNavBtn"/);
  assert.match(html,/id="testingGroundView"/);
});
