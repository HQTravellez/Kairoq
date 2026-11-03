"use strict";
// The Sales Agent page (Ka's Figma layout) replaces the "Find customers" pop-up. The same outreach
// API drives it: tabs come from real lead statuses, the fit only counts the owner's own signals
// that Kairoq saw on the lead's website, and nothing is sent without an approval.
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "public", f), "utf8");

test("the sidebar opens a full Sales Agent page instead of the pop-up", () => {
  const html = read("create.html");
  assert.doesNotMatch(html, /id="leads-dialog"/);
  assert.match(html, /id="side-leads">[\s\S]*?Sales Agent<\/button>/);
  const page = html.slice(html.indexOf('id="leads-screen"'), html.indexOf('id="editor"'));
  for (const id of ["leads-kind", "leads-area", "leads-search", "ld-about", "leads-signals", "leads-save", "ld-tabs", "ld-grid", "leads-attribution"]) assert.match(page, new RegExp('id="' + id + '"'));
  assert.equal((html.match(/id="leads-kind"/g) || []).length, 1, "no duplicate ids");
});

test("tabs, fit and approvals use the real outreach data", () => {
  const js = read("create.js");
  assert.match(js, /const LD_TABS=\[\['new','New'/);
  assert.match(js, /function leadFit\(l,d\)\{const seen=\(l\.observations\|\|\[\]\)\.filter\(o=>o\.value&&\(d\.settings\.signals/);
  assert.match(js, /action:'approve'/);
  assert.match(js, /if\(!confirm\('Send this email to '\+mail\.to\+' now\?'\)\)return;/, "sending asks first");
  assert.match(js, /'Approve and send':'Approve'/, "without a sending address the button only approves");
});

test("a new lead can be skipped and moved back", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kairoq-sales-"));
  process.env.KAIROQ_OUTREACH_DIR = dir;
  const O = require("../outreach");
  const st = O.load("acct-s");
  st.leads = [{ id: "osm-node-9", name: "Test Cafe", kind: "cafe", status: "new", observations: [] }];
  fs.writeFileSync(path.join(dir, require("node:crypto").createHash("sha256").update("acct-s").digest("hex").slice(0, 24) + ".json"), JSON.stringify(st));
  assert.equal(O.mark("acct-s", "osm-node-9", "skipped").leads[0].status, "skipped");
  assert.equal(O.mark("acct-s", "osm-node-9", "new").leads[0].status, "new");
  assert.throws(() => O.mark("acct-s", "osm-node-9", "contacted"), /Unknown status/);
});
