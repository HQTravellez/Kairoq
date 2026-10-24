"use strict";
// Chat streams the model's thinking separately from its answer, so the page can show a
// collapsible "Thought" panel (like Hermes) and the saved answer never contains the thinking.
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.join(__dirname, "..");

function fakeModel() {
  return new Promise(resolve => {
    const seen = [];
    const server = http.createServer((req, res) => {
      if (req.url.endsWith("/models")) return res.end(JSON.stringify({ data: [{ id: "gemma4:31b" }] }));
      let body = "";
      req.on("data", c => (body += c));
      req.on("end", () => {
        seen.push(JSON.parse(body || "{}"));
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        const send = delta => res.write(`data: ${JSON.stringify({ model: "gemma4:31b", choices: [{ index: 0, delta }] })}\r\n\r\n`);
        send({ reasoning: "Weigh scale and budget. " });
        send({ reasoning_content: "Keep it short." });
        send({ content: "Pick the simplest stack " });
        send({ content: "that ships." });
        res.end(`data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\r\n\r\ndata: [DONE]\r\n\r\n`);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve({ port: server.address().port, seen, close: () => new Promise(r => server.close(r)) }));
  });
}

async function waitFor(url, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error("server did not start");
}

test("a model on the OpenAI-compatible route (Ollama, Ollama Cloud) streams thinking and answer separately", { timeout: 60000 }, async () => {
  const model = await fakeModel();
  const port = 39000 + Math.floor(Math.random() * 900);
  const server = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: { ...process.env, PORT: String(port), ZERO_COST_MODE: "true", LOCAL_LLM_BASE_URL: `http://127.0.0.1:${model.port}/v1`, LOCAL_LLM_MODEL: "gemma4:31b", KAIROQ_HERMES_URL: "", KAIROQ_HERMES_KEY: "" },
    stdio: "ignore",
  });
  try {
    await waitFor(`http://127.0.0.1:${port}/health`);
    const r = await fetch(`http://127.0.0.1:${port}/api/chat/stream`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openrouter/free", reasoningEffort: "high", messages: [{ role: "user", content: "how do I choose a tech stack" }] }),
    });
    const events = [];
    for (const block of (await r.text()).split(/\n\n/)) {
      const ev = /^event: (.+)$/m.exec(block)?.[1];
      const data = /^data: (.+)$/m.exec(block)?.[1];
      if (ev) events.push({ ev, data: data ? JSON.parse(data) : {} });
    }
    const of = name => events.filter(e => e.ev === name).map(e => e.data.text).join("");
    assert.equal(of("thinking"), "Weigh scale and budget. Keep it short.");
    assert.equal(of("token"), "Pick the simplest stack that ships.", "answer arrives (the old stream reader split on a literal \\n and returned nothing)");
    assert.equal(model.seen[0].reasoning_effort, "high", "the effort picker reaches the model");
  } finally {
    server.kill();
    await model.close();
  }
});

test("the chat page folds thinking into a Thought panel and keeps it out of the saved answer", () => {
  const app = fs.readFileSync(path.join(root, "public/app.js"), "utf8");
  assert.match(app, /event==="thinking"/);
  assert.match(app, /Thought for \$\{thoughtSeconds/);
  assert.match(app, /finalMsg\.thinking=/);
  const split = new Function(`${/function splitThinkTags[\s\S]*?\n}\n/.exec(app)[0]}; return splitThinkTags;`)();
  assert.deepEqual(split("<think>plan it</think>\n\nAnswer"), { thought: "plan it", answer: "Answer", thinking: false });
  assert.deepEqual(split("<think>still going"), { thought: "still going", answer: "", thinking: true });
  assert.deepEqual(split("Plain answer"), { thought: "", answer: "Plain answer", thinking: false });
});
