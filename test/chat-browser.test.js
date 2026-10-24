"use strict";
// Browser use from the main chat (chat-browser.js): when to open the browser, and a real
// headless Chromium run against a local page with a scripted model.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kairoq-chat-browser-"));
process.env.NODE_ENV = "test";
process.env.KAIROQ_EXTERNAL_ALLOW_LOCAL = "1";
process.env.KAIROQ_REACT_PROJECTS_DIR = path.join(tmp, "projects");
process.env.KAIROQ_BROWSER_JUDGE = "off";
const chatBrowser = require("../chat-browser");
test.after(async () => { await require("../runtime-check").close().catch(() => {}); fs.rmSync(tmp, { recursive: true, force: true }); });

test("opens the browser for tasks on a site, reads the page for summaries", () => {
  for (const t of [
    "find the price of a double room on https://hotel.example",
    "check if parkcity.ca has availability next weekend",
    "open the browser and go to example.com",
    "tell me what the pricing plans are on railway.com",
  ]) assert.equal(chatBrowser.wantsBrowser(t), true, t);
  for (const t of ["https://example.com", "summarize https://example.com", "what is this site example.com", "Tell me about railway.com"])
    assert.equal(chatBrowser.wantsBrowser(t), false, t);
});

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Rooms</title></head><body>
<h1>Lakeside Rooms</h1>
<button onclick="document.getElementById('price').textContent='Double room: $189 per night'">Show prices</button>
<p id="price"></p></body></html>`;

const chromium = [process.env.CHROMIUM_PATH, "/usr/bin/chromium", "/tmp/chromium"].find(p => p && fs.existsSync(p));

test("works through a real page in headless Chromium and streams live screenshots", { skip: !chromium && "no Chromium on this machine" }, async () => {
  process.env.CHROMIUM_PATH = chromium;
  const server = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "text/html" }); res.end(PAGE); });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const prompts = [];
  // A scripted model: click the "Show prices" button, then answer from what is on screen.
  const callModel = async (opts, parse) => {
    const user = typeof opts.messages[1].content === "string" ? opts.messages[1].content : opts.messages[1].content.find(p => p.type === "text").text;
    prompts.push(user);
    if (/\$189/.test(user)) return parse(JSON.stringify({ evaluation: "ok", memory: "Saw the price", next_goal: "answer", actions: [{ action: "done", value: "A double room is $189 per night." }] }));
    const target = /\[(\d+)\][^\n]*Show prices/.exec(user);
    assert.ok(target, "the page's button is listed for the model:\n" + user.slice(0, 600));
    return parse(JSON.stringify({ evaluation: "", memory: "On the rooms page", next_goal: "see prices", actions: [{ action: "click", target: Number(target[1]) }] }));
  };
  const statuses = [], frames = [];
  try {
    const r = await chatBrowser.run({ url, task: "find the price of a double room", callModel, onStatus: s => statuses.push(s), onFrame: f => frames.push(f), maxSteps: 5 });
    assert.equal(r.outcome, "completed");
    assert.match(r.markdown, /\$189 per night/);
    assert.match(r.markdown, /What I did on 127\.0\.0\.1/);
    assert.match(r.markdown, /Clicking “Show prices”/);
    assert.ok(statuses.some(s => /Opening 127\.0\.0\.1 in the browser/.test(s)));
    assert.ok(statuses.some(s => /Step 1: Clicking “Show prices”/.test(s)), statuses.join(" | "));
    assert.ok(frames.length >= 2, "a screenshot at the start and the end");
    assert.ok(frames.every(f => /^[A-Za-z0-9+/=]+$/.test(f.image) && Buffer.from(f.image, "base64").subarray(0, 2).equals(Buffer.from([0xff, 0xd8]))), "frames are JPEG");
    assert.equal(frames.at(-1).caption, "Final page");
  } finally {
    server.closeAllConnections(); await new Promise(r => server.close(r));
  }
});

test("refuses private addresses outside test mode", async () => {
  const saved = process.env.KAIROQ_EXTERNAL_ALLOW_LOCAL;
  delete process.env.KAIROQ_EXTERNAL_ALLOW_LOCAL;
  try {
    await assert.rejects(chatBrowser.run({ url: "https://192.168.1.10/", task: "find the admin password", callModel: async () => ({}) }), /public websites/);
  } finally { process.env.KAIROQ_EXTERNAL_ALLOW_LOCAL = saved; }
});

test("chat routes site tasks to the browser before Hermes and the page readers", () => {
  const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
  const at = server.indexOf('require("./chat-browser").wantsBrowser(askText)');
  assert.ok(at > server.indexOf("async function handleChat"));
  assert.ok(at < server.indexOf('require("./hermes-chat")'));
  assert.ok(at < server.indexOf("const siteUrlFromMessage"));
  assert.match(server, /isAuthenticated\(req\)&&require\("\.\/chat-browser"\)/);
  const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
  assert.match(app, /if\(event==="browser"\)showBrowserFrame\(box,data\)/);
});
