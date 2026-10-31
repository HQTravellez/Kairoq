"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("home shell has project tabs and central builder modes",()=>{
  const html=read("public/index.html");
  for(const id of ["workspaceHomeTab","workspaceProjectTabs","workspaceNewTab","khComposerSlot"]){
    assert.match(html,new RegExp('id="'+id+'"'),id+" must exist");
  }
  assert.match(html,/data-mode="ask"/);
  assert.match(html,/data-mode="web"/);
  assert.match(html,/data-mode="mobile"/);
  assert.match(html,/data-mode="video"/);
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

test("top project tabs come from live Kairoq projects without changing memory context",()=>{
  const js=read("public/app.js");
  assert.match(js,/function renderWorkspaceProjectTabs\(projects\)/);
  assert.match(js,/renderWorkspaceProjectTabs\(projects\)/);
  assert.match(js,/let activeBuilderProjectId=""/);
  assert.doesNotMatch(js,/if\(pid\)currentProject=pid/);
});

test("new shell visual contract exists and Testing Ground remains intact",()=>{
  const html=read("public/index.html");
  const css=read("public/home.css");
  assert.match(css,/Emergent-inspired Kairoq shell/);
  assert.match(css,/\.workspace-tabs/);
  assert.match(css,/\.kh-composer-slot #prompt/);
  assert.match(css,/\.main\[data-view=build\] \.build-view iframe/);
  assert.match(html,/id="testingGroundNavBtn"/);
  assert.match(html,/id="testingGroundView"/);
});
