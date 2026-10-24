"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { renderApiDocumentation, allowed } = require("../api-browser-docs");
const lookup = async () => [{ address: "93.184.215.14", family: 4 }];
test("browser documentation cannot use an unapproved host", () => {
  assert.throws(() => allowed("https://unknown.example/docs", "docs.example.com"), /allowlisted/);
});
test("browser documentation refuses local and IP addresses", () => {
  for (const url of ["http://docs.example.com", "https://localhost/api", "https://127.0.0.1/docs"]) {
    assert.throws(() => allowed(url, "localhost,127.0.0.1,docs.example.com"));
  }
});
test("browser documentation is disabled by default", async () => {
  const old = process.env.KAIROQ_BROWSER_DOCS_ENABLED;
  delete process.env.KAIROQ_BROWSER_DOCS_ENABLED;
  try {
    await assert.rejects(renderApiDocumentation("https://docs.example.com/docs", {
      allowedHosts: "docs.example.com", lookup,
      renderer: async () => ({ body: "GET /trips" })
    }), /disabled/);
  } finally {
    if (old !== undefined) process.env.KAIROQ_BROWSER_DOCS_ENABLED = old;
  }
});
test("browser produces draft endpoints, not verified API execution", async () => {
  const old = process.env.KAIROQ_BROWSER_DOCS_ENABLED;
  process.env.KAIROQ_BROWSER_DOCS_ENABLED = "true";
  try {
    const result = await renderApiDocumentation("https://docs.example.com/docs", {
      allowedHosts: "docs.example.com", lookup,
      renderer: async () => ({ title: "Docs", body: "GET /trips/{id} Returns trip details." })
    });
    assert.equal(result.source, "chromium-rendered");
    assert.equal(result.operations[0].method, "GET");
    assert.match(result.limitations.join(" "), /not approved for execution/);
  } finally {
    if (old === undefined) delete process.env.KAIROQ_BROWSER_DOCS_ENABLED;
    else process.env.KAIROQ_BROWSER_DOCS_ENABLED = old;
  }
});
test("browser refuses DNS-resolved private hosts", async () => {
  await assert.rejects(renderApiDocumentation("https://docs.example.com/docs", {
    allowedHosts: "docs.example.com",
    lookup: async () => [{ address: "10.1.1.1", family: 4 }]
  }), /non-public/);
});
