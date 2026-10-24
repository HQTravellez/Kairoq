# Kairoq — Product Requirements Document (PRD)
Version 1.0 · 24 October 2026 · Status: implementation contract

## Product
Kairoq is a conversational full-stack app builder for founders and operators. User describes a working app, shares a screenshot/URL or API documentation, and Kairoq researches, plans, produces an attractive functional application, connects persistent data and authentication where required, tests with real browser actions, repairs failures and publishes a preview and final deployment.

**Promise:** real output, not speculative completion. No "Done" without project files, an executed build, a browser check and a verifiable URL. No AI capability badge without an actual configured backend.

## Nonnegotiable user journeys
1. **Chat:** choose a real available free/local model; write a message; receive a response; restart and keep selection; show provider errors clearly, never obscure content. Test quota failure and recovery.
2. **Research:** paste a public webpage or API docs URL; fetch content using Kairoq-owned browsing, not model browsing; summarize key pages; show sources and access limitations.
3. **Build:** ask "Build a responsive housing enquiry tracker"; plan, edit actual files in an isolated project, generate useful responsive UI, store enquiries, login/logout, list/filter/edit/add/delete, empty/loading/error states and functional navigation.
4. **Verify:** run build and browser test on desktop/mobile with a synthetic customer and real database records; see passing/failing checks and screenshots, feed failing logs to the same agent session, rerun at most three automated repairs.
5. **Deploy:** share working preview, retain versions, safe rollback, prevent destructive migrations and secret leakage.

## Design standards — release blockers
A simple, quiet home: left navigation / project list; central conversation and prominent composer; one model selector with searchable grouped free/local models; explicit Build vs Chat affordance; accessible icon buttons and clear send/stop.
- Use coherent Geist typography, consistent 4/8px spacing, balanced contrast, 12–16px radii, restrained color, no clutter, no decorative technology tags under messages.
- Composer must fit 320px width; status never overlays input; keyboard/focus and screen readers; no horizontal scroll; native touch targets >= 44px.
- Generated apps should have consistent visual hierarchy, polished empty and loading states, purposeful motion, realistic sample data only when labeled, desktop/mobile QA, no placeholder dead buttons.
- Visual acceptance: screenshots at 390x844 and 1440x900; no collisions, clipped controls, or broken flows.

## Architecture
1. **Catalog:** single backend source of truth with stable IDs, provider, exact route, eligible free-tier status, configured/healthy flags, capabilities, last error; frontend only renders available/selectable models.
2. **Inference:** explicit selected model MUST be honored, never silently substituted. Auto mode uses only configured authorized providers (Ollama, Gemini, Groq, NVIDIA, Hugging Face, OpenRouter), bounded failover; no hidden payment. OpenCode's native free access must be verified within its supported client; no assumed keyless external API.
3. **Agent runtime:** isolated workspace per build, least-privilege filesystem, restricted network/commands, session persistence for repair, token/cost/time budgets, approvals for destructive operations.
4. **Execution:** reuse existing Kairoq React/Vite build, app database migration gate, Chromium desktop/mobile QA, regression and rollback.
5. **Artifacts:** project sources, build log, screenshots, user-visible preview URL, recorded check statuses; generated output persists across restarts.

## Delivery order (stop parallel feature additions)
P0: repair runtime errors and basic chat. Working model catalog, explicit free selection, provider authentication/health/quota fallback, honest errors. Remove undefined handlers.
P1: replace cluttered composer/navigation with the clean reusable design system and working primary flows.
P2: one real generated app from prompt, editable files, authenticated CRUD, state retained.
P3: OpenCode execution linked to existing Kairoq build + browser QA + 3 bounded repairs.
P4: publish, version history, rollback, docs/API ingestion and durable knowledge.
P5: broaden integrations, templates, visual effects and agent marketplace only after P0–P4 evidence.

## Definition of DONE — each capability
- Implementation merged, CI checks pass, deployed to testing environment.
- Real connected provider/data source works; no mock substituted for a real integration.
- Browser evidence for desktop and mobile plus error-path checks.
- Logs verify execution, no unexpected charges, no secrets in UI/logs.
- User may perform final acceptance testing; until then status = pending user acceptance.

## Reference benchmark acceptance demo
From fresh login: pick an explicitly named free model; ask for a housing enquiry tracker; agent creates source files and authentication + stored enquiries; user creates/edits/deletes an enquiry and sees data persist; agent repairs an intentionally introduced failing check; browser verifies desktop/mobile; deployment link works after reload. If any step is missing, **do not** claim Lovable parity or release readiness.

## Roles and evidence
Engineering owns implementation and internal verification; user conducts final acceptance. Maintain one issue/PR per acceptance slice; link exact failing test, screenshots and deployment. Product owner approves change to definition of done. No broad "implemented" claims for mocked adapters, unmerged PRs or staged Railway services.

## Known debt to reconcile
Existing branches #141–#146 contain overlapping provider, OpenCode, and selector fixes; reconcile into one tested mainline. A separate OpenCode Railway service is staged without a proven safe auth/workspace connection; do not activate it. Use existing isolated child-process OpenCode engine when verified, or provide secure shared workspace before separate service is made default.
