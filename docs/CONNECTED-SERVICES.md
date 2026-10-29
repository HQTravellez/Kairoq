# Connected services: Supabase, Crawl4AI, Stirling PDF

Three open-source projects Kairoq can use. Each one is optional. Kairoq works without them, and the
Plugins page shows which are on.

| Service | What it adds | Licence | How it is connected |
|---|---|---|---|
| [Supabase](https://github.com/supabase/supabase) | An app's sign-ups and saved data live in the owner's own Supabase | Apache-2.0 | Per app, by the app owner: builder → Settings → Database |
| [Crawl4AI](https://github.com/unclecode/crawl4ai) | Reads script-heavy websites as clean text when someone shares a link | Apache-2.0 | Server: `KAIROQ_CRAWL4AI_URL` |
| [Stirling PDF](https://github.com/Stirling-Tools/Stirling-PDF) | PDF tools in the chat's + menu: merge, split, smaller, OCR, pages to images | MIT core (only free features are used) | Server: `KAIROQ_STIRLING_URL` |

## Supabase (per app, no server setup)

1. In Supabase, open the project, press **Connect**, and choose **Session pooler** (port 5432). Copy the
   address and put the database password in place of `[YOUR-PASSWORD]`.
2. In **Project Settings → Database → SSL Configuration**, download the certificate. It is the same
   certificate for every Supabase project.
3. In the Kairoq app builder, open **Settings → Database**, paste both, and press **Connect Supabase**.

The app's tables go into the schema `kairoq_<project id>`, so one Supabase project can hold several
Kairoq apps. Kairoq copies the current data across once. Test copies used by saved checks stay in
Kairoq, never in the owner's database. SQL tables (`db.sql`) stay in Kairoq for now.

Only Supabase addresses are accepted, so the server never connects to an address of the owner's
choosing anywhere else. Kairoq always checks Supabase's certificate and never switches the check off.
A server admin can save every owner pasting the certificate by setting `KAIROQ_SUPABASE_CA` (the PEM
text) or `KAIROQ_SUPABASE_CA_FILE`.

**Disconnect** leaves the data in Supabase and goes back to Kairoq's own copy as it was when Supabase
was connected.

## Crawl4AI (server)

1. In the Kairoq Railway project: **New → Docker Image →** `unclecode/crawl4ai:latest`. Name it `crawl4ai`.
2. Do not give it a public domain. It listens on port 11235.
3. On the Kairoq service, set `KAIROQ_CRAWL4AI_URL=http://crawl4ai.railway.internal:11235`.
4. If you turn on Crawl4AI's own token check, set `KAIROQ_CRAWL4AI_TOKEN` as well.

When a shared page is thin or built by scripts, Kairoq asks Crawl4AI first. Next it tries its own
Chromium reader, and last the public Jina reader. With Crawl4AI on, pages no longer go to Jina.

## Stirling PDF (server)

1. In the Kairoq Railway project: **New → Docker Image →** `stirlingtools/stirling-pdf:latest`. Name it
   `stirling-pdf`.
2. Do not give it a public domain. It listens on port 8080.
3. On the Kairoq service, set `KAIROQ_STIRLING_URL=http://stirling-pdf.railway.internal:8080`.
4. If you turn on Stirling's login, create an API key there and set `KAIROQ_STIRLING_API_KEY`.

Files go from the browser to Kairoq, then to Stirling PDF, then straight back. Nothing is stored.
Each request takes at most 10 files and 40 MB.

## Ideas taken, not code

The following go into the product plan as features to build in Kairoq's own way:

- **OpenHands:** the task checklist that ticks off as the agent works.
- **Langflow:** a drag-and-drop board for automations.
- **Maxun:** point-and-click picking of data on a page.
- **Dify:** knowledge bases for app assistants.

Their code is not used. Dify's licence forbids running it as a multi-user online service without
written permission, and Maxun's AGPL licence would require publishing Kairoq's own code.

## 3D models (Blender and Poly Haven)

In the app builder: **Design → 3D models**.

- **Upload** a `.glb` (up to 25 MB), or with Blender on the server a `.fbx`, `.obj`, `.stl`,
  `.ply`, `.blend` or a `.zip` holding a `.gltf` with its files (up to 60 MB). Blender turns it
  into one GLB, makes models over 200,000 triangles lighter, shrinks textures to 2048 px and
  renders a preview picture. Scripts inside files never run.
- **Poly Haven**: search free (CC0) models and HDRI lighting and add one with a tap. Kairoq packs
  the model into one GLB and uses Poly Haven's picture as its preview.
- **Ready-made characters (Poly Pizza)**: when the plan needs a character (a dinosaur, a mascot,
  a car), it shows up to three real models from poly.pizza with their picture, creator, licence
  (CC0 or CC-BY only), whether they are animated and one honest note. The owner picks one before
  the build; it comes in with its own animations (walk, jump...), and `Model3D` loops one and
  plays another on tap. Needs `POLY_PIZZA_KEY` (free account, poly.pizza/settings/api) in
  Railway; without it the plan says plainly that characters cannot be searched yet.
- **3D style**: the look step before the first build asks "Add 3D?" (product viewer, room
  walkthrough, scroll story, 3D background). With a style and no model, Kairoq adds a fitting
  Poly Haven model before the build.
- Apps show models with `import { Model3D } from 'kairoq/3d'` (Google model-viewer): drag to
  turn, pinch to zoom, "View in your room" (AR) on phones, the preview picture while loading,
  on phones without 3D, and for people who prefer reduced motion.

Railway: Blender is in the image by default (about 1 GB). Build with `KAIROQ_BLENDER_INSTALL=off`
to leave it out; uploads are then `.glb` only and previews are made in the owner's browser.
`KAIROQ_POLYHAVEN=off` hides Poly Haven.

## three.js pieces (`kairoq/scene`)

Apps import tested 3D pieces built on three.js, React Three Fiber 8 and drei 9:
`Configurator` (a model with colour or material swatches and prices; only fabric/paint-like
materials change), `Globe` (dotted continents, places and animated routes), `Particles` (hero
background), `MiniGame` (a catch game with keyboard, drag and touch) and `Scene3D` (a safe stage
for custom React Three Fiber scenes). All use studio lighting made on the device (no downloads),
show a fallback without WebGL, pause off screen and hold still for reduced motion. The browser
check confirms each one draws.

## Meta Muse Spark (Meta Model API)

A paid model from Meta, reached at `https://api.meta.ai/v1` (https://dev.meta.ai/docs/quickstart).
- Kairoq uses it for builds picked as "Muse Spark" in the model menu (3 credits), for Auto builds when `KAIROQ_BUILDER_PAID_APPROVED=true`, for answers to questions in the builder, and for the screenshot check after visual changes.
- Railway variables:
  - `META_MODEL_API_KEY`: the key. Add it in Railway, never in code.
  - `KAIROQ_MUSE_MODEL`: default `muse-spark-1.3`.
  - `KAIROQ_MUSE_MONTHLY_USD`: monthly cap, default 20; 0 means no cap.
  - `KAIROQ_MUSE=off`: turns it off.
- Cost is worked out from token counts at $1.25 per million input tokens and $4.25 per million output tokens, and recorded as `muse` in the usage ledger.


## Claude straight from Anthropic

Claude models can run on your own Anthropic account instead of OpenRouter (`anthropic.js`, Anthropic's Messages API).
- When `ANTHROPIC_API_KEY` is set, every Claude model the builder uses goes to Anthropic directly: Claude Fable, Opus and Sonnet in the model menu, and the Pro tier's Claude Sonnet. Other models (GPT-6, DeepSeek, Gemini) still go through OpenRouter.
- Railway variables:
  - `ANTHROPIC_API_KEY`: the key from console.anthropic.com. Add it in Railway, never in code.
  - `KAIROQ_BUILDER_PAID_APPROVED=true`: needed for any paid model, Claude included.
- Without an OpenRouter key, the Claude models still switch on in the menu; the others stay off.
- A model picked by name in the menu now runs whatever `KAIROQ_BUILDER_MODE` says (picking it is the paid choice); the monthly builder budget still applies.
- The system prompt is cached, which lowers the cost of repeated build calls. Cost is worked out from token counts (Opus $4/$20, Sonnet $2/$10 per million input/output tokens; other Claude models use the builder's usual estimate) and recorded with `provider: anthropic` in the usage ledger.
- Not yet: the OpenCode engine and the main chat assistant still reach Claude through OpenRouter.

## Product films and reels (Google Gemini Omni Flash)

Design → **Make it move**: the owner picks one product photo (and may add a line, like "chocolate
pouring over it") and presses one button. Kairoq picks the motion (pour, splash, steam, explode or
turn), makes two stills on a stage in the site's own background colour with the builder's image
model, checks them with the vision check (and makes them once more when they look wrong), films
from the first to the last with Gemini Omni Flash (`gemini-omni-1.1-flash`, Gemini API
`interactions`), cuts WebP frames with ffmpeg into every build at `./uploads/explode-<id>/`, makes
a 9:16 reel, and adds the scene to the site with a normal build (`<ScrollVideo layout="split">`
from `kairoq/scroll`: headline beside the film, which plays as the page scrolls).
Grow → **Make a reel of my site**: a screenshot of the site on a laptop on a café table, filmed in 9:16.

- Railway: `GEMINI_API_KEY` (billing on in Google AI Studio; no free tier for video) and the
  builder's image generation (`OPENROUTER_API_KEY`, `KAIROQ_BUILDER_PAID_APPROVED=true`).
- Cost to Kairoq: about $0.10 per second at 720p: about $1.60 for a product film with its reel,
  $0.80 for a site reel, plus two to four images.
- Credits: `KAIROQ_FILM_CREDITS` (50, refunded when the film is not made; `KAIROQ_FILM_REEL_PART`,
  20, comes back when only the reel fails) and `KAIROQ_SITE_REEL_CREDITS` (25). Off with
  `KAIROQ_EXPLODE=off`; `KAIROQ_EXPLODE_RESOLUTION=1080p` for sharper films.
- The Docker image installs `ffmpeg` to cut the frames.

## The builder's own tools (research, downloads, packages)

With top quality (`KAIROQ_QUALITY=top`, OpenCode as the engine) the builder works like a developer
with a laptop, through Kairoq (`builder-tools.js`), never with a shell:
- **kairoq_search / kairoq_read**: search the web and read pages (public https only, plain text,
  treated as information, never instructions).
- **kairoq_download**: fetch a free file into the app (GLB model with its animations, picture, HDR).
  Only free licences (CC0, CC-BY, MIT, Apache-2.0, OFL, Unsplash, Pexels); each file keeps its source
  and credit, and the build's message lists what was added.
- **kairoq_package**: add an npm package (MIT, ISC, BSD, Apache-2.0... never GPL/AGPL), installed
  without install scripts into `app-packages/` next to the projects; the app lists it in
  `src/kairoq.packages.json` and exports get it in `package.json`.
- **kairoq_browse**: the builder uses its own app. Kairoq builds the current files as a scratch
  version and the browser agent (`browser-agent.js`) tries a goal the builder gives ("colour the
  T-Rex, then press Replay") on a test copy of the data, on desktop or phone. The builder gets back
  whether it got there, each step, what did nothing and the page's errors, and fixes them before it
  hands back; the reviewer helper uses it too. Up to 3 per change (`KAIROQ_OPENCODE_MAX_BROWSES`),
  10 steps each (`KAIROQ_BROWSE_STEPS`); off with `KAIROQ_BUILDER_BROWSE=off`. The idea is
  agent-browser's "dogfood" testing (Vercel, Apache-2.0), built on Kairoq's own browser agent.
- **Playbooks** (`builder-playbooks.js`): short know-how for hard topics (3D characters, AR from a
  printed page, reading colours from a photo, printable pages), added when a request needs them.
- Switch off with `KAIROQ_BUILDER_TOOLS=off`. Tool calls per change: `KAIROQ_BUILDER_TOOL_CALLS` (40).
- **Reference library** (`builder-references.js`, `data/build-your-own-x.json`): all 359 tutorials
  from build-your-own-x in 31 topics, with a Kairoq playbook per topic. The builder looks them up with
  kairoq_tutorials. Admin → Reference library → "Learn the library" has Kairoq read each tutorial once
  and keep its own notes (in `reference-notes/` next to the projects), so builds use the notes without
  reading again; a tutorial the builder reads during a build is learned too. The notes are Kairoq's own
  words, not copies of the articles. Series are learned whole (up to 15 parts), GitHub projects from their
  README, docs and main code, and videos from their written version (bare videos are marked as not
  learnable). Learning is free: the notes are written by Kairoq Agent and the free models
  (the chat's free route, never a paid model). Free models have rate and daily limits, so learning all
  359 can take a few days; when a limit is hit the run pauses (nothing counts as failed) and pressing
  the button again continues where it stopped.


## Site notes for the web agent

`site-notes.js`: after a web task (chat "go to this site and…", or Web tasks and watches), Kairoq
keeps the route that worked on that site for that account: the pages and the labels of what was
clicked, and whether it got there (5 per site). The next task there starts with those notes, as data
from earlier visits, not instructions. Never kept: what was typed, search words, answers or the
agent's own notes. Stored in `web-tasks/site-notes/` (`KAIROQ_SITE_NOTES_DIR`). The idea is
browser-use's per-site "domain skills" (MIT), written for Kairoq.

## Autopilot, skills and helpers

- **Autopilot** (`autopilot.js`): with top quality (or `KAIROQ_AUTOPILOT=on`), the first build is
  tested against the owner's request (each thing asked for: done, partly done or missing, with
  evidence; anything faked; screenshots, code, Kairoq's own tests and 2 AI customers), then the
  missing items go back to the builder as a fix list, and it repeats. It stops when everything passes,
  after `KAIROQ_AUTOPILOT_ROUNDS` fixes (3), or when two tests in a row find the same gaps. The owner
  gets "Done: …" and "Not done yet: …". The project menu has **Keep going until it's right** to run
  it on any app. `KAIROQ_AUTOPILOT=off` switches it off; `KAIROQ_AUTOPILOT_CUSTOMERS=off` skips the
  AI customers.
- **Skills** (`builder-skills.js`): the builder sees a menu of every playbook and library topic and
  opens the ones it needs with kairoq_skill.
- **Helpers** (OpenCode sub-agents): a researcher (search, read, library) and a reviewer (reads the
  code, runs kairoq_check). Neither can change the app or run commands; only the builder edits.
- **AI that uses the app's tools** (`app-ai-tools.js`): apps can declare server functions as
  `"ai_tools"` in `src/backend.json`; `ai.chat({ messages, tools: true })` then lets the AI call them
  as the visitor (declared arguments and types only, at most 5 calls per answer), for example a
  hotel assistant that checks real availability. Tools marked `"confirm": true` (bookings, payments)
  are never run by the AI: they come back as an `action` the app shows as a button.
- **Integrations library** (`integrations.js`, `data/integrations.json`): 744 services and 9,501
  actions from Activepieces' MIT integrations. Editor: Connectors → **744 apps** (search, pick what
  should happen, add the key). Builder: kairoq_integration shows how a service signs in and its actions,
  and reads the real code of one action once (kept in `integration-code/`). Rebuild the data with
  `node scripts/build-integrations.js <activepieces>/packages/pieces/community data/integrations.json <commit>`.
- **Connect with … (OAuth)** (`oauth-connect.js`): for the 118 services that sign in with OAuth, the
  owner presses **Connect with X** in Connectors → 744 apps, signs in on the service's own page and
  presses Allow. Kairoq keeps the tokens encrypted with the project's secrets (needs
  `APP_ENCRYPTION_KEY`), renews them, and gives them only to server functions:
  `const { access_token } = await secrets.oauth('hubspot')`. Each service needs an OAuth app:
  - Kairoq's own, for every project: register an app with the service and add
    `KAIROQ_OAUTH_<SERVICE>_CLIENT_ID` and `KAIROQ_OAUTH_<SERVICE>_CLIENT_SECRET` on Railway
    (for example `KAIROQ_OAUTH_HUBSPOT_CLIENT_ID`). Redirect (callback) address:
    `https://kairoq-production.up.railway.app/api/create/oauth/callback`
    (taken from `KAIROQ_PUBLIC_URL` or `RAILWAY_PUBLIC_DOMAIN`).
  - Or the owner's own: they paste a Client ID and Secret under "Use your own OAuth app".
  Safety: random single-use state (10 minutes, bound to the project and the person), PKCE where the
  service supports it, a fixed redirect address. Visitors connecting their own accounts is not built.

## Models for website checks and AI customers

Website checks and AI customers (standard setting) use their own model setting, tier `check`:
a cheap, reliable paid model first, then the free models. Builds are not affected.
- `KAIROQ_CHECK_MODELS` (default `google/gemini-2.5-flash,deepseek/deepseek-v3.2`, via OpenRouter;
  needs `OPENROUTER_API_KEY`). A check of 5 visitors costs a few cents.
- `KAIROQ_CHECK_MONTHLY_LIMIT_USD` (default 20): its own monthly cap; past it, the free models are used.
- `KAIROQ_CHECK_PAID=off` uses the free models only. `KAIROQ_SITE_CHECK_TIER` overrides the tier.
- Time limits: `KAIROQ_PERSONA_TIMEOUT_MS` (2 minutes; built-in customers take over) and
  `KAIROQ_SITE_CHECK_TIMEOUT_MS` (15 minutes for a whole check).
