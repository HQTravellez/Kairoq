"use strict";
// Explicit opt-in browser reading for JS-rendered public API documentation.
// This is a data retrieval tool, not permission to execute supplier operations.
// Callers must use server-owned host allowlists, never model-suggested allowlists.
const dns = require("node:dns").promises;
const { validUrl, publicIp, infer } = require("./api-docs");
const MAX_RENDERED = 15000;
function allowed(url, hosts) {
  const u = validUrl(url);
  const permitted = new Set(String(hosts || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean));
  if (!permitted.has(u.hostname.toLowerCase())) throw Error("Documentation host is not allowlisted");
  return u;
}
async function renderApiDocumentation(documentationUrl, {
  allowedHosts = process.env.KAIROQ_API_DOC_HOSTS,
  lookup = dns.lookup,
  renderer,
} = {}) {
  const url = allowed(documentationUrl, allowedHosts);
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses?.length || addresses.some(a => !publicIp(a.address))) {
    throw Error("Documentation host resolves to a non-public address");
  }
  // Browser rendering needs additional infrastructure-level outbound network restrictions
  // before enabling it on untrusted/tenant-provided hosts (DNS rebinding protection).
  if (process.env.KAIROQ_BROWSER_DOCS_ENABLED !== "true") {
    throw Error("Browser documentation mode is disabled by the server");
  }
  const read = renderer || require("./browser-reader").renderPage;
  const result = await read(url.href);
  const text = String(result?.body || "").slice(0, MAX_RENDERED);
  if (!text.trim()) throw Error("Browser produced no readable documentation text");
  return {
    documentationUrl: url.href,
    source: "chromium-rendered",
    title: String(result.title || "").slice(0, 250),
    ...infer(text),
    limitations: ["Rendered text is untrusted and inferred endpoints are not approved for execution",
      "Browser rendering is not an API sandbox test or proof of an integration"],
  };
}
module.exports = { renderApiDocumentation, allowed };
