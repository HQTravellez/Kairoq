# Kairoq API Intelligence & Integration (initial release)

Kairoq can inspect OpenAPI 3.x / Swagger 2.0 JSON, import Postman v2 collections, and infer candidate endpoints from plain-text or HTML documentation. Documentation is untrusted. Inferred endpoints are *drafts* and must be verified against a formal contract before use.

## Server configuration

- `KAIROQ_API_DOC_HOSTS=developer.example.com,docs.example.com` — exact public HTTPS documentation hosts permitted for outbound documentation fetching.
- `KAIROQ_API_HOSTS=api.example.com` — exact public HTTPS API hosts permitted for outbound calls.
- `KAIROQ_API_APPROVED_OPERATIONS=api.example.com:GET:/trips/{id}` — explicit server-owned operation allowlist. Without it, execution is blocked.
- `KAIROQ_API_APPROVED_WRITES=api.example.com:POST:/trips` — separate server-owned write allowlist.
- `KAIROQ_API_TOKEN_VENDOR` — optional server-only Bearer credential; specify the variable name in the execute request. Never place its value in the request or generated frontend.

All requests are HTTPS-only, DNS-checked and IP-pinned, with no redirects, limited payload/response sizes, and timeouts. The endpoints require Kairoq authentication. Execution additionally requires `approved:true`; writes require `approvedWrites:true` and server-side write allowlisting. Approval flags are not a substitute for a production per-user permission system.

## API endpoints

- `POST /api/developer/api/inspect`: `{"apiSpec":{...}}` — parse formal OpenAPI.
- `POST /api/developer/api/discover`: `{"documentationUrl":"https://docs.example.com/openapi.json"}` or `{"documentationText":"GET /trips ..."}` — discover documentation, with the hostname allowlisted.
- `POST /api/developer/api/diff`: `{"before":{...},"after":{...}}` — detect removed endpoints, new required fields and parameters, and field type changes.
- `POST /api/developer/api/execute`: `{"apiSpec":{...},"operationId":"getTrip","pathParams":{"id":"123"},"approved":true}` — execute an explicitly allowed operation through the server-side adapter.
- `POST /api/developer/build`: provide `brief` and `kind:"fullstack"`, optionally `apiSpec`, `apiPlan`, `documentationUrl` or `documentationText` to ground the generated application design in documented API operations.

## Current limitations

This is **not** a universal self-configuring integration platform yet. It does not currently handle OAuth authorization-code flows, API-key-specific header/query placement, GraphQL introspection, gRPC, SOAP, JavaScript-rendered documentation, SDK-only APIs, pagination orchestration, rate-limit retries, webhook signature verification, or automatic scheduled re-learning. The server adapter currently uses optional Bearer tokens only. The adapter is not automatically wired into generated application UIs: the builder generates API-aware designs and requires a separate, approved server integration to make them live.

The drift checker detects breaking contract changes when given old/new specs; it does not yet schedule polling or silently rewrite deployed connectors. Run `node --test test/api-learning.test.js test/api-integration.test.js test/api-evolution.test.js test/complex-products.test.js` locally; Railway also runs these during Docker builds.
