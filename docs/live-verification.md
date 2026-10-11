# Real-input verification — 2026-10-10

No GitHub commits, pushes, or Railway changes were made.

## Official Sabre collection

Source: https://github.com/SabreDevStudio/postman-collections

Checked revision: `2fabd22d831fa84b7b910b5e140bf38332602ddf`

File: `Booking-Management/Booking_Management_API_v2_2026.08.postman_collection.json`

The actual collection contains 1,644 request examples and is 4,545,133 bytes. Direct upload exceeds the current 400 KB limit. Postman ingestion previously silently discarded requests after the first 150; it now rejects oversized collections with an explicit instruction to split them. Four focused tests passed, including the new truncation regression test.

This is not yet complete Sabre support. The importer extracts operation metadata, but does not preserve Postman request bodies, response examples, variable resolution, or authentication flows. Complete orchestration requires those features and unambiguous operation IDs; response examples also cannot be treated as authoritative required-field schemas. Simply increasing the upload limit would not fix these gaps.

## Actual AI generation attempt

Called the local server's actual `callDeveloperCodingModel`, without a fixture. It failed with: `No local model is available. Start Ollama/llama.cpp or set LOCAL_LLM_MODEL.`

No OpenRouter, EXP Labs, or Sabre credentials are configured in this workspace. Therefore a real model-generated end-to-end build and authenticated Sabre execution have not passed. Existing simulated tests do not count as proof of either.

Next requirements: a configured local model or server-side AI provider; complete, scoped Sabre contract ingestion and authentication support; then real generation, browser verification, and authenticated sandbox execution. Keep booking writes separate from read-only verification and require explicit confirmation through the workflow controls.
