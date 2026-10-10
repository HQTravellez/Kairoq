# Kairoq v16 — AI Sales Agent + AI Marketing Agent

Kairoq now surfaces two outcome-focused workers first, while keeping the existing Studio underneath.

## AI Sales Agent

The Sales Agent owns the path from **account → evidence → qualification → personalized outreach → follow-up state**. It can discover timing signals from public news, accept manual accounts/domains, crawl public company pages, keep the source evidence on the lead, score readiness, and draft outreach without inventing facts. A batch **Research & prepare** action researches and prepares multiple leads in one run. Sending is consequential: Kairoq requires explicit approval and uses the connected Gmail or Microsoft Outlook account.

OpenEnrich is now bundled at a pinned upstream commit with its source and AGPL-3.0 license in `vendor/openenrich`. Enrichment uses only the free website/pattern providers, a zero-dollar budget, and no SMTP probing. Published email evidence can populate a missing contact; an unverified pattern remains a suggestion and is never automatically selected. Domain knowledge persists under the Railway volume's workspace.

Use **Import real prospects** to upload or paste an OpenOutFind CSV/JSONL export (up to 500 records / 1 MB). The importer retains profile evidence, deduplicates contacts, and sets every new prospect to `new`; imported qualifications and outreach drafts are not trusted. Imported email addresses are labeled unverified. No model call or sending occurs during import.

OpenOutFind was inspected at commit `a7a2e08653bbc7757eb850a81db9c8db2e363c48`. Its default runtime contributes discovered profiles and resolved contacts to `hub.openoutreach.app`. Kairoq supports its export format but does not run that sharing client. Autonomous licensed contact discovery is not yet connected; **Find public signals** remains a news research action. A provider key and a privacy-reviewed discovery implementation are required for live contact discovery.

Source and license for the bundled enrichment component: https://github.com/HQTravellez/Kairoq/tree/main/vendor/openenrich . See `vendor/openenrich/UPSTREAM.md` for reproducible source/build details.

## AI Marketing Agent

The Marketing Agent owns **strategy → content calendar → draft → editorial review → media → approved publishing**. Give it the audience, offer, goal, voice, channels, and content pillars. It generates platform-native LinkedIn / Instagram / X variants, then performs a second editorial pass to remove generic AI language, repetition, hype, and unsupported claims.

Every content item also carries an image prompt and video prompt. **Generate image** and **Generate video** route through Kairoq's existing media stack, so a local/free route such as Wan2GP can be used when available. Higgsfield and the other configured providers remain available through the Studio router.

For publishing, set `POSTIZ_API_KEY` locally or in Railway. Kairoq reads the connected Postiz channels and can schedule an approved item to one or more of them. If that item has a generated image or video, Kairoq first uploads the asset through Postiz's media-upload API and attaches the Postiz-hosted media to the scheduled post; if that upload fails, Kairoq stops instead of silently publishing text only. Instagram posts receive the required `post_type=post` default. Publishing is approval-gated; no post is scheduled merely because content was generated. Postiz is used through its public API rather than copying its open-source code.

### v16 environment additions

```env
POSTIZ_API_KEY=
POSTIZ_API_BASE=https://api.postiz.com/public/v1
```

`POSTIZ_API_KEY` is optional. If omitted, Marketing still plans, writes, reviews, and generates media; only social scheduling is unavailable.

### What is deliberately not automated without approval

Cold email sending and social publishing change external state. They stay behind explicit approval even when the agents are running autonomously. Lead research, scoring, content planning, editorial review, and draft/media generation can run automatically.


## Local Wan motion for Tour Builder

Tour Builder can now use **Local Wan** instead of Higgsfield for room motion. This is intended for drafts, testing, and cost control. Start Wan2GP locally and set:

```env
WAN2GP_BASE_URL=http://127.0.0.1:7860
WAN2GP_TOUR_IMAGE_TO_VIDEO_MODEL=i2v-1-3B
```

For lower-memory hardware, the WanGP documentation recommends the 1.3B family for low-VRAM use. The Tour Builder passes the real source photo into the local image-to-video route and reuses each generated room clip across the interactive tour, 16:9 walkthrough, and 9:16 Reel. Higgsfield remains available as the premium cloud engine.

The exact Gradio API name can vary by WanGP version. Kairoq discovers named Wan2GP endpoints at runtime and attempts to match the configured `WAN2GP_TOUR_IMAGE_TO_VIDEO_MODEL`; if your installed build exposes a different name, set that exact API name in `.env.local`.
## v15.7 — Premium AI Tour

The Tour Builder now has an optional **Premium AI Motion** layer powered by the official server-side Higgsfield SDK and `bytedance/seedance-2.5/image-to-video`. One real source photo is selected per room (up to six by default), Seedance creates subtle motion while prompts explicitly forbid changing room geometry, furniture, objects, windows, views, proportions, or layout, and Kairoq reuses the same generated room clips in three places:

- **Premium 16:9 walkthrough**
- **Premium 9:16 Reel**
- **Room motion playback inside the Interactive Tour**

Branded intro/outro cards are rendered deterministically by Kairoq/ffmpeg rather than generated, so logos/CTA text remain accurate and do not consume extra AI generations. The UI always asks for confirmation before starting the billable Higgsfield batch.

Premium image-to-video requires both `HF_CREDENTIALS` and a public HTTPS `SITE_URL`, because Higgsfield must be able to fetch the real property photos. `localhost` is intentionally blocked for the premium action; deploy Kairoq or use a secure HTTPS tunnel. Credentials remain server-side.

`Rebuild premium exports` reuses the already-generated room clips and does **not** make new Higgsfield generations.


## v15.6 — Interactive Tour Builder

Studio now includes **Tours** for truth-preserving property presentation from real photos. Upload up to 30 photos, assign/reorder rooms, choose a cover, and create any of four independent outputs:

- **Interactive Tour** — clickable room-by-room share page with guided-tour mode
- **Walkthrough Video** — 16:9 MP4 rendered only from supplied photos
- **Vertical Reel** — 9:16 MP4 rendered only from supplied photos
- **Enhanced Gallery** — polished share page / gallery experience

A complete sample tour built from the supplied apartment photos is included, with Living Area, Kitchen, Bedroom, Bathroom and Laundry groups. No room geometry, furniture, views or amenities are invented. Videos are deterministic photo renders and require `ffmpeg` on the host for new exports (`FFMPEG_PATH` can override the binary path). The included sample video/reel are pre-rendered.

