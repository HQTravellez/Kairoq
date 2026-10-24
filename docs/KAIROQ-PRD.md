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

## Competitive positioning: integration-first app builder
Kairoq must not claim that reading API documentation alone is unique. Lovable ships reusable custom connectors; Pipedream and Composio offer existing integration/auth infrastructure. Instead differentiate through the entire **documentation-to-verified-business-application** lifecycle.

**Hero feature: Integration Studio**
- Ingest HTML documentation URLs (including linked pages and versioned docs), OpenAPI JSON/YAML, Postman collections, MCP server descriptions and a GitHub repository. Use provenance and last-verified timestamps.
- Parse auth and environment requirements, endpoint parameters, pagination, rate limits, webhooks, error codes, idempotency and billing caveats; present a reviewable spec with uncertainties.
- Obtain credentials via secure per-workspace vault (never log secrets); classify read/write/destructive operations; require approval to perform real external writes.
- Run schema checks and authorized sandbox requests; save request/response shapes after redaction, evidence, exact endpoints, and test status. Never mark an untested API as 'working.'
- Generate typed client, server-side proxy/routes, UI screens, relevant storage schema and integration tests for actual user flows.
- Use existing build/QA agent to detect failures, repair code using the same project context, and show before/after evidence.
- Retain reusable versioned provider knowledge, sandbox behavior, auth recipes and safe regression cases for future projects, isolated by organization/project.
- Expose clear lifecycle statuses: Imported → Parsed → Credentials needed → Sandbox verified → App generated → Browser verified → Published.
- First vertical: travel/housing workflows with search, inventory, booking/enquiry and account management; generic API support expands only after one complete vertical passes.

**Design implication:** Three clear top-level areas only: Create, Integrations, Projects. Advanced controls remain in context-sensitive panels, not permanently crowded into the chat composer.

**Acceptance demo:** paste a public OpenAPI document, inspect parsed operations and auth, connect authorized sandbox key, execute one GET and one safely approved write operation, generate a UI backed by those calls, verify in Chromium, simulate one API error and confirm user-facing recovery, then save reusable connector knowledge. Missing sandbox credentials must yield a transparent blocked status, not fabricated success.

## Business model: affordable agent + revenue-bearing builder (proposal, not launched)

### Two products sharing a common engine
- **Kairoq Agent:** persistent, tool-using assistant, conversational search, personal/workspace memory, website research, recurring tasks, skill packs, tool integrations. Available on Free and paid plans, with explicit limits and permission gates.
- **Kairoq Studio:** premium app creation, project previews, visual editing, API Integration Studio, build/test/repair jobs, deployments and team workspaces. Meter resource-heavy compute separately.

### Proposed pricing (USD, subject to cost validation)
| Tier | Price | Included | Control |
| Free | $0 | basic chat, free/BYOK models, single project, basic docs import | strict concurrency and fair-use limits; no guaranteed unlimited inference |
| Starter | $12/month | saved memory, basic agent tools, 3 projects, bounded build credits | hard monthly spend cap and usage dashboard |
| Pro | $29/month | advanced design studio, API research, 10 projects, build credits | published price per extra build/credit |
| Team | $79/month + usage | shared projects, connectors, versioned knowledge, team approvals | org-level caps and audit logs |
| Business | custom | private deployment, enterprise security, dedicated integration support | contracted usage and SLO |

A BYOK model mode must let customers configure their own supported inference providers. Platform-paid models, browser automation minutes and sandbox compute are separate metered costs; disclose price before any billable action. No unlimited agent execution on the free tier.

### Monetization and cost safeguards
- Revenue: subscriptions, incremental build/test credits, hosted previews, managed connector subscriptions, verified connector templates and enterprise deployment/support.
- Costs: model tokens, hosting/compute, browser QA minutes, egress, deployment environments, storage, support, payment processing. Establish actual unit costs and minimum positive contribution margin before public pricing.
- Each job has an estimated price, hard budget limit, maximum repair loops and cancellation. Show source of charge. No implicit fallback from free/local to paid inference.
- Never promise that Hermes' subscription figures imply profitability or that its publicly reported prices demonstrate revenue; actual company revenue is not publicly verified.

### Launch gates
1. Free chat, exact model selection and basic tools reliably work.
2. One complete real app build+repair+deploy passes with evidence.
3. Cost ledger meters per-model, per-browser-run and per-build resource use.
4. Payment/billing gates enforce user approval, caps, cancellations and retries without double charges.
5. Only then launch public paid plans.

### Metrics
Activation = user successfully sends 3 messages and creates a verified app preview. Core conversion = 7-day users completing a real API-connected workflow. Track first-build success, repair success, latency p95, cost per accepted project, churn, paid conversion, and contribution margin by tier.
