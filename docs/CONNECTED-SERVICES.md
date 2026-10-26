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
