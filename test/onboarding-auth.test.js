"use strict";
// Sign up / sign in and the first project, from Ka's Figma frames.
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "public", f), "utf8");

test("sign in is a split screen: the dark story on the left, the form on the right", () => {
  const html = read("create.html");
  assert.match(html, /<dialog class="auth-dialog fm-auth" id="auth-dialog"/);
  assert.match(html, /<p class="auth-big">That idea you keep coming back to\?<\/p>\s*<p class="auth-big accent">Let's make it\.<\/p>/);
  const js = read("create.js");
  assert.match(js, /mode==='signup'\?'Make room for your ideas\.':'Welcome back\.'/);
  assert.match(js, /'Start building for free\. Your first '\+state\.me\.free_credits\+' credits are on us\.'/, "the real free credits");
  assert.match(read("ui/forma.css"), /dialog\.fm-auth\[open\]\{position:fixed!important;inset:0!important/);
});

test("a new account sees the first-project screen; it starts the normal questions, plan and build", () => {
  const html = read("create.html");
  for (const id of ["onboard", "ob-for", "ob-name", "ob-what", "ob-ideas", "ob-go"]) assert.match(html, new RegExp('id="' + id + '"'));
  const js = read("create.js");
  assert.match(js, /const on=Boolean\(state\.me\?\.viewer\)&&!projects\.length&&!skip;/);
  assert.match(js, /await askThenBuild\(what\+'\\n\\nIt is for '\+onboardFor\(\)\+'\.',\$\('ob-name'\)\.value\)/);
  assert.match(js, /async function askThenBuild\(prompt,chosenName\)\{\n const name=String\(chosenName\|\|''\)\.trim\(\)\|\|shortName\(prompt\);/);
});
