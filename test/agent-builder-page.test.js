"use strict";
// Agent builder page: an app's agents are its automations, shown with their real runs and
// Run now; "Build this agent" turns the form into a normal build request for that app.
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "public", f), "utf8");

test("the sidebar opens the Agents page with a project picker and a New agent form", () => {
  const html = read("create.html");
  assert.match(html, /id="side-agents">[\s\S]*?Agents<\/button>/);
  const page = html.slice(html.indexOf('id="agents-screen"'), html.indexOf('id="editor"'));
  for (const id of ["ag-project", "ag-new-open", "ag-form", "ag-name", "ag-what", "ag-when", "ag-uses", "ag-ask", "ag-list"]) assert.match(page, new RegExp('id="' + id + '"'));
});

test("cards come from the app's real automations, and a new agent is a normal build", () => {
  const js = read("create.js");
  assert.match(js, /api\('\/projects\/'\+agentsUi\.id\+'\/automations'\),api\('\/projects\/'\+agentsUi\.id\+'\/data'\)/);
  assert.match(js, /api\('\/projects\/'\+p\.id\+'\/automations',\{method:'POST',body:\{name:a\.name\}\}\)/, "Run now uses the existing route");
  assert.match(js, /const ask=agRequest\(\);await openProject\(agentsUi\.id\);await send\(ask,'build'\)/);
  assert.match(js, /It must never send an email by itself: it saves each email as a draft I approve/);
  assert.match(js, /new Option\('When a new '\+c\.name/, "triggers are the app's own collections");
});
