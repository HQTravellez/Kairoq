"use strict";
// API checker (api-check.js and its page): one guarded call, a plain-words summary built only from
// the response, the fields you can use, and a history that never keeps header values.
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
process.env.KAIROQ_APICHECK_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "kairoq-apicheck-"));
const A = require("../api-check");
const read = f => fs.readFileSync(path.join(__dirname, "..", "public", f), "utf8");

test("a JSON answer is explained in plain words, with the fields you can use", async () => {
  const sent = [];
  const fetchImpl = async o => { sent.push(o); return { status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ latitude: 43.6, current: { time: "2026-11-02T14:00", temperature_2m: 7.4 } }) }; };
  const r = await A.check("acct-a", { url: "https://api.example.com/v1/forecast?x=1", headers: { Authorization: "Bearer secret-123" } }, { fetchImpl });
  assert.equal(r.status, 200); assert.equal(r.ok, true); assert.equal(r.status_text, "OK");
  assert.equal(r.plain, "api.example.com answered with 2 fields: latitude, current.");
  assert.deepEqual(r.fields.map(f => f.path), ["latitude", "current.time", "current.temperature_2m"]);
  assert.equal(sent[0].headers.Authorization, "Bearer secret-123", "the header is sent once");
  const saved = fs.readFileSync(fs.readdirSync(process.env.KAIROQ_APICHECK_DIR).map(f => path.join(process.env.KAIROQ_APICHECK_DIR, f))[0], "utf8");
  assert.doesNotMatch(saved, /secret-123/, "header values are never saved");
  assert.equal(A.history("acct-a")[0].url, "https://api.example.com/v1/forecast?x=1");
});

test("refusals, missing pages and web pages get honest plain words", async () => {
  const ans = (status, type, body) => async () => ({ status, headers: { "content-type": type }, body });
  assert.match((await A.check("acct-b", { url: "https://x.example.com/a" }, { fetchImpl: ans(401, "application/json", "{}") })).plain, /needs a key or a sign-in/);
  assert.match((await A.check("acct-b", { url: "https://x.example.com/a" }, { fetchImpl: ans(404, "text/plain", "no") })).plain, /nothing at this address/);
  assert.match((await A.check("acct-b", { url: "https://x.example.com/" }, { fetchImpl: ans(200, "text/html", "<html></html>") })).plain, /sent a web page, not data/);
  await assert.rejects(A.check("acct-b", { url: "ftp://x.example.com" }), /Only http and https/);
  await assert.rejects(A.check("acct-b", { url: "https://x.example.com", method: "TRACE" }), /Pick GET/);
});

test("the real call refuses private addresses", async () => {
  await assert.rejects(A.check("acct-c", { url: "http://127.0.0.1:8080/admin" }), /private network/);
  await assert.rejects(A.check("acct-c", { url: "http://169.254.169.254/latest/meta-data" }), /private network/);
});

test("the sidebar opens the API checker page", () => {
  const html = read("create.html");
  assert.match(html, /id="side-api">[\s\S]*?API checker<\/button>/);
  const page = html.slice(html.indexOf('id="api-screen"'), html.indexOf('id="editor"'));
  for (const id of ["ac-method", "ac-url", "ac-go", "ac-hrows", "ac-tabs", "ac-view"]) assert.match(page, new RegExp('id="' + id + '"'));
  const js = read("create.js");
  assert.match(js, /api\('\/api-check',\{method:'POST'/);
  assert.match(js, /\$\('new-prompt'\)\.value='Use this API in my app: '/);
  assert.match(fs.readFileSync(path.join(__dirname, "..", "create-api.js"), "utf8"), /limitedKey\('api-check:'\+v\.owner,60,600000\)/);
});
