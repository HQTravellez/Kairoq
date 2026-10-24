"use strict";
// The approved "Kairoq chat redesign": Hermes-style layout in Kairoq's wine + amber, a Plugins page
// showing real on/off state, and a chat list with pinning, search and relative times.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("sidebar has Plugins, chat search and a pinned list", () => {
  const html = read("public/index.html");
  for (const id of ["pluginsNavBtn", "chatSearch", "pinnedList", "pluginsView", "pvInstalled", "pvCatalog", "plusMenu", "hermesFooterText"])
    assert.match(html, new RegExp(`id="${id}"`), id);
  const app = read("public/app.js");
  assert.match(app, /if\(e\.shiftKey\)\{chat\.pinned=!chat\.pinned/);
  assert.match(app, /function shortAgo\(t\)/);
  assert.match(app, /\["chat","command","studio","build","plugins"\]/);
});

test("the Plugins page reports real state, never a pretend switch", () => {
  const server = read("server.js");
  const fn = /function pluginStatus\(env = process\.env\) \{[\s\S]*?\n\}\n/.exec(server)[0];
  const rootRequire = require("node:module").createRequire(path.join(__dirname, "..", "server.js"));
  const status = new Function("require", "__dirname", `${fn}; return pluginStatus;`)(rootRequire, path.join(__dirname, ".."));
  const off = status({});
  const by = id => off.installed.find(p => p.id === id);
  assert.equal(by("superpowers").hermes.on, false);
  assert.match(by("superpowers").hermes.why, /Hermes isn't connected/);
  assert.equal(by("jev").kairoq.on, false);
  assert.equal(by("dashi").kairoq.on, false);
  assert.ok(off.skills >= 10, "Superpowers skills are counted from disk");
  const on = status({ KAIROQ_HERMES_URL: "http://hermes:8642", KAIROQ_HERMES_KEY: "k".repeat(40), KAIROQ_API_INTELLIGENCE: "on", TYPESAFE_API_KEY: "x", SCALEDOWN_API_KEY: "y" });
  assert.equal(on.installed.find(p => p.id === "superpowers").hermes.on, true);
  assert.equal(on.installed.find(p => p.id === "jev").kairoq.on, true);
});

test("JSON from a local model is found inside surrounding text", () => {
  const server = read("server.js");
  assert.doesNotMatch(server, /match\(\/\\\\\{\[\\\\s\\\\S\]\*\\\\\}\/\)/, "no double-escaped JSON regex left");
  assert.match(server, /match\(\/\\\{\[\\s\\S\]\*\\\}\/\)/);
});

test("the approved palette and the builder page restyle are loaded", () => {
  const css = read("public/kairoq-ui.css");
  assert.match(css, /--k-wine:#8a2d3b/);
  assert.match(css, /\.kh-composer-slot::before/);
  assert.match(css, /\.main \.messages\{max-width:none!important/, "full width like Hermes");
  assert.match(read("public/create.html"), /create-kairoq\.css/);
});

test("the builder's check report doesn't mention another project's features", () => {
  const js = read("public/create.js");
  assert.doesNotMatch(js, /food search|calorie|macro targets/i);
});
