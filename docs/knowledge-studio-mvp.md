# Knowledge Studio MVP

Implemented: isolated in-memory text/Markdown/HTML/JSON ingestion, SHA-256 source fingerprint, version metadata, chunk-level retrieval, source excerpts, list/delete and tests. Entry point: `knowledge-studio.js`.

This is an **unwired library prototype**, not an operational user-facing feature. Data is lost on process restart. No uploaded PDF/DOCX/EPUB support yet. No API endpoints or UI yet.

## Required before release
- Persistent tenant-scoped database/storage and authentication enforcement at request boundary.
- Secure multipart upload with file sniffing, size limits, antivirus, extraction sandbox and file quotas.
- PDF/DOCX/EPUB parsing with page/section citations; review/pin upstream book-to-skill.
- Skill compilation and quality evaluation; distinguish retrieved documentation from instructions.
- Version updates, rollback, permissions and deletion.
- Safe OpenAPI/Swagger parsing, SDK generation, credentials vault and provider sandbox contract tests.
- UI for upload, library, search, source preview and status; browser/mobile accessibility QA.
- Prompt injection, cross-tenant, persistence and end-to-end benchmark tests.
- Wire to Kairoq agent orchestration and test the full path before merge/deploy.
