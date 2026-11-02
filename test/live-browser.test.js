"use strict";
// The live browser pane: a real Chromium screen streamed as frames, and the owner's own
// address bar, clicks and typing going through to the page.
process.env.NODE_ENV = "test"; process.env.KAIROQ_EXTERNAL_ALLOW_LOCAL = "1";
const test = require("node:test"), assert = require("node:assert/strict"), http = require("node:http");
const runtime = require("../runtime-check"), live = require("../live-browser");

const PAGE = `<!doctype html><title>Shop</title><body style="font:20px sans-serif">
<input id="q" placeholder="Search"><button id="b" style="position:absolute;left:20px;top:80px;width:200px;height:60px"
onclick="document.title='Clicked '+document.getElementById('q').value">Go</button></body>`;

function fakeViewer() {
  const events = [];
  const res = { writeHead() {}, write(s) { if (s.startsWith("data: ")) events.push(JSON.parse(s.slice(6))); }, on() {} };
  const req = { on(ev, fn) { if (ev === "close") res.close = fn; } };
  return { req, res, events };
}
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };

test("the owner opens a site, watches it live, and clicks and types on it", { skip: !runtime.available() && "needs Chromium" }, async () => {
  const srv = http.createServer((q, r) => { r.writeHead(200, { "Content-Type": "text/html" }); r.end(PAGE); });
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + srv.address().port + "/";
  const v = fakeViewer();
  try {
    live.stream("owner-1", v.req, v.res);
    await live.input("owner-1", { type: "go", url });
    assert.ok(await until(() => v.events.some(e => e.frame && e.url === url)), "live frames of the page arrive");
    const last = v.events.at(-1);
    assert.equal(last.driver, "you");
    assert.ok(last.width >= 1000 && last.height >= 600, "frames say the page size for mapping clicks");

    await live.input("owner-1", { type: "click", x: 60, y: 20 });     // the search box
    await live.input("owner-1", { type: "type", text: "xero" });
    await live.input("owner-1", { type: "click", x: 120, y: 110 });   // the Go button
    assert.ok(await until(() => v.events.some(e => e.title === "Clicked xero")), "the click and typing reached the page");

    await assert.rejects(live.input("owner-2", { type: "click", x: 1, y: 1 }), /Type an address first/, "each account has its own browser");
  } finally {
    v.res.close?.();
    await live._states.get("owner-1")?.session?.close();
    srv.close();
    await runtime.close();
  }
});

test("while Kairoq researches, the owner's input waits", async () => {
  const s = { page: {}, driver: "kairoq" };
  live._states.set("owner-3", { ...s, viewers: new Set() });
  await assert.rejects(live.input("owner-3", { type: "go", url: "https://example.com" }), /Kairoq is using the browser/);
  live._states.delete("owner-3");
});