# Kairoq v15.6 — ArrivalBrief

ArrivalBrief turns verified booking/arrival details and real reference photos into a private mobile guest guide. It saves the brief, creates a shareable no-index page, tracks “I’m settled in” acknowledgement, and keeps the optional Higgsfield Seedance 2.5 welcome clip as a separate explicit billable action. The Higgsfield prompt intentionally excludes guest names, addresses, unit numbers, access codes, and Wi-Fi credentials.

**Important:** ArrivalBrief links can contain sensitive access information. Treat them as private, use HTTPS in deployment, rotate/delete links after stays, and do not put secrets into the optional AI welcome clip.

# Kairoq v15.4 — Pursuit Agent + Listings Pro

## New: Pursuit Agent
- Scans public news signals for events that can create temporary-housing demand.
- Scores signals such as contract awards, project mobilization, office expansion, hiring, relocation, intern/group programs, and displacement events.
- Keeps source evidence with each opportunity.
- Builds an evidence-based pursuit brief using the local/free LLM route when available.
- Generates verification questions, positioning, next action, and draft outreach without inventing headcount, budgets, contacts, or housing demand.
- Tracks New → Researching → Outreach → Follow-up → Qualified → Won/Lost.
- Discovery is read-only. Sending outreach remains outside this workflow and must use Kairoq's existing approval-gated messaging/email tools.

### Important
The discovery endpoint requires normal internet access from the machine running Kairoq. The build environment used to package v15.4 blocks outbound DNS, so the live public-news discovery request could not be completed here; scoring/UI/server routes were verified and the full automated suite passes (51/51).

# Kairoq v15.4 — Listings Pro

This build promotes the Listing-to-Sales Engine into three primary workflows:

- **Make Sales Ready** — verified copy + amenity highlights + neighbourhood copy + branded property-sheet PDF.
- **Create Property Video** — truthful image-to-video property Reel + 16:9 overview, preferring Higgsfield when configured.
- **Create Client Proposal** — PlanURstay-branded PDF with client/guest/stay details and the selected property.

The default listing brand profile is PlanURstay and can be overridden with `LISTING_BRAND_*` environment variables. Generated property-video prompts explicitly prohibit invented rooms, furniture, views, renovations, amenities, or material property changes.

# Higgsfield Seedance 2.5 SDK setup

This build includes a server-side TypeScript smoke test using the official `@higgsfield/client` v2 SDK and `bytedance/seedance-2.5/text-to-video`.

1. Run `npm install`.
2. Open `.env.local` and replace the placeholder with your own `KEY_ID:KEY_SECRET` value for `HF_CREDENTIALS`. Never paste the credential into chat or commit `.env.local`.
3. Run `npm run higgsfield:seedance`. This makes a billable 5-second 720p 16:9 Seedance 2.5 generation request and prints only the completed video URL.
4. The example exits non-zero for missing credentials, failed/canceled/moderated generations, or a completed response without a video URL.

The main Kairoq server also accepts the official `HF_CREDENTIALS` variable while preserving the older Higgsfield environment names for compatibility.

# Kairoq v15.1 — Listing-to-Sales Engine

Adds **Kairoq Listings** inside Studio. Paste a property URL or upload property photos, save the property permanently, then generate a reusable sales pack: factual furnished-housing copy, amenities, neighbourhood text from verified facts only, email-ready content, proposal intro, property-sheet PDF, and property video/Reel through the configured media router (Higgsfield-first when configured in Best mode).

New endpoints: `GET /api/listings`, `POST /api/listings/save`, `POST /api/listings/import-url`, `POST /api/listings/generate-pack`.

# Kairoq Studio V1

This build adds a Studio V1 experience inside Kairoq with:

- Create (text→image, image→video, text→video)
- AI Avatars
- Talking Avatar
- UGC Creator
- Projects + History
- Prompt Library
- Cost preview before generation

Open the app, click **Studio**, and start creating.

## New API endpoints
- `GET /api/studio/status`
- `GET/POST /api/studio/avatars`
- `GET/POST /api/studio/projects`
- `GET/POST /api/studio/library`
- `GET /api/studio/history`
- `POST /api/studio/estimate`
- `POST /api/studio/generate`

# My Private AI — Production-Hardened Build

This is the consolidated build of the personal AI workspace.

## What is now included

The platform now has:

- multi-model OpenRouter chat
- global + project + conversation memory
- optional Supabase cloud synchronization
- tool-calling agents
- specialist agent delegation
- Gmail + Google Calendar
- GitHub
- Nuitee / LiteAPI hotel search
- Slack read/send tools
- Shopify read tools
- Browserless rendered browsing + approval-gated browser agent
- scheduled recurring bots
- retries and dead-letter handling
- audit logging
- per-tool Auto / Ask / Deny permissions
- encrypted persisted OAuth credentials
- webhook notifications
- rate limiting
- daily/monthly AI cost governors
- approval gates
- automated tests

## Important security setup

For production, set a stable encryption key:

```bash
openssl rand -hex 32
```

Put the result in `.env`:

```env
APP_ENCRYPTION_KEY=...
```

Do not rotate this value casually. Existing encrypted OAuth tokens need the same key to decrypt.

Environment variables themselves remain protected by your deployment platform. The app-level AES-256-GCM layer protects credentials that the application persists, such as Google refresh tokens.

## Cost controls

Defaults:

```env
DAILY_COST_LIMIT_USD=5
MONTHLY_COST_LIMIT_USD=50
REQUESTS_PER_MINUTE=30
MAX_AGENT_TOOL_LOOPS=8
MAX_DELEGATIONS=2
```

Change these to suit your account.

OpenRouter usage is requested in responses and recorded in the app usage ledger when supplied by the provider. OpenRouter documents `usage: { include: true }` for receiving cost/token usage in responses.

## Per-tool permissions

Open **Security & Ops** in the sidebar.

Every tool can be set to:

- **Auto** — the agent may execute it without asking.
- **Ask** — execution pauses for your approval.
- **Deny** — the tool is blocked.

Consequential defaults such as Gmail send, Calendar create, Slack send, workspace writes, GitHub issue creation, and browser-agent tasks are set to **Ask**.

Scheduled/background bots can only use tools configured as **Auto**.

## Job reliability

Scheduled bots now have:

- up to 3 attempts by default
- exponential backoff
- status/history
- dead-letter retention after final failure
- completion/failure notification hooks
- audit events

