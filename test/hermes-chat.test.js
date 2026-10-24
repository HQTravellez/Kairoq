"use strict";
// Behaviour tests for the Kairoq → Hermes Agent chat client, against a local fake
// of Hermes' OpenAI-compatible API server (same SSE wire format, including the
// `: keepalive` comments and `event: hermes.tool.progress` frames it emits).
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const hermes = require("../hermes-chat");

const KEY = "test-api-server-key-0123456789";

function startFake(handler) {
  return new Promise(resolve => {
    const requests = [];
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", c => (body += c));
      req.on("end", () => {
        const entry = { url: req.url, headers: req.headers, body: body ? JSON.parse(body) : null };
        requests.push(entry);
        handler(req, res, entry);
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const env = { KAIROQ_HERMES_URL: `http://127.0.0.1:${server.address().port}`, KAIROQ_HERMES_KEY: KEY };
      resolve({ env, requests, close: () => new Promise(r => { server.closeAllConnections?.(); server.close(r); }) });
    });
  });
}

const chunk = (delta, finish = null, extra = {}) =>
  `data: ${JSON.stringify({ object: "chat.completion.chunk", model: "hermes-agent", choices: [{ index: 0, delta, finish_reason: finish }], ...extra })}\n\n`;

test("is only configured with a URL and a real key", () => {
  assert.equal(hermes.configured({}), false);
  assert.equal(hermes.configured({ KAIROQ_HERMES_URL: "http://hermes:8642" }), false);
  assert.equal(hermes.configured({ KAIROQ_HERMES_URL: "http://hermes:8642", KAIROQ_HERMES_KEY: "short" }), false);
  assert.equal(hermes.configured({ KAIROQ_HERMES_URL: "http://hermes:8642/", KAIROQ_HERMES_KEY: KEY }), true);
});

test("streams reply text and tool progress, ignoring keepalives", async () => {
  const fake = await startFake((req, res) => {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write(chunk({ role: "assistant" }));
    res.write(": keepalive\n\n");
    res.write(`event: hermes.tool.progress\ndata: ${JSON.stringify({ tool: "web_search", emoji: "🔍", label: 'Searching "Railway pricing"', status: "running" })}\n\n`);
    res.write(`event: hermes.tool.progress\ndata: ${JSON.stringify({ tool: "web_search", status: "completed" })}\n\n`);
    res.write(chunk({ content: "Hello " }));
    res.write(chunk({ reasoning_content: "thinking privately" }));
    res.write(chunk({ content: "Ka" }));
    res.write(chunk({}, "stop", { usage: { total_tokens: 9 } }));
    res.end("data: [DONE]\n\n");
  });
  try {
    const tokens = [], statuses = [];
    const reply = await hermes.streamChat({
      env: fake.env,
      messages: [{ role: "system", content: "Be brief." }, { role: "user", content: "hi" }],
      onToken: t => tokens.push(t), onStatus: s => statuses.push(s),
    });
    assert.equal(reply.text, "Hello Ka");
    assert.deepEqual(tokens, ["Hello ", "Ka"]);
    assert.deepEqual(statuses, ['🔍 Searching "Railway pricing"…']);
    assert.equal(reply.finishReason, "stop");
    assert.deepEqual(reply.usage, { total_tokens: 9 });

    const sent = fake.requests[0];
    assert.equal(sent.url, "/v1/chat/completions");
    assert.equal(sent.headers.authorization, `Bearer ${KEY}`);
    assert.equal(sent.headers["x-hermes-session-key"], "kairoq:owner");
    assert.equal(sent.body.stream, true);
    assert.equal(sent.body.model, "hermes-agent");
    assert.deepEqual(sent.body.messages.map(m => m.role), ["system", "user"]);
  } finally { await fake.close(); }
});

test("a failed turn is an error, flagged once text was already shown", async () => {
  const fake = await startFake((req, res) => {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write(chunk({ content: "Partial" }));
    res.write(chunk({}, "error", { error: { message: "provider quota exceeded" } }));
    res.end("data: [DONE]\n\n");
  });
  try {
    await assert.rejects(hermes.streamChat({ env: fake.env, messages: [{ role: "user", content: "hi" }] }),
      e => e.name === "HermesError" && e.afterPartial === true && /provider quota exceeded/.test(e.message));
  } finally { await fake.close(); }
});

test("a wrong key fails before any text, so Kairoq can fall back", async () => {
  const fake = await startFake((req, res) => { res.writeHead(401, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: { message: "Invalid API key" } })); });
  try {
    await assert.rejects(hermes.streamChat({ env: fake.env, messages: [{ role: "user", content: "hi" }] }),
      e => e.afterPartial === false && e.status === 401 && /KAIROQ_HERMES_KEY/.test(e.message));
  } finally { await fake.close(); }
});

test("an unreachable or silent Hermes times out instead of hanging chat", async () => {
  await assert.rejects(hermes.streamChat({ env: { KAIROQ_HERMES_URL: "http://127.0.0.1:9", KAIROQ_HERMES_KEY: KEY }, messages: [{ role: "user", content: "hi" }] }),
    e => e.afterPartial === false && /unreachable/.test(e.message));
  const fake = await startFake(() => { /* never answers */ });
  try {
    await assert.rejects(hermes.streamChat({ env: { ...fake.env, KAIROQ_HERMES_CONNECT_TIMEOUT_MS: "200" }, messages: [{ role: "user", content: "hi" }] }),
      e => e.afterPartial === false && /did not respond/.test(e.message));
  } finally { await fake.close(); }
});

