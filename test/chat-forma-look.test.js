"use strict";
// The main chat page (/) in Ka's Figma design: chat-forma.css replaces the dark sheet, loads last,
// and wins over the older layers with a raised prefix.
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "public", f), "utf8");

test("the chat page loads the Figma sheet last, not the dark one", () => {
  const html = read("index.html");
  assert.doesNotMatch(html, /chat-dark\.css/);
  const links = [...html.matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m => m[1]);
  assert.equal(links.at(-1), "/chat-forma.css");
  assert.match(html, /family=Inter:wght@[^"]*family=IBM\+Plex\+Mono/);
});

test("Forma colours on the main page: dark band and sidebar, purple actions, lilac bubbles", () => {
  const css = read("chat-forma.css");
  assert.match(css, /--accent:#7552E8/);
  assert.match(css, /header\.topbar\.simple-topbar\{background:#242329!important/);
  assert.match(css, /\.sidebar\.kn,html body:not\(#fm-a\):not\(#fm-b\) \.sidebar\{background:#242329!important/);
  assert.match(css, /\.message\.user[^{]*\{background:#ECE8F3!important/);
  assert.match(css, /#sendBtn\.send-btn\{background:#7552E8!important\}/);
  assert.doesNotMatch(css, /:where\(button,html body/, "the font rule is not mangled");
});
