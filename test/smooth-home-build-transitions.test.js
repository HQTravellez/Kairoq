"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("Home preloads and reveals the sky background smoothly",()=>{
  const html=read("public/index.html");
  const css=read("public/home.css");
  const js=read("public/app.js");
  assert.match(html,/rel="preload" as="image"/);
  assert.match(html,/images\.pexels\.com\/photos\/20884933/);
  assert.match(js,/function preloadHomeSky\(\)/);
  assert.match(js,/home-sky-ready/);
  assert.match(css,/body\.home-sky-ready/);
});

test("composer moves between Home and docked views with FLIP motion",()=>{
  const js=read("public/app.js");
  assert.match(js,/function moveComposerSmooth\(shell,target\)/);
  assert.match(js,/getBoundingClientRect\(\)/);
  assert.match(js,/shell\.animate\(/);
  assert.match(js,/if\(mainView==="command"\)moveComposerSmooth\(shell,slot\)/);
  assert.match(js,/else moveComposerSmooth\(shell,main\)/);
});

test("project tabs hydrate with a lightweight transition",()=>{
  const js=read("public/app.js");
  const css=read("public/home.css");
  assert.match(js,/tabs-updating/);
  assert.match(js,/tabs-ready/);
  assert.match(css,/\.workspace-project-tabs\.tabs-updating/);
  assert.match(css,/@keyframes kq-tab-in/);
});

test("builder opens without clearing to about blank",()=>{
  const js=read("public/app.js");
  const css=read("public/home.css");
  assert.doesNotMatch(js,/frame\.src="about:blank"/);
  assert.match(js,/frame\.classList\.add\("frame-loading"\)/);
  assert.match(js,/frame\?\.classList\.remove\("frame-loading"\)/);
  assert.match(js,/const same=Boolean\(absolute&&frame\.src===absolute/);
  assert.match(css,/iframe\.frame-loading/);
  assert.match(css,/\.build-view\.loading iframe/);
  assert.match(css,/visibility:visible!important/);
  assert.match(css,/\.build-view \.build-loading/);
});

test("mode tabs remain bound as a collection",()=>{
  const js=read("public/app.js");
  assert.ok(js.includes('$$(".kh-mode").forEach(t=>t.onclick'),"Home modes must bind with $$()");
  assert.doesNotMatch(js,/(^|[^$])\$\("\.kh-mode"\)\.forEach/m);
});

test("motion respects reduced-motion users and preserves current product sections",()=>{
  const html=read("public/index.html");
  const css=read("public/home.css");
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(html,/id="testingGroundNavBtn"/);
  assert.match(html,/id="workspaceProjectTabs"/);
  assert.doesNotMatch(html,/data-mode="video"/);
});
