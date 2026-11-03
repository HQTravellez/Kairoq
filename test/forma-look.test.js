"use strict";
// Kairoq in Ka's Figma design: the stylesheet loads last, the Home box holds the Web app /
// Phone app / Website switch, the first build shows the app being put together, and the
// browser pane folds away when idle.
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "public", f), "utf8");

test("the Figma look loads after every other stylesheet", () => {
  const html = read("create.html");
  const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+\.css)[^"]*">/g)].map(m => m[1]);
  assert.equal(links.at(-1), "/ui/forma.css", "forma.css is the last stylesheet");
  assert.match(html, /family=Inter:wght@[^"]*family=IBM\+Plex\+Mono/);
  const css = read("ui/forma.css");
  assert.match(css, /--c-accent:#7552E8/);
  assert.match(css, /--f-chrome:#242329/);
  assert.match(css, /prefers-reduced-motion:reduce/, "motion can be turned off");
});

test("the Home box holds the switch, with an icon on each choice", () => {
  const html = read("create.html");
  const box = html.slice(html.indexOf('<div class="wow">'), html.indexOf('<div class="examples" id="examples">'));
  assert.match(box, /<div class="wow-ring">\s*<form id="new-form" class="prompt-box">/);
  assert.match(box, /id="new-kind"/, "the switch is inside the box");
  assert.equal((box.match(/<svg class="cute"/g) || []).length, 3, "Web app, Phone app and Website each have an icon");
  assert.match(box, /id="kind-hint"/);
  const js = read("create.js");
  assert.match(js, /text\(\$\('kind-hint'\),\{site:/);
});

test("the first build shows the app being put together until a version can be previewed", () => {
  const js = read("create.js");
  assert.match(js, /function previewWait\(id,title,sub,spin\)/);
  assert.match(js, /if\(state\.firstBuild&&!shown\)buildWaiting\(label\)/);
  assert.match(js, /planWaiting\(false\);state\.firstBuild=true;/);
  assert.match(read("ui/forma.css"), /\.pw-b\.hero/);
});

test("project cards sit in a colour frame and the browser pane folds when idle", () => {
  const js = read("create.js");
  assert.match(js, /thumb\.style\.setProperty\('--frame',FRAMES\[/);
  const pane = read("builder-browser-pane.js");
  assert.match(pane, /foldTimer=setTimeout\(fold,3500\)/);
  assert.match(pane, /if\(byHand\|\|Date\.now\(\)-lastUserAt<15000/, "never folds while you are using it");
  assert.match(pane, /reopen\.onclick=\(\)=>\{byHand=true;open\(\)\}/);
});

test("on a phone the top is one dark band and the browser stays open while watched", () => {
  const css = read("ui/forma.css");
  assert.match(css, /\.phone-panes\{background:var\(--f-chrome\)!important/);
  assert.match(css, /\.phone-panes button\[aria-selected=true\]\{background:#fff!important/);
  assert.match(read("builder-browser-pane.js"), /editor\.dataset\.pane==="browser"\)return;/);
});
