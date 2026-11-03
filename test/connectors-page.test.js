"use strict";
// Connectors page (Figma "Connectors" frame): the services one app uses, each with its real
// status from the project's settings; Connect opens the project and the right setting.
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "public", f), "utf8");

test("the sidebar opens a Connectors page in the Figma layout", () => {
  const html = read("create.html");
  assert.match(html, /id="side-templates">[\s\S]*?Templates<\/button>\n    <button type="button" id="side-connectors">/, "under Projects and Templates, like Figma");
  for (const id of ["cn-project", "cn-search", "cn-tabs", "cn-grid", "cn-count"]) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(html, /<h1 id="cn-title">Good tools\. Better together\.<\/h1>/);
});

test("status comes from the project's settings, never made up", () => {
  const js = read("create.js");
  assert.match(js, /if\(c\.id==='github'\)return sec\.github_token\?\.set\?'on':'off';/);
  assert.match(js, /if\(c\.id==='stripe'\)return sec\.stripe_secret_key\?\.set\?'on':'off';/);
  assert.match(js, /if\(c\.id==='email'\)return s\?\.email\?'on':'admin';/);
  assert.match(js, /cnUi\.settings=\(await api\('\/projects\/'\+cnUi\.id\+'\/settings'\)\)\.settings/);
  assert.match(js, /await openProject\(p\.id\);c\.open\(\)/);
});