## Audit log

The audit trail records important events such as:

- tool executions
- denied actions
- approvals
- job attempts/failures
- job completion
- permission changes
- notifications
- OpenRouter errors

Sensitive keys/tokens/password fields are redacted before logging.

## Browser automation

Optional configuration:

```env
BROWSERLESS_URL=https://production-sfo.browserless.io
BROWSERLESS_TOKEN=...
```

Two tools become available:

- `browser_render` — read-only rendered HTML for JavaScript-heavy pages.
- `browser_agent_task` — managed browser automation that can navigate/click/type and defaults to **Ask** approval.

Browserless currently documents `/content` for rendered browser HTML and `/agent/run` for its managed browser agent.

## Slack

```env
SLACK_BOT_TOKEN=xoxb-...
```

Tools:

- read recent channel history — Auto by default
- send a channel message — Ask by default

Use a Slack bot token with only the scopes you actually need.

## Shopify

```env
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_TOKEN=...
SHOPIFY_API_VERSION=2026-07
```

Current tools are intentionally read-only:

- list products
- list recent orders

Write operations should be added individually and default to Ask.

## Notifications

Set one delivery webhook:

```env
NOTIFY_WEBHOOK_URL=https://...
```

Completed and failed scheduled bot runs can post a JSON notification to that destination.

## Multi-agent delegation

The main agent can call `delegate_agent` for bounded research, coding, business, writing, or general subtasks.

Delegated agents:

- share relevant memory
- have bounded tool loops
- cannot silently execute approval-required tools
- respect the same tool permission system
- are capped by `MAX_DELEGATIONS`

## Google OAuth

Enable Gmail API and Google Calendar API in Google Cloud and create a Web Application OAuth client.

Local redirect URI:

```text
http://localhost:3002/api/google/callback
```

Configure:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3002/api/google/callback
```

Google uses server-side OAuth with offline access so the server can retain a refresh token and obtain new access tokens when needed.

## Nuitee

```env
NUITEE_API_KEY=...
```

The agent exposes live hotel search, not autonomous booking. A booking flow should remain a dedicated transaction UI with explicit traveller, cancellation, payment, and final-confirmation controls.

## Run locally

```bash
cd ~/Downloads
unzip -o openrouter-private-ai-production.zip
cd openrouter-private-ai-production
cp .env.example .env
nano .env
node server.js
```

Then open:

```text
http://localhost:3002
```

## Tests

Run:

```bash
npm test
npm run check
```

The tests cover:

- encrypted credential round-trip
- audit redaction
- workspace sandbox path protection
- default tool permission safety
- model capability detection
- schedule calculation
- actual server startup + `/health`

## Production hosting

A persistent host such as Railway is preferred for the built-in scheduler.

If using a serverless platform, move recurring scheduling to that platform's cron system instead of relying on the in-process minute timer.

## Practical production note

This build is substantially hardened, but connecting a high-value production account still requires operational discipline:

- least-privilege OAuth/API scopes
- backups
- secret rotation procedures
- monitoring
- real connector sandbox testing
- controlled deployment changes

Do not give any agent unrestricted payment, booking, shell, or arbitrary filesystem privileges.


## Atlas Agent Team

| Icon | Agent | Role |
|---|---|---|
| ◆ | **Atlas** | AI Operations Lead |
| ◉ | **Scout** | Research & Intelligence |
| ⬢ | **Forge** | Engineering |
| ⇄ | **Relay** | Communications |
| ◎ | **Orbit** | Calendar & Scheduling |
| ◇ | **Compass** | Travel Operations |
| ▣ | **Ledger** | Finance & Spend |
| ✦ | **Beacon** | Monitoring & Bots |
| ⬡ | **Vault** | Memory & Knowledge |
| △ | **Rover** | Browser Operator |
| ✎ | **Writer** | Writing & Documents |
| ➤ | **Closer** | Sales & Follow-up |
| ◈ | **Guardian** | Security & Governance |

Atlas is the default AI Operations Lead and can delegate bounded subtasks to the specialist team. Legacy agent IDs remain supported server-side for older saved jobs.


## Single Mascot Identity

v12.2 uses **one mascot image only**:

```text
public/assets/mascot-ghost.png
```

All agents share the same mascot. Agent identity is applied through color, name, and animation state instead of separate prop-based character images.

### Agent colors

| Agent | Color |
|---|---|
| Atlas | Pearl |
| Scout | Sky blue |
| Forge | Indigo |
| Relay | Cyan |
| Orbit | Lavender |
| Compass | Orange |
| Ledger | Emerald |
| Beacon | Yellow |
| Vault | Purple |
| Rover | Electric blue |
| Writer | Pink |
| Closer | Green |
| Guardian | Deep blue |

### Mascot states

The UI supports:

```text
idle
listening
talking
thinking
working
waiting
success
error
```

These are CSS animation states applied with `data-state`, so the app can animate the same character without using separate image files.


## v12.3 Product Finish

This release adds the usability layer that makes the app feel like a product instead of only a technical prototype.

### Added

- First-run onboarding
- Agent templates
- Scheduled bot templates
- Company Playbook
- Workflow cards
- Demo mode
- Vertical modes:
  - Personal AI OS
  - Travellez Mode
  - PlanURstay Mode
  - Shopify Store
  - Sales Team
  - Software Team

### Company Playbook

The Company Playbook stores durable operating rules such as:

- company overview
- tone of voice
- approval rules
- travel policy
- housing policy
- preferred suppliers
- pricing rules
- escalation rules
- things never to do

Atlas and scheduled bots include this playbook as context.

### Demo mode

Demo mode lets you show the product safely without connecting real accounts. It uses sample workflow cards and demo-safe prompts.

### Workflow cards

Agent runs, scheduled bots, templates, and playbook updates can create workflow cards, giving the product a visible work queue rather than only a chat transcript.


## v12.3.1 Hotfix

OpenRouter accepts at most 3 entries in the `models` fallback array. This release caps all fallback arrays to 3 total models to prevent the error:

```text
'models' array must have 3 items or fewer
```


## v12.4 Premium UI Hotfix

This version fixes the modal overflow issue where content could be cut off on the left side.

### Added

- Centered, viewport-safe dialogs
- No horizontal overflow in modal content
- Premium card styling
- Cleaner Atlas & Team layout
- Better responsive grids
- Security & Ops table/layout cleanup
- Cache-busted app script version


## v12.5 Sticky Chat Composer

This version fixes the chat UX so the composer/input box stays fixed at the bottom of the chat area while the message thread scrolls independently.

### Fixed

- Long responses no longer push the input box down
- The main page no longer scrolls unexpectedly
- Message area scrolls like ChatGPT/Claude
- Composer stays visible during streaming
- Code blocks scroll internally instead of widening the page


## v12.6 Native Image Generation

This version adds real image generation through fal.ai.

### Setup

Add this to `.env` locally or Railway Variables in production:

```env
FAL_KEY=your_fal_api_key
IMAGE_MODEL=fal-ai/flux/dev
```

The app keeps the fal key server-side and exposes a local endpoint:

```text
POST /api/images/generate
```

### UI

Use the 🎨 Image button in the composer, or type prompts such as:

```text
Create a photorealistic portrait of Nia Vale...
Generate an Instagram ad image for...
Make a premium mascot illustration...
```

The generated image appears directly in the chat.


## v12.7 Unified Media Router

Media generation is no longer tied to fal.ai.

### Images

Default routing:

```text
OpenRouter → Pollinations → fal.ai
```

OpenRouter uses the same `OPENROUTER_API_KEY` already used for chat.

Default generation model:

```text
bytedance-seed/seedream-4.5
```

Image editing uses:

```text
google/gemini-3.1-flash-image
```

Attach an image, click the image button, and describe the edit.

### Video

Video uses Pollinations when `POLLINATIONS_API_KEY` is configured.

Default:

```text
bytedance/seedance-2.0-fast
```

For image-to-video, attach an image, click the video button, and describe the motion. The server uploads the reference image to Pollinations media storage, then passes it as the start frame.

### Important cost note

The application does not label media generation as "free." Provider/model costs and free allowances change. OpenRouter currently has no `:free` image generation model, and Pollinations generation requires an authenticated key. Keep provider budgets/limits configured.


## v12.8 Open-Model Media Stack

The app is now ready to prefer your own GPU server.

### Preferred media routing

```text
IMAGE
Qwen self-hosted
  ↓ fallback