test("a stream that ends without finishing is not treated as a complete answer", async () => {
  const fake = await startFake((req, res) => { res.writeHead(200, { "Content-Type": "text/event-stream" }); res.end(chunk({ content: "cut off" })); });
  try {
    await assert.rejects(hermes.streamChat({ env: fake.env, messages: [{ role: "user", content: "hi" }] }),
      e => e.afterPartial === true && /unexpectedly/.test(e.message));
  } finally { await fake.close(); }
});

test("attachments Hermes cannot take become a short note; images pass through", () => {
  const out = hermes.toHermesMessages([
    { role: "tool", content: "dropped" },
    { role: "user", content: [{ type: "text", text: "see this" }, { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }, { type: "file", file: { name: "a.pdf" } }] },
    { role: "user", content: [{ type: "text", text: "only text" }, { type: "input_file" }] },
  ]);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0].content.map(p => p.type), ["text", "image_url", "text"]);
  assert.match(out[0].content[2].text, /not forwarded/);
  assert.equal(typeof out[1].content, "string");
});

test("Kairoq routes owner chat to Hermes first and falls back only before any reply text", () => {
  const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
  const hermesAt = server.indexOf('require("./hermes-chat")');
  assert.ok(hermesAt > server.indexOf("async function handleChat"));
  assert.ok(hermesAt < server.indexOf("const siteUrlFromMessage"), "Hermes must run before the old website shortcut");
  assert.ok(hermesAt > server.indexOf('require("./chat-browser").wantsBrowser(askText)'), "browser tasks go to the real browser before Hermes");
  assert.match(server, /hermes\.configured\(\)&&isAuthenticated\(req\)/);
  assert.match(server, /if\(hermesErr\.afterPartial\|\|hermesController\.signal\.aborted\)throw hermesErr/);
});

test("the chat page no longer calls the removed answer badge helper", () => {
  const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
  assert.doesNotMatch(app, /addAnswerBadge\(/);
});

test("Hermes service config keeps dangerous toolsets off", () => {
  const cfg = fs.readFileSync(path.join(__dirname, "../hermes/config.yaml"), "utf8");
  const disabled = cfg.split("disabled_toolsets:")[1].split("\n\n")[0];
  for (const name of ["terminal", "file", "browser", "computer_use", "code_execution", "delegation", "connections", "cronjob"])
    assert.match(disabled, new RegExp(`- ${name}\\b`), `${name} must be disabled`);
  assert.match(cfg, /api_server: \[web, vision, memory, session_search, todo, skills\]/);
});

test("the Superpowers skill library ships with Hermes, complete and licensed", () => {
  const root = path.join(__dirname, "../hermes/skills/superpowers");
  const skills = fs.readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  for (const name of ["using-superpowers", "brainstorming", "writing-plans", "systematic-debugging", "verification-before-completion", "test-driven-development", "receiving-code-review"])
    assert.ok(skills.includes(name), `${name} is shipped`);
  for (const name of skills) assert.match(fs.readFileSync(path.join(root, name, "SKILL.md"), "utf8"), new RegExp(`^---\\nname: ${name}\\n`), `${name}/SKILL.md has front matter`);
  assert.match(fs.readFileSync(path.join(root, "LICENSE"), "utf8"), /MIT License[\s\S]*Jesse Vincent/);
  const cfg = fs.readFileSync(path.join(__dirname, "../hermes/config.yaml"), "utf8");
  assert.match(cfg, /skills:\n  external_dirs:\n    - "\$\{KAIROQ_SKILLS_DIR\}"/);
  const docker = fs.readFileSync(path.join(__dirname, "../hermes/Dockerfile"), "utf8");
  assert.match(docker, /COPY hermes\/skills \/opt\/kairoq\/skills/);
  assert.match(docker, /chmod -R a\+rX,go-w \/opt\/kairoq\/skills/);
});

test("Hermes remembers and learns on its own, without approvals nobody can give", () => {
  const yaml = fs.readFileSync(path.join(__dirname, "../hermes/config.yaml"), "utf8");
  const memory = yaml.split("\nmemory:\n")[1].split("\n\n")[0];
  assert.match(memory, /memory_enabled: true/);
  assert.match(memory, /user_profile_enabled: true/);
  assert.match(memory, /write_approval: false/);
  assert.match(memory, /nudge_interval: [1-9]\b/);
  const skills = yaml.split("\nskills:\n")[1].split("\n\n")[0];
  assert.match(skills, /creation_nudge_interval: [1-9]\b/);
  assert.match(skills, /write_approval: false/);
  const allowed = /api_server: \[([^\]]+)\]/.exec(yaml)[1];
  for (const t of ["memory", "session_search", "skills"]) assert.match(allowed, new RegExp(`\\b${t}\\b`));
});

test("Hermes sees the chat's last 100 messages and a larger always-on memory", () => {
  const msgs = Array.from({ length: 130 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "m" + i }));
  const out = hermes.toHermesMessages(msgs);
  assert.equal(out.length, 100);
  assert.equal(out[0].content, "m30");
  const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
  assert.match(server, /normalizeMessages\(body\.messages,100\)/);
  const yaml = fs.readFileSync(path.join(__dirname, "../hermes/config.yaml"), "utf8");
  assert.match(yaml, /memory_char_limit: 5000/);
  assert.match(yaml, /user_char_limit: 3000/);
});
