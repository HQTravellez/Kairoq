"use strict";
// The Plugins page (Ka's Figma layout): a sidebar entry opens a full page with a breadcrumb,
// heading, a real "turned on" count, search, group tabs and skill cards whose switch uses the
// same account setting as the Design dialog. Nothing on it is made up.
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "public", f), "utf8");

test("the sidebar opens a full Plugins page in the Figma layout", () => {
  const html = read("create.html");
  assert.match(html, /<button type="button" id="side-plugins">[\s\S]*?Plugins<\/button>/);
  const page = html.slice(html.indexOf('id="plugins-screen"'), html.indexOf('id="editor"'));
  for (const id of ["pl-title", "pl-count", "pl-search", "pl-tabs", "pl-grid", "pl-add"]) assert.match(page, new RegExp('id="' + id + '"'));
  assert.match(page, /class="tp-crumbs"/);
  const links = [...html.matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m => m[1]);
  assert.ok(links.indexOf("/ui/tool-pages.css") > -1 && links.indexOf("/ui/tool-pages.css") < links.indexOf("/ui/forma.css"), "Forma stays last");
});

test("switches use the account skill setting and counts come from the real list", () => {
  const js = read("create.js");
  assert.match(js, /'plugins-screen'[^\]]*\]\)\$\(id\)\.classList\.toggle/);
  assert.match(js, /api\('\/skills\/default',\{method:'POST',body:\{id:sk\.id,on:next\}\}\)/);
  assert.match(js, /const on=plugins\.list\.filter\(s=>s\.always\)\.length;/);
  assert.match(js, /sw\.setAttribute\('role','switch'\)/);
  assert.match(js, /if\(plugins\.tab!=='All'&&!plugins\.list\.some/, "an emptied tab falls back to All");
});

test("the page has a phone layout and calms down with reduced motion", () => {
  const css = read("ui/tool-pages.css");
  assert.match(css, /@media \(max-width:900px\)\{[\s\S]*\.tp-grid\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /\.tp-sw\[aria-checked=true\]\{background:var\(--c-accent/);
});
