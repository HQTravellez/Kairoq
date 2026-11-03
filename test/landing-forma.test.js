"use strict";
// The signed-out page, from Ka's Figma "Marketing" and "Phone Home" frames.
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "public", f), "utf8");

test("the hero has the Figma words and the purple Build with Kairoq button", () => {
  const html = read("create.html");
  assert.match(html, /<h1[^>]*>Big idea\.<br><em>Meet first version\.<\/em><\/h1>/);
  assert.match(html, /<b>New<\/b> From first prompt to your own domain/);
  assert.match(html, /<button class="primary send fm-build" type="submit">[\s\S]*?Build with Kairoq<\/button>/);
});

test("the button beats the old square send button, and is full width on a phone", () => {
  const css = read("ui/forma.css");
  assert.match(css, /body:not\(\.app\) #auth #landing-form \.send\.fm-build\{width:auto!important/);
  assert.match(css, /@media \(max-width:900px\)\{[\s\S]*?#landing-form \.send\.fm-build\{width:100%!important/);
  assert.match(read("create.html"), /\/ui\/forma\.css\?v=\d+/);
});

test("no made-up customer logos or quotes on the page", () => {
  const html = read("create.html");
  assert.doesNotMatch(html, /trusted by|testimonial/i);
});
