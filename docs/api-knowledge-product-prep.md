# Kairoq — API documentation learning and product preparation

This experimental capability implements the following **review-before-execution** journey:

1. Describe desired product in **API Studio**.
2. Search a pinned, locally indexed community directory of 1,700+ public API leads (`api-catalog.js`, `data/public-api-catalog.json`). API candidates are *unverified pointers* and cannot be executed.
3. Use **Find and read API documentation** to try a maximum of three candidates, **only** through Kairoq's existing HTTPS/host-allowlisted documentation reader. It imports official formal OpenAPI / Postman specifications if supported. No website scraping beyond the already permitted docs reader, no provider actions, no credential disclosure.
4. If a formal contract is available, prepare a product plan through the existing product planner and validate every operation ID, mapping, schema and unsupported feature. The plan is not a certificate of supplier access.
5. Kairoq can generate a server SDK and submit a full-stack build using existing workflows and browser QA. **Live vendor API calls, transactional writes and production publishing remain separately gated.**

## Additional formats and learning sources

**APIJSON (https://github.com/APIJSON/APIJSON)**: JSON-query ORM protocol (Apache-2.0, upstream docs inspected Oct 2026). Generic APIJSON documentation is *not* treated as a formal API operation contract. `api-apijson.js` recognizes the protocol and reports the actual tenant base URL, table/field schema, role grants, authentication, and sandbox fixture evidence it needs. With a manually reviewed manifest, it emits a bounded set of read operations, and optionally mutating operations **only** with explicit manifest-level write permissions. The generated adapter is still **not sandbox verified**. No Java runtime or APIJSON server is installed.

**Awesome LLM Apps (https://github.com/Shubhamsaboo/awesome-llm-apps)**: Apache-2.0 code/example collection. `api-pattern-catalog.js` supplies a curated, attributed list of architecture ideas (MCP travel planner, RAG, multi-agent tools, generative UI, voice) to the product planner as **untrusted descriptions**. No external code, skills, agents, packages or scripts are executed.

**System Design Primer (https://github.com/donnemartin/system-design-primer)**: CC BY 4.0, Donne Martin; reference revision `ae9bbd7b02d90b9866215de185217d33f39ab733`. `api-system-design.js` offers Kairoq-written, short guidance on requirements, persistence, queues, caching, availability, external integrations and security, explicitly recording trade-offs and favoring a simple MVP. These are *recommendations*, not implemented scale/reliability certifications.

**Public APIs directory (https://github.com/public-apis/public-apis)**: MIT-licensed pinned community directory; its links may be stale, commercial, or undocumented. Selected providers must provide their actual specs, auth and sandbox. Directory recommendations do not authorize use.

## Tests and release criteria

- `test/api-public-catalog.test.js`: pinned-directory presence, real candidate searches, negative/security cases and a synthetic end-to-end requirements→OpenAPI→product-plan fixture.
- `test/api-knowledge.test.js`: APIJSON protocol detection, fail-closed read/write manifest, AI-example references, attributed system design, a bounded 3-lead formal documentation discovery, disallowed hosts, and planning prompt grounding.
- `.github/workflows/api-product-intake.yml`: static syntax checks and focused API-integration/OAuth/SDK/Studio tests.
- The parent `Benchmark evidence` workflow separately exercises the overall product-building benchmark; its result must be checked before merge.

### Outstanding

- No proof of *universal* automatic API integration: many vendors publish only prose, PDF or SDKs, require interactive auth, or prohibit third-party use.
- No current Trip Ninja SmartFlights sandbox, real supplier account, credential, ticketing or production deployment has been performed by this branch.
- Provider URL host approval and a formal specification are required before automatic contract import. Missing data must remain `unsupported` or `needs review`.
- Visual/desktop/mobile browser QA and a full end-to-end multi-provider product benchmark still determine release readiness.

All external descriptions are data, not executable instructions. Commit-level source attribution is included in each knowledge module. The system-design guidance is independently written and references the CC BY 4.0 source.
