# Book-to-Skill knowledge ingestion for Kairoq

Official upstream: https://github.com/virgiliojr94/book-to-skill (MIT for converter, not input materials).

## Objective
Enable users to turn authorized PDF, EPUB, DOCX, HTML, Markdown and other technical documents into versioned, reusable, on-demand Agent Skills for Kairoq. Use for API documentation, engineering references, internal runbooks and product specifications.

## Proposed pipeline
1. Upload or select authorized source documents. Validate file type, size, copyright/redistribution rights and provenance.
2. Extract text in a sandboxed worker using a reviewed and pinned upstream revision; never execute embedded document instructions.
3. Generate structured SKILL.md, per-section references, glossary and patterns, retaining document/page provenance.
4. Validate generated skills for formatting, accuracy, prompt injection and unsupported assertions. Keep third-party copyrighted skills private.
5. Register in Kairoq's skill catalog with source version, permissions, owner and explicit activation scope.
6. Retrieve only relevant sections for an agent request; cite source passages and disclose gaps.
7. For API integrations, separately parse OpenAPI/Swagger when available, produce SDK/auth adapters, and run contract and sandbox tests. A knowledge skill alone is not a functional connector.
8. Support incremental updates, diffing and rollback when documents change.

## Security warning
The official upstream warns of a malicious unaffiliated re-upload at Leutenegger/book-to-skill. Never use it. Verify origin and review/pin source before running any installer or extraction script. See upstream SECURITY-NOTICE.md.

## Verification gates
- PDF, DOCX and Markdown fixture conversion tests.
- Source provenance and retrieval correctness tests.
- Adversarial prompt-injection tests and access-control isolation.
- Benchmark token consumption and answer quality against direct document retrieval.
- Real API integration validation for one sample provider.

This document is an integration plan, not a claim of runtime installation, execution or passed tests.