OpenRouter
  ↓ fallback
Pollinations
  ↓ fallback
fal.ai

VIDEO
Wan self-hosted
  ↓ fallback
Pollinations
```

### What changes when you rent a GPU

Set:

```env
SELF_HOST_MEDIA_BASE_URL=https://your-gpu-server.example.com
SELF_HOST_MEDIA_API_KEY=your-private-server-key
```

The GPU server should expose:

```text
POST /v1/images/generations
POST /v1/images/edits
POST /v1/videos/generations
```

The Private AI app does not need another code change.

### Models

```env
QWEN_IMAGE_MODEL=Qwen/Qwen-Image
QWEN_IMAGE_EDIT_MODEL=Qwen/Qwen-Image-Edit
WAN_VIDEO_MODEL=Wan-AI/Wan2.2-T2V
WAN_IMAGE_TO_VIDEO_MODEL=Wan-AI/Wan2.2-I2V
```

### User experience

Image prompt:

```text
Create a luxury product photograph of a black watch on marble.
```

The chat renders the generated image directly.

Image edit:

1. attach an image
2. click the image button
3. write the edit instruction

Example:

```text
Keep the person identical but change the jacket to navy blue.
```

Video prompt:

```text
Create a cinematic 5-second clip of a futuristic Toronto skyline at night.
```

Image-to-video:

1. attach an image
2. click the video button
3. describe motion

Example:

```text
Animate the character waving, blinking and gently floating.
```


## v12.9 Command Center

Chat is no longer the homepage.

The default experience is now the **Command Center**, while the Atlas composer remains fixed at the bottom and can accept a task from anywhere.

### Command Center shows real app state

- workflows needing attention
- active workflow count
- enabled scheduled bots
- configured/connected apps
- retained automation failures
- recent agent activity
- AI team launchers
- quick-start tasks

### Universal command experience

Typing into the composer from the Command Center automatically opens the full chat thread when the task is sent.

Examples:

```text
Review my important emails and draft replies.
Find hotels for my Chicago trip next Tuesday.
Create an Instagram image for this product.
Animate this image into a short video.
Research this competitor and tell me what changed.
```

The conversation remains available as a full ChatGPT-style chat, but it is now the control interface for a wider operating system rather than the entire product.


## v13.0 Atlas-First Experience

This build shifts the product closer to an Instinct-style experience:

- one visible operator on the surface: **Atlas**
- simpler default shell (`Simple mode`)
- advanced controls available only when you want them
- connected capabilities shown as plain abilities instead of technical tools
- a spend control mode so Atlas can prefer free or cheaper generation routes

### Spend modes

- **Free first** → prefer free/community/self-host routes
- **Cheap first** → prefer the cheapest route that is likely good enough
- **Balanced** → trade off speed, cost, and quality
- **Best quality** → prefer the strongest route

This is a UX layer first. Existing generation providers continue to work, while Atlas now presents itself more like one assistant than a dashboard full of knobs.


## v13.1 Atlas Execution Layer

This build makes Atlas more action-oriented and reachable outside the web app.

### Atlas Anywhere

- Telegram bot webhook + replies
- WhatsApp inbound/outbound through Twilio
- SMS inbound/outbound through Twilio
- incoming messages run Atlas with read-only tools
- consequential requests create an approval-needed workflow rather than silently acting
- outbound messages from the full Atlas agent use an approval-gated `message_send` tool

Telegram's Bot API has no ordinary per-message API charge. WhatsApp/SMS provider fees still apply.

### Higgsfield

Optional Higgsfield media routing is included. It stays out of `Free first` mode. `Best quality` can put Higgsfield first, while `Cheap first` tries lower-cost/self-hosted routes before it.

### Action UX

The previously incomplete approval event handling is now surfaced as a real approval card with Approve / Deny, a human-readable action name, and the exact payload. Tool requests/results also appear as activity steps rather than disappearing behind a final text answer.


## v13.2 — Atlas Finish It

This version introduces **Open Loops**, a persistent outcome layer.

Atlas can now keep track of unfinished real-world outcomes such as:

- refunds and payments still owed
- promises to send or follow up
- deadlines and renewals
- waiting dependencies
- unresolved travel/customer/operational issues
- approvals that still need action

An open loop is not considered finished just because Atlas sent a message. It should close only when the desired real-world outcome is actually verified.

### New APIs

```text
GET  /api/loops
POST /api/loops/create
POST /api/loops/update
POST /api/loops/extract
```

### New agent tools

```text
list_open_loops
create_open_loop
update_open_loop
```

These mutate only internal Atlas state, not external systems, so they can safely be used by monitoring/scheduled agents.

### Cheap-first detection

The explicit “What am I forgetting?” / “Scan current chat” action uses `openrouter/free` by default to find a small number of high-value unfinished outcomes rather than scanning every turn with a paid model.

### Scheduled Open Loop Sweep

A new daily template can inspect read-only sources such as Gmail and Calendar and create/update internal loops. Consequential actions still require approval.


## v13.3 — Atlas Commerce Operator

Atlas can now turn one store request into a real store-building workflow instead of merely outputting copy.

### Experience

Example:

> Build me a premium anti-aging Shopify store with a clean clinical-luxury feel.

Atlas can:

1. create a complete store concept
2. generate a browser preview
3. structure the brand, hero, products, collections, pages, pricing and visual direction
4. show the preview before Shopify is changed
5. after approval, create Shopify products as **DRAFT**
6. create collections
7. create pages as **UNPUBLISHED**
8. track the unfinished launch as an Atlas Open Loop
9. optionally apply the generated homepage overlay to a **NON-LIVE** Shopify theme

This intentionally does **not** publish the live store automatically.

### Important product/supplier rule

If Atlas does not have a real supplier URL, CSV, catalog, or other verified source, it must treat the products as concept/draft products. It should not claim invented supplier details, reviews, medical claims, or fulfillment facts are verified.

### Shopify scopes

Catalog creation requires the appropriate Shopify Admin API scopes such as `write_products`. Page creation requires `write_content` or `write_online_store_pages`.

Theme editing is different: Shopify currently requires `write_themes` **and Shopify's required exemption** for theme-file mutations. Therefore:

```env
SHOPIFY_THEME_WRITE_ENABLED=false
```

Leave this false unless your Shopify app has the required access. Atlas will still create the full local preview and Shopify draft catalog/pages without theme-file access.

When enabled, Atlas refuses to modify a theme whose role is `MAIN`. Apply the overlay to a duplicate/unpublished theme and review it first.

### New agent tools

```text
create_store_concept
shopify_apply_store_draft
shopify_list_themes
shopify_apply_theme_overlay   # only exposed when explicitly enabled
```

The first tool is internal and safe. Shopify write tools are approval-gated.


## v13.4 — Commerce Autopilot

The Shopify workflow now continues after store creation.

### Live store health

Atlas can inspect live Shopify catalog/order data and calculate a read-only operational health snapshot:

- recent order count
- gross order value
- refunds
- net value after refunds
- average order value
- fulfillment attention
- payment attention
- active product count
- out-of-stock products
- missing product imagery
- weak/missing descriptions
- invalid/missing prices
- missing product taxonomy

This is intentionally described as an operational snapshot. It does not pretend Shopify order data alone is a complete conversion funnel.

### Storefront audit

When Browserless is connected, Atlas has a new read-only `storefront_audit` tool. It renders a public storefront and returns evidence such as:

- page title
- meta description
- H1 structure
- image count / missing alt text
- links, buttons and forms
- visible page content

Atlas can then reason about clarity, trust, merchandising, SEO and UX using the actual rendered page.

### Optimization experiments

Atlas can create internal experiments without changing the storefront:

```text
create_store_experiment
list_store_experiments
update_store_experiment
```

Each experiment records:

- hypothesis
- target surface
- primary metric
- control / variant
- expected impact
- lifecycle status
- final measured result

Creating an experiment also creates an Atlas open loop so the test is not forgotten.

### Guardrail

Atlas is explicitly instructed not to claim that a test improved conversion without measured evidence. Storefront mutations remain approval-gated.

### Daily Commerce Operator

The Shopify scheduled template has been upgraded from a basic brief to a Commerce Operator. It can:

1. run store health
2. identify material issues
3. optionally audit the public storefront
4. create/update Finish It loops
5. propose evidence-based experiments
6. leave live-store mutations untouched unless approved


## v13.5 — Growth Intelligence

Commerce Autopilot can now join store outcomes with paid acquisition signals.

### Shopify abandoned checkout intelligence

Atlas uses Shopify's current GraphQL `abandonedCheckouts` query. It can see both unresolved and recovered checkout records, their observed value, line items, and recovery URLs.

This requires Shopify `read_orders` access plus the relevant abandoned-checkout permission on the account.

Atlas treats recovery URLs as context only. It does **not** contact a customer automatically; customer outreach remains a consequential action.

### Meta Ads reporting

Configure:

```env
META_ADS_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=
META_GRAPH_VERSION=v26.0
```

Atlas reads campaign-level spend, impressions, clicks and the first available purchase/purchase-value signal from the Meta Marketing API. It does not mutate campaigns.

### Google Ads reporting

Configure:

```env
GOOGLE_ADS_CUSTOMER_ID=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=
GOOGLE_ADS_API_VERSION=v25
```

Google Ads uses the existing Google OAuth connection. When a Google Ads customer ID is configured, reconnect Google so the OAuth grant includes:

```text
https://www.googleapis.com/auth/adwords
```

As of September 9, 2026, Google Ads API access levels are associated with the Google Cloud project rather than the old developer token. Existing developer-token headers may still be sent but are optional/ignored by the API servers.

### Funnel health

New read-only tools:

```text
shopify_abandoned_checkouts
meta_ads_insights
google_ads_insights
commerce_funnel_health
```

The unified funnel reports:

- Shopify gross order value
- connected Meta + Google ad spend
- **directional blended ROAS**
- unresolved checkout count
- unresolved checkout value
- observed abandoned-checkout recovery rate

Important: blended ROAS here is intentionally labelled **directional**. It is Shopify gross order value divided by connected ad-platform spend. It is not a substitute for channel attribution because organic/direct orders, platform attribution windows, channel overlap, refunds, taxes, and conversion definitions can differ.

This lets Atlas say useful things such as:

> Paid acquisition spent $1,200 while Shopify recorded $3,800 gross order value, and $740 of unresolved checkout value remains in the same analysis window.

rather than pretending it knows exactly which campaign caused every sale.


## v13.6 — Kairoq

The product has been renamed from the visible “Atlas” identity to **Kairoq**.

The underlying internal `atlas` agent identifier is intentionally preserved for backwards compatibility, but users no longer need to know about that architecture.

### Product promise

> **What needs to happen?**

Kairoq is positioned as an **outcome operating system**:

- notices unfinished work
- remembers what is still open
- works across connected apps
- chooses specialists/models/tools internally
- asks for approval when an action is consequential
- keeps following the outcome until there is evidence it is complete

### User-facing vocabulary

| Old | New |
| --- | --- |
| Command Center | Today |
| Open Loops | Outcomes |
| Finish It | Own It |
| Scheduled Bots | Watchers |
| Company Playbook | How We Work |
| Connectors | Connections |
| Atlas & Team | Specialists (Advanced only) |

### Main navigation

The simple surface is now centered on:

```text
Today
Outcomes
History
Connections
```

Technical controls such as model selection, specialist selection, routing and comparison are hidden in Simple mode. They remain available in Advanced mode.

### Signature interaction

```text
What am I forgetting?
```

Kairoq scans for unfinished promises, money, deadlines, follow-ups, dependencies and unresolved work.

The intended experience is:

```text
7 outcomes are still open.
I can handle 5.
2 need your approval.
```

The product is designed around outcome ownership rather than chat completion.


## v13.7 — Autonomous Browser Operator

Kairoq can now choose a web execution path on its own instead of making the user pick a browser mode.

### Routing

```text
Need fresh public information
  → web search / fetch

