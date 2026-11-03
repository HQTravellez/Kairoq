"use strict";
// Templates, Pricing and Settings & usage as full pages, from Ka's Figma frames.
// They use real data only: the template list, the plans and packs from Railway, and the credit ledger.
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const html = read("public/create.html"), js = read("public/create.js"), css = read("public/ui/tool-pages.css");

test("three new screens are wired into the screen switcher and the sidebar", () => {
  for (const id of ["templates-screen", "pricing-screen", "settings-screen"]) {
    assert.match(html, new RegExp('<section class="screen hidden tp" id="' + id + '"'));
    assert.match(js, new RegExp("'" + id + "'\\]\\)\\$\\(id\\)|'" + id + "',"));
  }
  assert.match(html, /id="side-settings"[\s\S]*?Settings &amp; usage<\/button>/);
  assert.match(js, /\$\('side-templates'\)\.onclick=openTemplates;/);
  assert.match(js, /\$\('side-settings'\)\.onclick=openSettings;/);
  assert.match(js, /\$\('plans-open'\)\.onclick=openPricing;/);
  assert.doesNotMatch(html, /id="plans-dialog"/, "the Plans dialog is replaced by the Pricing page");
});

test("the pages carry the Figma words", () => {
  assert.match(html, /Find your starting point\./);
  assert.match(html, /A plan for where you’re going\./);
  assert.match(html, /A little workspace housekeeping\./);
});

test("usage comes from the credit ledger only; nothing is invented", () => {
  assert.match(js, /\[credits,\{projects\}\]=await Promise\.all\(\[api\('\/credits'\),api\('\/projects'\)\]\)/);
  assert.match(js, /const spent=recent\.filter\(h=>h\.delta<0\)/);
  const pages = html.slice(html.indexOf('id="templates-screen"'), html.indexOf("</section>", html.indexOf('id="settings-screen"')));
  assert.doesNotMatch(pages + js.slice(js.indexOf("const tgUi"), js.indexOf("$('st-billing').onclick")), /Visa ending|Most popular|remixes|Editor’s pick/i);
  assert.match(read("create-api.js"), /history:accounts\.history\(v\.account\.id,200\)/);
});

test("the plan card is dark only for the plan you are on", () => {
  assert.match(js, /grid\.append\(card\(p\.name,[^;]*,b,mine\)\);/);
  assert.match(css, /html body\.app \.pr-card\.dark\{background:var\(--f-chrome,#242329\)/);
  assert.match(css, /@media \(max-width:820px\)\{html body\.app \.st-top\{display:flex!important;flex-direction:column\}/);
});
