"use strict";
// The Jev + ScaleDown pipeline is wired into the running app: API Studio's analyze/prepare
// get an advisory (owner opt-in), and POST /api/developer/api/orchestrate exposes the
// multi-provider call graph, SDKs and advisory. Vendors are faked; nothing leaves the machine.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ai = require("../api-intelligence");
const pipe = require("../api-intelligence-pipeline");
const intake = require("../api-product-intake");

const spec = {
  openapi: "3.0.3", info: { title: "Stays", version: "1" }, servers: [{ url: "https://api.stays.example/v1" }],
  components: { securitySchemes: { key: { type: "apiKey", in: "header", name: "X-Api-Key" } } },
  security: [{ key: [] }],
  paths: {
    "/properties": { get: { operationId: "listProperties", summary: "List furnished properties", responses: { "200": { content: { "application/json": { schema: { type: "object" } } } } } } },
    "/bookings": { post: { operationId: "createBooking", summary: "Book a property", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["propertyId"], properties: { propertyId: { type: "string" } } } } } }, responses: { "200": { content: { "application/json": { schema: { type: "object" } } } } } } },
  },
};
const ON = { KAIROQ_API_INTELLIGENCE: "on", TYPESAFE_API_KEY: "fixture-jev", SCALEDOWN_API_KEY: "fixture-cdm" };

function fakeVendors() {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const payload = JSON.parse(init.body);
    calls.push({ url, headers: init.headers, payload });
    if (url === ai.ENDPOINTS.classify) return { ok: true, text: async () => JSON.stringify({ top_label: "authentication", scores: { authentication: 0.93, dependencies: 0.03, mapping: 0.02, errors: 0.01, other: 0.01 }, usage: { input_tokens: 80, output_tokens: 5 } }) };
    if (url === ai.ENDPOINTS.jev) return { ok: true, text: async () => JSON.stringify({ answers: { next: { type: "choice", choice: "auth", confidence: 0.9, probabilities: { auth: 0.9, contract: 0.05, mapping: 0.05 } } }, usage: { input_tokens: 60, output_tokens: 4 } }) };
    throw new Error("unexpected url " + url);
  };
  return { calls, fetchImpl };
}

test("off by default: nothing is sent and the reason says how to turn it on", async () => {
  const { calls, fetchImpl } = fakeVendors();
  const r = await pipe.advise({ apiPlan: require("../api-learning").learn(spec) }, { env: {}, fetchImpl });
  assert.equal(r.status, "off");
  assert.match(r.reason, /KAIROQ_API_INTELLIGENCE=on/);
  assert.equal(calls.length, 0);
});

test("on: CDM labels the documentation and Jev picks the next investigation step", async () => {
  const { calls, fetchImpl } = fakeVendors();
  const plan = require("../api-learning").learn(spec);
  const r = await pipe.advise({ apiPlan: plan, documentationText: "Send X-Api-Key on every request. Bookings need a propertyId." }, { env: ON, fetchImpl });
  assert.equal(r.status, "ok");
  assert.equal(r.nextStep, ai.NEXT.auth);
  assert.equal(r.jev.status, "advisory");
  assert.equal(r.cdm.length, 2, "the documentation text and the operation list are both classified");
  assert.ok(r.cdm.every(n => n.label === "authentication"));
  assert.deepEqual(r.missingKeys, []);
  const cdmCalls = calls.filter(c => c.url === ai.ENDPOINTS.classify), jevCalls = calls.filter(c => c.url === ai.ENDPOINTS.jev);
  assert.equal(cdmCalls.length, 2); assert.equal(jevCalls.length, 1);
  assert.equal(cdmCalls[0].headers["x-api-key"], "fixture-cdm");
  assert.equal(jevCalls[0].headers.Authorization, "Bearer fixture-jev");
  assert.ok(cdmCalls.some(c => /GET \/properties List furnished properties/.test(c.payload.text)), "operations are summarised for CDM");
  const state = JSON.parse(jevCalls[0].payload.state);
  assert.equal(state.documentedOperations, 2);
  assert.deepEqual(state.documentationLabels, ["authentication", "authentication"]);
});

test("text that looks like a credential is never sent", async () => {
  const { calls, fetchImpl } = fakeVendors();
  await pipe.advise({ documentationText: "Use Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456 for the sandbox" }, { env: ON, fetchImpl });
  assert.ok(calls.every(c => !/abcdefghijklmnop/.test(JSON.stringify(c.payload))));
});

test("missing vendor keys are reported, not faked", async () => {
  const { fetchImpl } = fakeVendors();
  const r = await pipe.advise({ apiPlan: require("../api-learning").learn(spec) }, { env: { KAIROQ_API_INTELLIGENCE: "on" }, fetchImpl });
  assert.deepEqual(r.missingKeys, ["TYPESAFE_API_KEY", "SCALEDOWN_API_KEY"]);
  assert.equal(r.nextStep, null);
  assert.ok(r.cdm.every(n => n.status === "unavailable"));
});

test("API Studio analyze carries the advisory in blueprint.intelligence", async () => {
  const { fetchImpl } = fakeVendors();
  const r = await intake.analyze({ brief: "A booking site for furnished corporate apartments", apiSpec: spec }, { env: ON, intelligenceFetch: fetchImpl });
  assert.equal(r.blueprint.formalContract, true);
  assert.equal(r.blueprint.intelligence.status, "ok");
  assert.equal(r.blueprint.intelligence.nextStep, ai.NEXT.auth);
  const off = await intake.analyze({ brief: "A booking site for furnished corporate apartments", apiSpec: spec }, { env: {} });
  assert.equal(off.blueprint.intelligence.status, "off");
});

test("the server exposes orchestration and API Studio shows the advice", () => {
  const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
  assert.match(server, /url==="\/api\/developer\/api\/orchestrate"/);
  assert.match(server, /pipeline\.prepare\(\{contracts:input\.contracts,workflow:input\.workflow/);
  assert.match(server, /ai:pipeline\.aiSettings\(\)/);
  const studio = fs.readFileSync(path.join(__dirname, "../public/api-studio.html"), "utf8");
  assert.match(studio, /showJev\(response\.blueprint\.intelligence\)/);
  assert.match(studio, /showJev\(result\.blueprint\.intelligence\)/);
  assert.match(studio, /id="jevAdvice"/);
});