Need one JavaScript-heavy page
  → browser_render

Need to navigate multiple pages and inspect a site
  → browser_research_task

Need to click/type and change website state
  → browser_action_task
  → human approval
  → execute
  → verify final page state
```

### `browser_research_task`

This is automatically allowed and is intentionally read-only. The managed browser may navigate, follow ordinary links, paginate, expand menus, and use a site's search box, but it is instructed to stop before:

- form submissions
- sending messages
- uploads
- checkout
- purchases/bookings
- account changes
- publishing/deletion
- legal acceptance
- sensitive credential entry

### `browser_action_task`

This is always approval-gated.

The model must provide:

```text
task
startUrl
allowedDomains
expectedChanges
successCondition
```

That makes the approval meaningful. Instead of “browser wants to click something,” the user should see exactly what will change and what Kairoq will verify afterward.

The action wrapper also tells the browser to stop rather than enter passwords, one-time codes, payment/bank details, private/API keys, government IDs, or recovery codes.

### Example

> Find a suitable supplier for these shoes and prepare the products in my store.

Kairoq can:

1. search for suppliers
2. navigate supplier websites read-only
3. compare pricing/shipping/catalog evidence
4. choose candidates
5. create draft products through Shopify APIs where available
6. if a website must be changed through the browser, request one precise approval
7. continue after approval
8. verify the result
9. keep any waiting dependency as an Outcome

### Authentication limitation

This does not magically bypass authentication. If a website needs a session that Browserless does not already have, or requests a sensitive credential/2FA step, Kairoq stops at that boundary. Authenticated browser session handling can be added separately for sites that support a safe persistent-session workflow.


## v13.8 — Calm streaming

The response-reading experience has been rebuilt.

### Kairoq no longer fights your scroll

Previously the main token handler forced:

```js
messagesEl.scrollTop = messagesEl.scrollHeight
```

for every incoming token.

That meant scrolling upward during an answer was immediately undone.

Now:

- Kairoq follows the live answer while you remain near the bottom.
- The instant you scroll upward, auto-follow pauses.
- The answer continues generating without moving your reading position.
- A **↓ Latest** button appears while new text is arriving.
- Pressing **Latest** smoothly returns to the live answer and resumes following.

### Response pace

Go to:

```text
Settings → Response pace
```

Choose:

- **Relaxed** — slower, reading-like reveal
- **Natural** — default
- **Fast** — faster visual streaming
- **Instant** — no display pacing

The model itself is **not slowed down**. Kairoq receives the answer at full provider speed and controls only how quickly the browser reveals it.

For very long answers, the renderer gently speeds up if a large buffer develops so the UI does not make you wait unnecessarily.


## v13.9 — Creative Engine

Kairoq now has a persistent local/free creative execution layer.

Configure local sd.cpp with `LOCAL_SDCPP_ENABLED`, `LOCAL_SDCPP_BINARY`, and `LOCAL_SDCPP_MODEL_PATH`, or configure a Wan2GP Gradio server with `WAN2GP_BASE_URL`.

Creative jobs persist in `workspace/.media-jobs.json`, are linked to Outcomes, and expose `GET /api/media/jobs`, `POST /api/media/jobs/create`, and `POST /api/media/jobs/retry`. If Kairoq restarts during a running render, the job becomes `interrupted` and the Outcome remains open rather than being falsely marked complete.

The autonomous `create_media_job` tool uses local/free routes only. The normal Image/Video UI can still use the user's configured budget mode and premium fallbacks. See `THIRD_PARTY_NOTICES.md` for MIT attribution.


## v14 — Work Studio

Kairoq can now create actual business files rather than stopping at text.

Supported output:

```text
.xlsx  Excel workbook
.docx  Word document
.pptx  PowerPoint presentation
.pdf   PDF report
.csv   CSV data file
```

### Natural-language examples

```text
Create a 24-month Travellez forecast in Excel with an assumptions sheet and formulas.
Create a professional PlanURstay proposal in Word.
Turn this analysis into an 8-slide management presentation.
Create a PDF executive report from these findings.
Export this table to CSV.
```

Kairoq automatically selects the matching Work Studio tool.

### Agent tools

```text
create_excel_workbook
create_word_document
create_powerpoint
create_pdf_report
create_csv_file
list_work_products
```

Files are generated under:

```text
public/generated/work-products/
```

Metadata is persisted at:

```text
workspace/.work-products.json
```

Each generated file is linked to a Kairoq Outcome and marked complete only after the file has actually been written.

### No Microsoft Office installation required

The Work Studio writes the Office Open XML formats directly. Microsoft Excel, Word and PowerPoint can open the resulting files, but the Kairoq server does not require Office to generate them.

The generated XLSX supports multiple worksheets, tables of data and cell formulas. The DOCX generator supports styled headings, paragraphs, bullets and tables. PowerPoint output uses a clean 16:9 Kairoq business layout. PDF and CSV are generated directly.

### Microsoft 365 cloud connection

v14 creates Office-compatible files locally. Direct OneDrive/SharePoint/Excel Online account mutation is intentionally not enabled yet; that should use a proper Microsoft OAuth/Graph connection rather than storing an expiring manual token.


## v14.1 — Microsoft 365

Kairoq now supports a proper delegated Microsoft OAuth connection.

### Core connection

Create a Microsoft Entra / Azure app registration with a Web redirect URI matching:

```text
http://localhost:3002/api/microsoft/callback
```

Then configure:

```env
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT=common
MICROSOFT_REDIRECT_URI=http://localhost:3002/api/microsoft/callback
MICROSOFT_ENABLE_OUTLOOK=true
```

Open **Connections → Microsoft 365 → Connect Microsoft**.

Core scopes requested by Kairoq:

```text
openid
profile
offline_access
User.Read
Files.ReadWrite
```

With Outlook enabled:

```text
Mail.Read
Mail.Send
Calendars.ReadWrite
```

### OneDrive + Work Studio

Kairoq can:

- list files in its configured OneDrive folder
- upload a generated XLSX/DOCX/PPTX/PDF/CSV work product
- remember the OneDrive item ID and web URL
- use that uploaded XLSX with Excel Online

Uploads are restricted by Kairoq's own code to:

```text
/Kairoq
```

(or `MICROSOFT_ONEDRIVE_FOLDER`).

Uploading changes cloud state and therefore remains approval-gated.

### Excel Online

For XLSX files generated by Kairoq and then uploaded to OneDrive:

```text
microsoft_excel_read_range
microsoft_excel_update_range
```

Kairoq can read ranges automatically. Range updates require approval.

This makes workflows possible such as:

```text
Create a revenue workbook
→ save it to OneDrive
→ update Sheet1!B2:E12 next Monday
```

### Outlook + Calendar

Read-only:

```text
microsoft_outlook_search
microsoft_outlook_read
microsoft_calendar_list
```

Approval-gated:

```text
microsoft_outlook_send
microsoft_calendar_create
```

### Teams

Set:

```env
MICROSOFT_ENABLE_TEAMS=true
```

Kairoq then requests the delegated Teams scopes needed to list joined teams/channels and send channel/chat messages.

Teams delegated messaging is designed for Microsoft work/school accounts; personal Microsoft accounts are not supported for these Teams endpoints.

Tools:

```text
microsoft_teams_list
microsoft_teams_channels
microsoft_teams_send
```

Sending is approval-gated.

### SharePoint

Set:

```env
MICROSOFT_ENABLE_SHAREPOINT=true
MICROSOFT_SHAREPOINT_SITE_ID=
MICROSOFT_SHAREPOINT_DRIVE_ID=
MICROSOFT_SHAREPOINT_FOLDER=Kairoq
```

This adds the broader delegated `Sites.ReadWrite.All` scope.

Kairoq can list the configured document library and upload its generated work products into the configured Kairoq folder. Uploading is approval-gated.

### Safety model

Automatic:
- read OneDrive listing
- read Kairoq Excel ranges
- read Outlook mail
- read calendar
- list Teams/channels
- list configured SharePoint library

Requires approval:
- upload to OneDrive
- change Excel Online
- send Outlook email
- create Microsoft calendar event
- send Teams message
- upload to SharePoint


## v14.2 — Polished chat rendering

Kairoq's response renderer now supports proper structured Markdown instead of displaying raw table markup.

Supported conversational elements:

```text
Headings
Paragraphs
Bold / italic
Ordered lists
Bullet lists
Blockquotes
Horizontal rules
Inline code
Fenced code blocks
Clickable Markdown links
Markdown tables
```

Markdown tables are rendered as real responsive HTML tables with horizontal scrolling on narrow screens.

Escaped model output such as:

```text
\| column \|
\-
\>
<br>
```

is normalized before rendering so the user sees the intended structure rather than Markdown syntax.

The underlying model response stays unchanged; this is a display-layer improvement.


## v14.3 — Zero Cost Core

Kairoq now uses the same core cost strategy as local-first agents such as Hermes:

```text
LOCAL MODEL
Ollama / llama.cpp / LM Studio / other OpenAI-compatible server
        ↓ if unavailable
