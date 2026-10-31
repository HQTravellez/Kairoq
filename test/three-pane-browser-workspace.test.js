"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("three-pane browser workspace shell is present",()=>{
  const html=read("public/index.html");
  for(const id of [
    "workspaceBrowserBtn","browserWorkspace","browserAddress","browserLiveImage",
    "browserPreviewFrame","browserSelectionBar","browserAddToChatBtn","workspaceInspectBtn"
  ]) assert.match(html,new RegExp('id="'+id+'"'),id+" must exist");
});

test("browser workspace routes live frames and supports add-to-chat references",()=>{
  const js=read("public/app.js");
  for(const symbol of [
    "updateWorkspaceBrowserVisibility","updateBrowserLiveFrame","openWorkspaceAddress",
    "installPreviewInspector","addBrowserSelectionToChat","annotatedBrowserFrame"
  ]) assert.match(js,new RegExp("function\\s+"+symbol+"\\b"),symbol+" must exist");
  assert.match(js,/if\(updateBrowserLiveFrame\(data\)\)return;/);
  assert.ok(js.includes('$("[data-browser-mode]").forEach'),"browser mode tabs must use list selector");
  assert.match(js,/attachments\.push\(\{kind:"image",name:"browser-selection\.jpg"/);
});

test("browser agent streams current URL with screenshots",()=>{
  const js=read("chat-browser.js");
  assert.match(js,/const currentUrl = typeof session\.url === "function" \? session\.url\(\) : target;/);
  assert.match(js,/onFrame\(\{ image, caption, step, url: currentUrl \}\)/);
});

test("workspace layout has responsive right pane",()=>{
  const css=read("public/kairoq-ui.css");
  assert.match(css,/\.main\[data-view="chat"\]\.workspace-browser-open/);
  assert.match(css,/\.browser-workspace\{/);
  assert.match(css,/\.browser-selection-bar\{/);
  assert.match(css,/@media\(max-width:1180px\)/);
});
