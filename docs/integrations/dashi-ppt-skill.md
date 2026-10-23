# Dashi PPT — optional isolated presentation engine

Upstream: https://github.com/chuspeeism/dashi-ppt-skill

## Commercial licensing gate
Upstream is AGPL-3.0; the HTML-to-PPTX export subpackage has additional proprietary restrictions. Do **not** vendor its source into Kairoq or deploy its server as part of the Kairoq SaaS without legal review and an appropriate commercial agreement or a documented AGPL compliance plan. Treat all source and user documents as sensitive.

## Integration design
- Kairoq routes user requests for slides, presentations, pitch decks, PPTX or editable deck to an optional `presentation` provider.
- The Dashi provider is disabled by default. A separate approved worker must be explicitly configured, deployed and licensed before execution.
- Provider inputs: tenant-scoped source document references, audience, slide count, brand palette, desired output formats.
- Provider outputs: job ID, artifact URLs, export metadata and verified QA results. Validate every returned URL and enforce tenant access.
- Do not shell-execute `npx ...@latest` from the Kairoq web server. Pin reviewed versions and run in isolated workers with CPU, memory, network and execution-time limits.
- Chrome/Chromium is required for PDF/PPTX exports. Verify that exports contain editable elements rather than flattened screenshots.
- Keep Kairoq's existing independent presentation generator as fallback.

## Acceptance gates
1. License and proprietary export rights approved.
2. Worker deployed separately with tenant auth, quotas, timeouts, and secure artifact storage.
3. End-to-end sample: 10-slide PlanURstay proposal, HTML/PDF/editable PPTX export.
4. Visual checks, page overflow, accessibility, cross-tenant isolation, and failure recovery.
5. Only then enable provider in production.

This commit registers an optional integration boundary, not an installed or functioning Dashi worker.