OPENROUTER FREE ROUTER
        ↓
explicit free OpenRouter models
        ↓
STOP
```

There is no automatic paid-model fallback while:

```env
ZERO_COST_MODE=true
PAID_LLM_ENABLED=false
```

### Ollama

Install/start Ollama, pull a model, and either leave model selection automatic or set it explicitly:

```env
LOCAL_LLM_BASE_URL=http://127.0.0.1:11434/v1
LOCAL_LLM_MODEL=qwen3.5:4b
LOCAL_LLM_TOOL_MODEL=qwen3.5:4b
```

Then restart Kairoq.

`LOCAL_LLM_TOOL_MODEL` should support tool/function calling if you want full Kairoq agent behavior. If the local agent model is unavailable, Kairoq can fall back to `openrouter/free` when an OpenRouter key is present.

### Strict cost rules

Default:

```env
ZERO_COST_MODE=true
PAID_LLM_ENABLED=false
OPENROUTER_FREE_FALLBACK_ENABLED=true
OPENROUTER_WEB_SEARCH_ENABLED=false
```

This means:

- normal chat tries local inference first
- memory/summary helper calls try local first
- agent/tool reasoning tries the local tool model first
- OpenRouter fallback uses `openrouter/free`
- explicit free-model fallbacks remain zero-price models only
- paid text models are blocked
- OpenRouter's web-search tool is blocked because tool usage can have separate charges

Browserless, external APIs, image/video providers, SMS and other third-party services may still have their own charges. Zero Cost Mode governs Kairoq's **text-model inference route**, not every external service on the internet.

### No OpenRouter credits required for local mode

If Ollama is running, `OPENROUTER_API_KEY` can be omitted entirely. Kairoq's model catalog and normal chat continue to work from the local endpoint.

If you want OpenRouter's free router as backup, keep an API key configured. The free router has its own rate limits, so local inference should remain the main engine.


### Full-stack Build Studio beta

At `/build-studio.html`, choose **Full-stack business app** to generate custom collections, a responsive frontend, login, a dashboard, and persistent per-account records. Build jobs run asynchronously and resume their progress display after a page refresh. Saved projects can be reopened, revised and launched at `/apps/<project-id>/`. Launch hosting uses the existing Kairoq Railway service and volume; GitHub credentials are only needed for static project pull requests.

The trusted SQLite backend supports text, textarea, email, number, date, boolean and select fields. Generated JavaScript runs in the browser; generated server code is never executed. Revisions must preserve collections, field types and existing enum options. Added required fields need defaults. Browser QA checks registration, login, create/edit/delete, saved records, dashboard counts and desktop/mobile layouts before atomically switching the active version. A failed revision leaves the last working version in place. App accounts and saved data persist across deploys; sessions require a fresh login after a server restart.

Supported scope is business CRUD apps such as inventories, enquiry trackers and CRMs. Arbitrary backend code, payments and external integrations are outside this beta. Experiential Labs credentials remain server-side. `FULLSTACK_APP_SMOKE_TEST=true` runs a cached inventory build and feature revision, verifies a real SQLite record survives, and launches the example app. Daily/monthly AI budget checks apply to builds and repair calls.

### Managed app releases and design

Build Studio creates a versioned preview after browser QA. **Deploy version**
changes the public app route; revisions and repairs leave that route on its
previous version until explicitly deployed. Release history supports restoring
any version that passed QA. Failed deployment health checks restore the previous
route. Rollback keeps saved records, including fields added by a later version.
**Diagnose & repair** checks an app and generates a repair only when needed or
when a specific issue is supplied. Generated repairs still require review and
explicit deployment.

`design-guidance.js` contains Kairoq-authored design instructions inspired by
[Impeccable](https://github.com/pbakaus/impeccable). Both website and business-app
generation use them; revisions preserve the existing identity. This is prompt
guidance, not installation of Impeccable's CLI/detector engine. Functional browser
QA checks are separate from subjective visual quality.

### Optional Supabase backend

Existing apps continue using their existing database. New apps can choose
Supabase once the server connection is ready. The adapter verifies users with
Supabase Auth, refreshes expiring tokens, stores sessions in encrypted HttpOnly
cookies scoped to the app, and accesses records with each user's JWT and RLS.
`migrations/20261008_builder_supabase.sql` defines the isolated Kairoq tables.
The scoped administrative RPC SQL is a separate, **approval-required** setup
proposal; it is not activated by setting the publishable key alone. Its token
must remain server-side and never appear in generated code. Public email
registration also needs the Supabase project's email delivery and confirmation
redirect configuration. It has not been verified through a real email inbox.

### Design pipeline (new AI-generated apps and websites)

Every new build first creates a durable design brief for its audience, purpose,
visual direction, layout, typography, palette and interaction states. The
`design-system.js` foundation provides reusable, customizable components and
five visual directions; these are concrete CSS classes and tokens, not a fixed
page template. Feature revisions reuse the saved identity.
New business apps also use `app-components.js` and the trusted browser runtime
for authentication, schema-driven forms, records, search, pagination and
dashboard counts. Generated JavaScript focuses on presentation and navigation;
existing apps keep their current UI runtime.

Functional browser QA renders the build with synthetic data. Business apps
capture login, empty and populated desktop dashboards and a mobile dashboard;
websites capture desktop and mobile. `design-dom.js` checks small text, clipping
and text contrast where the rendered background can be determined reliably.
A vision model receives the actual JPEGs and scores seven design dimensions.
Up to two automatic polish attempts address findings, followed by fresh browser
checks and screenshots. Deployment requires a mean score of at least 4/5,
no dimension below 3.5, and no major/critical findings. This is an AI assessment,
not an objective guarantee of design quality or accessibility certification.
Visual polishing cannot change an app schema; data modelling remains separate.
Unsupported vision, malformed reviews or unmet quality gates do not produce a
false visual pass. Calls remain subject to existing daily/monthly budgets.

Evidence and reports stay with the project/version. The one-time design smoke
build produces a housing desk and corporate housing website through this same
pipeline; its public proof images contain only synthetic test records. Existing
published versions are preserved when a new build/revision fails its checks.


### Screen and public deployment verification

New builds review every captured state, in batches of five screenshots. Each
state receives its own seven-axis verdict; a weak or omitted state blocks the
visual gate. Managed-app journeys cover every schema collection on desktop
and mobile, new/edit forms, required validation, pending saves, recoverable
service errors, search no-match states, select filters and logout/API protection.
Website checks capture each section and visible expanded navigation/FAQ state.

Launching a SQLite app now checks the public Railway URL in Chromium, including
registration, login, CRUD, dashboard, reload, mobile and logout. Configure
`KAIROQ_PUBLIC_URL` as an HTTPS origin; Railway's `RAILWAY_PUBLIC_DOMAIN` is used
automatically. A failed public check restores the previous deployed version.
Checks create a unique synthetic account, remove only that account's records
and identity, and save credential-free release evidence. Supabase authenticated
release testing still requires a disposable identity and is reported as blocked
rather than being claimed as verified. External integrations and business rules
not represented by the managed schema require dedicated journey adapters.

`FULLSTACK_APP_SMOKE_TEST=true` also runs the cached journey pilot: a fresh
two-collection operations app and section-reviewed website, followed by public
checks. Its credential-free result is `/generated/journey-proof/report.json`.
The Docker build executes Chromium regression tests before releasing the server.

Build Studio lists each screen verdict and links its captured screenshot. Screenshot
evidence is available only to the signed-in Kairoq owner. Shared components supply
visible validation summaries, explicit saving/edit modes and mobile record cards.


### Commit-linked Travellez benchmark evidence

Travellez benchmark reports now identify the source commit and contract version. Old reports become `stale`; revalidation reuses existing projects and repairs only observed failures. Public AI verdicts must match the captured screenshot hashes. Required app screens are exercised at desktop and mobile widths, and the required collections, trip references and guarded transitions are checked explicitly.

The **Benchmark evidence** Actions workflow runs regression tests on pushes and pull requests. Its manual deployed check reads an existing report once, rejects failed/incomplete/stale evidence, and uploads the report plus hash-verified public screenshots. It does not start another generation or poll the deployment. Supply the public HTTPS origin and deployed commit SHA; password-protected instances use the `KAIROQ_BENCHMARK_PASSWORD` Actions secret. Screenshot downloads require the same owner session as the report.

For a local saved report: `KAIROQ_BENCHMARK_REPORT=/path/to/report.json KAIROQ_EXPECTED_SHA=<commit> npm run benchmark:verify`. For a deployed report, replace `KAIROQ_BENCHMARK_REPORT` with `KAIROQ_PUBLIC_URL=https://your-kairoq-host`. Verification exits nonzero unless both public outputs passed for the expected commit. Railway `/health` success remains separate from benchmark success.
