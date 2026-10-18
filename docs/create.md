# Kairoq Create

`/create` is a chat builder for React apps, similar to Lovable. Customers describe an app, Kairoq writes a React + Vite + Tailwind project, shows it in a live preview, applies follow-up changes through chat, and publishes it in one click.

## How it works

1. **Chat edits.** Each message sends the current source files and recent chat to the builder model (`callBuilderModel`, which uses the same model order and budget as the existing builder). The model returns only the files it changed.
2. **Checks before building.** File paths must be under `src/`. Imports are limited to project files and `react`, `react-dom`, `lucide-react` and `react-router-dom`. `import.meta`, query imports (`?raw`), absolute paths and CSS `@import`/`url()` pointing at local files are rejected, so generated code cannot pull server files into a build.
3. **Server-side Vite build.** Accepted changes are built with Vite and Tailwind in a temporary folder (about 1–2 seconds). If the checks or the build fail, the error is sent back to the model and it retries, up to 3 attempts in total.
4. **Versions.** Every successful edit is saved as an immutable version (`versions/<n>/files.json` and `versions/<n>/dist`). Any version can be previewed or restored.
5. **Preview.** `/builder/p/<id>-<key>/v/<n>/` serves a version's build. The key is random per project. Pages served from the Kairoq host use a CSP sandbox, so generated code runs in an isolated origin and cannot use the Kairoq session.

## Editor features

- **Live streaming.** The model's output streams into the chat as it is written: the summary, the file being written, and its latest code. The editor uses Server-Sent Events (`/api/create/jobs/<id>/events`) and falls back to polling.
- **Runtime checks and Fix it.**
  - Every build includes a small reporter script (`builder-runtime/kairoq-reporter.js`). It tells the editor about uncaught errors, console errors, failed requests and blank pages.
  - After each build, the server also opens the app in headless Chromium (`runtime-check.js`). If it finds problems, they go back to the model. These retries count toward the 3 attempts.
  - If the last attempt still has problems, the version is saved with them, and the editor shows **Fix it**.
- **Model tiers.**
  - **Standard** uses the builder model chain.
  - **Pro** uses `KAIROQ_PRO_MODELS` first, then the standard paid chain.
  - Messages with images and the Standard tier use `KAIROQ_VISION_MODELS`, because DeepSeek cannot read images.
  - **Max** uses `KAIROQ_MAX_MODELS` (for example Fable 5.1). It is hidden until that is set, and costs `KAIROQ_MAX_CREDITS` (15) per message.
  - Pro, Max and image requests need `KAIROQ_BUILDER_PAID_APPROVED=true` and count toward the builder budget.
  - Output limit per reply: `KAIROQ_STANDARD_OUTPUT_TOKENS` (16,000) for Standard and `KAIROQ_PREMIUM_OUTPUT_TOKENS` (32,000) for Pro and Max, with a 15-minute streaming timeout for Pro and Max. In Agent mode, a reply cut off at the limit is sent back to the model with a request to write fewer files per step.
- **Project knowledge.** Under **Settings**, owners write instructions the model follows on every message (brand, tone, rules). Up to 8,000 characters.
- **Security scan.** The **Security** button checks the code and backend settings: secrets in browser code, collections with personal data open to everyone, unsafe HTML, server functions that change data without checking the user, and unsigned webhooks. **Fix with AI** sends the findings to the model.
- **Agent mode.** For bigger tasks, the model works in steps until the job is done.
  - Tools: read and search files, write files, build and open the app in headless Chromium, run UI steps (click, fill, select, expect text, go to a route), read server logs, run SELECT queries on the app's SQL tables, search the web, open any public website in a real browser and click through it (see Web research and browsing).
  - Pro, Max and image tiers also get a screenshot after each test. Standard models (DeepSeek) get the page's visible text instead.
  - The result is one new version. The chat shows each step, and the finished message keeps a list of them.
  - Limits: `KAIROQ_AGENT_MAX_STEPS` (15) steps per task. A task costs the tier's credits × `KAIROQ_AGENT_MULTIPLIER` (3).
  - **Stop** cancels any running job (build, discuss or agent) and refunds its credits, because nothing is saved.
- **Figma import.** The **Figma** button takes a frame link and a Figma personal access token (scope "File content: read"). The owner can save the token encrypted for the project.
  - Kairoq reads the frame's layers and turns them into a compact spec: layout, gaps, padding, colours, fonts, text, radius and shadows. Image fills are saved as uploads.
  - With paid models enabled, the rendered frame is sent to a vision model as a reference image (plus 1 image credit).
  - The import runs as a Build or Agent task, using the mode and tier selected in the chat.
- **Discuss mode.** The model answers or plans without changing code or creating a version. An **Implement this plan** button sends the plan as a build request.
- **Images in chat.** Attach, paste or drop up to 4 images (PNG/JPEG/WebP/GIF, 3 MB each).
  - Images are shown to the model as reference, for example "build this screenshot".
  - In build mode, images are also saved as project uploads. Every build copies them to `./uploads/<name>`, so the app can use your logo and photos.
- **Credits per message:** Standard `KAIROQ_STANDARD_CREDITS` (1), Pro `KAIROQ_PRO_CREDITS` (5), Discuss `KAIROQ_DISCUSS_CREDITS` (1), plus `KAIROQ_IMAGE_CREDITS` (1) when images are attached. Credits are refunded when a message fails.

## Visual edits

**Edit** turns on click-to-select in the preview. Builds tag every JSX element with `data-kq="file:line:col"` (`react-visual.js`).

- Selecting an element shows its text, Tailwind classes and, for images, `src` and `alt`. There are quick text and background colour swatches.
- **Apply** rewrites that element in the source and builds a new version. There's no AI call and no credit.
- Text or classes set by code (expressions) can't be edited visually. The panel says so and suggests asking the AI.

## Code download and GitHub

- **Settings → Download code** gives a ZIP of a standard Vite + React + Tailwind project (`npm install && npm run dev`). Its `src/kairoq.js` keeps using the app's backend on Kairoq.
- **Push to GitHub:**
  - Commits the current version to `owner/repo`, creating a private repo if needed.
  - Uses the customer's fine-grained token (stored encrypted), or the server `GITHUB_TOKEN` for the owner.
  - Files Kairoq doesn't manage, like `.github/`, are kept.
- **Pull from GitHub:** brings `src/` changes back as a new version, after the same safety checks and build.

## Automatic HTTPS for custom domains

With `RAILWAY_API_TOKEN` (or `RAILWAY_PROJECT_TOKEN`) set:

- Adding a domain also registers it on this Railway service (`customDomainCreate`).
- Kairoq shows Railway's DNS records alongside the `_kairoq` TXT record. Railway issues the certificate once DNS is correct.
- Removing the domain, or deleting the project, removes it from Railway.

Without a token, add each verified domain in Railway by hand. If the API call fails, the error is shown on the domain.

## Backend for generated apps

Every Create project has its own backend: user accounts and saved records in a per-project SQLite database (`workspace/react-projects/<id>/data.sqlite`). Generated code uses it through the built-in `kairoq` module:

```js
import { auth, collection } from 'kairoq';
await auth.signUp(email, password);           // also signIn, signOut, user(), onChange(fn)
const tasks = collection('tasks');
await tasks.create({ title: 'Book the venue' });
const mine = await tasks.list({ mine: true }); // also get, update, remove, where, order, limit
```

Collections must be declared in `src/backend.json`, which the model writes along with the app:

```json
{ "collections": { "tasks": { "access": "private" }, "messages": { "access": "public" } } }
```

| Access | Read | Add | Change or delete |
|---|---|---|---|
| `private` | the signed-in creator only | signed-in users | creator |
| `shared` | any signed-in user | signed-in users | creator |
| `public-read` | anyone | signed-in users | creator |
| `public` | anyone | anyone | creator (anonymous records: owner only, from the Data tab) |
| `submit-only` | nobody (owner only, in the Data tab) | anyone | owner, from the Data tab |

- The API is `/api/apps/<project-id>/…`. It uses bearer tokens instead of cookies, so it works from sandboxed previews, `/sites/` pages and custom domains. A custom domain can reach only its own app's API.
- Passwords are hashed with scrypt. Records are limited to 20 KB, 10,000 per collection and 10,000 users per app. Each IP is limited to 240 requests per minute per app.
- Preview and published versions share one database. The access rules come from the published version, or from the current draft if the app isn't published.
- In the editor, the **Data** tab shows collections, records and sign-ups, and lets the owner delete records.
- In sandboxed pages (preview and `/sites/`), sign-ins last until the page reloads because browser storage is unavailable. On subdomains and custom domains, sign-ins persist.

### Optional backend features

Enable these in `src/backend.json`. The model adds them when the app needs them.

- **File uploads.** Add `"storage":{"access":"signed-in"}` (or `"public"`).
  - In code: `storage.upload(file)` returns `{id, url}`.
  - Allowed: images, PDF, text and CSV, up to 5 MB each, with `KAIROQ_APP_STORAGE_MB` per app (default 500).
  - Files are served with a sandbox CSP. Only the uploader can delete a file.
  - Anyone with a file's URL can open it, whatever the storage access. Don't store private documents there.
- **Email.** Add `"email":true`.
  - In code: `email.send({to:'owner'|'me', subject, text})`.
  - Mail goes only to the app owner (the Create account's email, or `KAIROQ_OWNER_EMAIL` for owner-built apps) or to the signed-in user. Apps can't be used to spam other people.
  - Limits: anonymous senders 5 per hour, signed-in users 20 per hour, 200 per app per day.
  - Sent through Resend (`KAIROQ_RESEND_API_KEY`, `KAIROQ_EMAIL_FROM`).
- **Payments.** Add `"payments":{"products":{"pro":{"price":"price_…","mode":"payment"|"subscription"}}}`.
  - The app owner connects their own Stripe secret key and webhook secret under **Settings**. Both are encrypted with `APP_ENCRYPTION_KEY`.
  - In code: `payments.checkout('pro')` starts Stripe Checkout for the signed-in user. The return URL must point to the app itself.
  - Purchases are recorded only from a signed webhook, after re-reading the Checkout Session with the owner's key.
  - In code: `payments.has('pro')` / `payments.purchases()`. Payments show in the Data tab.
- **Scheduled jobs.** Add `"schedules":[…]` with `every` set to `hour`, `day` or `week`.
  - Actions: `delete_older_than` (with `days`) and `email_owner_summary`.
  - The server checks for due jobs every 5 minutes. For anything else that should run on its own, see **Automations** below.

### Server functions, webhooks and secrets

- Files in `functions/<name>.js` run on the server at `/api/apps/<id>/functions/<name>` (any method).
- Contract: `export default async function (request, { user, db, secrets, fetch, ai, email, crypto, log }) { return { status, json } }`.
  - `request` has `method`, `query`, `headers`, `body` and `rawBody` (for webhook signatures, with `crypto.hmacSha256Hex` and `crypto.timingSafeEqual`).
  - `db.collection(name)` has full access, so functions must check `user` themselves.
  - `secrets.get('NAME')` reads keys the owner adds under **Settings → Server secrets**, encrypted with `APP_ENCRYPTION_KEY`. They never reach the browser.
- In the app: `functions.invoke(name, body)` or `functions.url(name)`.
- Functions run in a QuickJS sandbox with no Node APIs, 16 MB of memory and `KAIROQ_FUNCTION_TIMEOUT_MS` (10 s), in `KAIROQ_FUNCTION_WORKERS` (4) worker threads, so a stuck function never blocks the server.
- `fetch` allows only http/https on ports 80, 443, 8080 and 8443 and blocks private and metadata addresses, including after DNS lookup. Bodies are limited to 5 MB.
- Each version runs its own functions. The preview runs the draft; the published site runs the published version.

### Automations

The app can do things on its own: reminders, digests, follow-up emails, cleanups, syncing with another service. An automation runs one of the app's server functions on a schedule or when a record changes. Declared in `src/backend.json`:

```json
"automations":[
  {"name":"reminders","run":"send-reminders","every":"day","at":"09:00","tz":"Europe/London"},
  {"name":"weekly","run":"weekly-report","every":"week","day":"mon","at":"08:00"},
  {"name":"welcome","run":"welcome","on":"created","collection":"bookings"}
]
```

- `run` names a file in `functions/`. `every` is `hour`, `day` (with `at`) or `week` (with `at` and `day`); `tz` is an IANA zone (default UTC). Or `on` is `created`, `updated` or `deleted` with a declared `collection`. Up to 10 per app; a missing function or collection is a build error.
- The function receives a POST with `request.body = { automation, trigger, at, collection?, record? }` and `user = null`, plus the usual `db`, `sql`, `email`, `secrets`, `fetch`, `ai` and `log`. Scheduled ones run on the published version (the draft when nothing is published); record-triggered ones run on whichever version made the change, so the preview's draft and the live site each run their own.
- The server checks schedules every minute, so `09:00` means 09:00. A new schedule waits for its next time; one that was missed (the server was down) runs once when it comes back.
- **No loops:** a change made by an automation never starts another automation.
- **Test copy:** when a saved check, the agent or synthetic customers create records, the matching automations run on the test copy, so their effects are visible in the test and never in real data. The agent has a `run_automation` tool to run one on the test copy and read its logs; the editor's Data tab has **Run now**.
- **Kept honest:** every run is logged under Data → Server logs with its result; the Data tab shows each automation's last run, next run and counts. After three failures in a row the owner gets one email (not one per failure), and the counter resets on the next success.
- API: `GET /api/create/projects/<id>/automations` and `POST …/automations {name}` (run now, editors; 30 per 10 minutes).

### SQL tables

- Migrations live in `sql/001_init.sql`, `sql/002_add_rooms.sql`, and so on (SQLite syntax: tables, indexes, foreign keys, checks). They run once, in order, when a version is built.
  - A migration that already ran cannot be edited; add a new numbered file instead.
  - Restoring an older version does not undo migrations.
- Data is stored in each project's `app-sql.sqlite`, separate from users and collections. Foreign keys are enforced. Size is capped by `KAIROQ_APP_SQL_MB` (200).
- Server functions query with `db.sql` and `db.batch`.
  - `` db.sql`SELECT * FROM rooms WHERE price <= ${max}` `` (values become parameters) or `db.sql('… WHERE id = ?', [id])`.
  - `db.batch([[sql, params], …])` runs several statements in one transaction.
  - Results are capped at 1,000 rows.
  - The browser has no direct SQL access.
- Not allowed: ATTACH, PRAGMA, `pragma_*` functions, VACUUM, transaction statements (BEGIN, COMMIT and so on), or tables named `_kairoq_*`.
- Queries run in child processes (`KAIROQ_SQL_PROCESSES`, default 2). A query longer than `KAIROQ_SQL_TIMEOUT_MS` (5,000) is killed and its process replaced, so runaway queries can't hang the server.
- The **Data** tab lists tables with columns, links and rows. Owners also get a SQL console. The security scan flags SQL built from strings.

### Server logs

The **Data** tab shows recent server logs for each app: `console.log` output from server functions, function errors and failed backend requests. The last 200 are kept in memory. Agent mode reads them with `view_logs`.

### AI in generated apps

- Add `"ai": true` to `src/backend.json`. In code: `ai.chat({messages, system})`, also available to functions.
- Calls use `KAIROQ_APP_AI_MODEL` while under `KAIROQ_APP_AI_MONTHLY_LIMIT_USD`, then the free router.
- Every `KAIROQ_APP_AI_CALLS_PER_CREDIT` (10) calls cost the app owner 1 credit. When the owner has no credits, calls return 402. Each visitor is limited to `KAIROQ_APP_AI_PER_MINUTE` (20).

### Sign-in options

- **Google.** Set `KAIROQ_GOOGLE_CLIENT_ID` and `KAIROQ_GOOGLE_CLIENT_SECRET`, and register `<KAIROQ_PUBLIC_URL>/api/create/auth/google/callback` as the redirect URI. One client serves Kairoq accounts and every generated app.
  - In apps: `auth.signInWithGoogle()`. The app receives a one-time, 60-second code in the URL fragment, only on its own preview, published or domain URLs. Google sign-in can't run inside the editor preview's frame; it opens in the published app.
  - Only Google-verified emails are accepted. Existing accounts with the same email are linked.
- **Password reset.** Kairoq accounts and app users can reset by email (needs Resend). Links last 1 hour and work once; a reset signs out every session.
- **Email verification.** New Kairoq accounts get a verification link (3 days). Sign-up still works when email isn't configured.

### Real-time updates

- In code: `const stop = collection('messages').subscribe(({type, item}) => …)` delivers `created`, `updated` and `deleted` events; call `stop()` to unsubscribe. Subscriptions reconnect after sign-in and sign-out.
- Uses Server-Sent Events with single-use, 60-second tickets. Each person only receives records they're allowed to read under the collection's access rule.
- Up to `KAIROQ_REALTIME_MAX_PER_APP` (500) open connections per app.

### npm packages

Generated apps can import: react, react-dom, react-router-dom, lucide-react, recharts, framer-motion, date-fns, clsx, tailwind-merge, class-variance-authority, zod, react-hook-form, the Radix primitives (dialog, dropdown-menu, tabs, tooltip, popover, select, accordion, switch), sonner, react-markdown, @tanstack/react-query, canvas-confetti, react-day-picker, embla-carousel-react, qrcode.react, three (3D), gsap (timelines and ScrollTrigger), lenis (smooth scrolling), remotion and @remotion/player (video compositions). Other imports are rejected before the build. Code downloads list only the packages the app uses.

Licenses are listed in `THIRD_PARTY_NOTICES.md`. Remotion is free for individuals and companies of up to 3 people; larger companies need a Remotion company license.

## Mobile apps

- **Installable on phones.** Every published app is a progressive web app: a web manifest, home-screen icons (192, 512 and Apple 180 px) and a service worker.
  - The service worker loads pages network-first with an offline fallback and caches built assets. It never caches `/api/`.
  - People install from Safari (Share → Add to Home Screen) or Chrome (Install app).
  - Installing needs the app's own origin: its subdomain (`KAIROQ_SITES_DOMAIN`) or a custom domain. The sandboxed `/sites/` path opens as a normal web page.
- **The App button** in the editor holds the mobile settings:
  - app name, home-screen name, theme colour, icon (letters on the theme colour, or a project upload) and app ID
  - a QR code to open the published app on a phone
  - store instructions

  Icons are rendered with headless Chromium. Without Chromium, a plain theme-colour icon is used.
- **"This is a mobile app" setting:**
  - The AI designs phone-first: bottom tabs, 44 px touch targets, safe areas and HashRouter.
  - The editor preview starts in the phone frame, and the published page uses `viewport-fit=cover`.
  - The code download and GitHub push become a [Capacitor](https://capacitorjs.com) iOS/Android project: `capacitor.config.json`, Capacitor packages, and `npm run android` / `npm run ios`.
- **Android APK on every push.** The project includes `.github/workflows/kairoq-android.yml`, which builds `app-debug.apk` and attaches it to the Actions run.
  - Writing workflow files needs a GitHub token with **Workflows: read and write**. Without it, Kairoq pushes everything else and says how to enable the build.
- **Store releases** need the owner's own Google Play and Apple Developer accounts. iOS builds need a Mac with Xcode.
- **Native sign-in.** The native app talks to the Kairoq backend over HTTPS. Google sign-in and password-reset links open the published web app, so the native app uses email sign-in.

## Design

New apps get a designed look by default. Kairoq uses four layers:

1. **Starter kit.** Every new project starts with a UI kit and a design system:
   - 19 polished components in `src/components/ui/`: Button (including a `hero` variant), Card, Input, Textarea, Label, Badge, Dialog, Sheet, Tabs, Select, Accordion, Switch, DropdownMenu, Tooltip, Avatar, Skeleton, Separator, Toaster, and Container/Section/Eyebrow.
   - Design tokens: CSS variables in `src/index.css`, between `kairoq:tokens` markers. They set colours, radius, fonts, gradients and shadows, and the Tailwind theme reads them (`bg-primary`, `text-muted-foreground`, `font-display`, `shadow-glow`, `bg-gradient-hero` and so on).
   - Unchanged kit files are sent to the model as a one-line API list instead of their code.
   - Projects without tokens look the same as before, because every theme value falls back to Tailwind's default.
   - Older projects get the kit and tokens from **Design → Add design system**.
2. **Design brief.** Before the first build of a new app, the AI acts as art director:
   - It picks a style name, palette, fonts (from about 30 Google Fonts), radius, layout, imagery and design rules, plus the best matching design skill.
   - Kairoq writes the brief into the tokens. Every later build, Discuss and Agent message follows it.
   - The brief is skipped for templates and when images are attached. To turn it off, set `KAIROQ_DESIGN_BRIEF=off`.
   - The coding prompt also carries general design rules: hierarchy, spacing, imagery, states, responsiveness and "avoid the generic AI look".
3. **Design skills.** A skill is a `SKILL.md` (front matter with `name` and `description`, then the rules) that the AI follows.
   - Built-in skills (in `design-skills/`): Luxury hospitality, Modern SaaS, Mobile app, Dashboard and admin, Editorial and content, plus the craft skills below.
   - **Craft skills**, so a site reads as designed by a person rather than generated:
     - *Human-crafted*, on by default: removes AI tells (gradient text, glow blobs, identical icon-card grids, vague copy, invented logos and testimonials) and lists what designers do instead.
     - *Frontend design (Anthropic)*, on by default: Anthropic's open `frontend-design` skill (Apache-2.0, from github.com/anthropics/skills).
     - *Framer Motion*: purposeful motion, shared layouts and reduced-motion support.
     - *Scroll story*: GSAP ScrollTrigger and Lenis for pinned, scroll-driven sections.
     - *Remotion video*: product videos and animated explainers as React compositions (license note included).
     - *Three.js 3D*: 3D only where it adds meaning, such as a globe of routes.
     - *Modern CSS*: container queries, `:has()`, view transitions, fluid type and scroll-driven animations.
   - **Product skills**, for the kind of app being built:
     - *Online shop*: collection and product pages, variants, cart drawer, checkout, stock checked in the same transaction as the order.
     - *Booking and marketplace*: search, filters, list and map, listing pages, availability, price breakdown and booking without double booking.
     - *Charts and data*: the right chart for the question, KPI tiles, recharts defaults, colour-blind-safe palettes and dashboard layout.
     - *Brand from a logo*: derives the palette (OKLCH tint scale, tinted neutrals, contrast-checked button colour), fonts, radius, icons and voice from the user's logo.
     - *Illustrations and icons*: one icon set and stroke scale, and simple on-brand inline SVG illustrations for empty states and onboarding.
     - *Accessibility*, on by default: WCAG 2.2 AA (keyboard, focus, screen readers, contrast, forms, reduced motion).
   - A skill with `default: on` in its front matter is on for every project until the owner turns it off.
   - Owners can add their own: paste the text, or import from a public GitHub link (a folder with a `SKILL.md`, a Markdown file, or a whole repository, in which case Kairoq lists the skills it finds).
   - A skill can be on for one project or for all the owner's projects. Skills share a 26,000-character prompt budget.
4. **Design review (✨ Polish).**
   - Kairoq screenshots the app on desktop (1280 px) and phone (390 px). The model gets both screenshots and fixes what looks off without changing behaviour, and the result is saved as a new version.
   - Standard uses the vision model; Pro and Max use their own models. The review costs one message on the chosen tier.
   - On Pro and Max, the first build of a new app gets one review for free. To turn this off, set `KAIROQ_AUTO_POLISH=off`.
   - The review needs Chromium on the server.
5. **Design model.** `KAIROQ_DESIGN_MODELS` (for example the OpenRouter id of Fable) is tried first for the design brief and the Polish review, whatever tier writes the code. The customer gets the strongest model's design judgement while most code is written by the cheaper tier model.
   - A Polish review costs at least `KAIROQ_POLISH_CREDITS`: 5 by default when a design model is set, 1 otherwise.
   - The free review after a Pro or Max first build is paid by the server owner.

The **Design** button in the editor shows:
- the brief, with editable colours, fonts, corners and notes (saving restyles the app as a new version)
- **New direction**: the AI writes a new brief, priced like a Discuss message
- the skills
- the image generator

### Generated images

When `OPENROUTER_API_KEY` and `KAIROQ_BUILDER_PAID_APPROVED=true` are set, the AI can generate images:
- **How the AI asks.** In Build mode it adds `"images":[{name,prompt,aspect}]` to its reply (up to 4 per message). In Agent mode it uses the `generate_images` tool.
- **Where they go.** Images are saved to the project uploads (up to 6 MB each), and the code is pointed at the saved file names.
- **Model.** `KAIROQ_IMAGE_MODEL` (default `google/gemini-2.5-flash-image`). The brief's imagery style is added to every prompt.
- **Cost.** Each image costs `KAIROQ_GENERATED_IMAGE_CREDITS` (default 2). A failed image is refunded and replaced by a plain placeholder in the brand colour.
- **Budget.** Spending counts against the builder budget. `KAIROQ_IMAGE_COST_USD` (default 0.05) is reserved for each image.
- **Turning it off.** Set `KAIROQ_IMAGE_GENERATION=off`.
- **Manual images.** Owners can also generate an image from the Design dialog.

## Saved checks (apps that don't break)

The most common complaints about AI app builders are changes that break what used to work, paying for the AI's own mistakes, and tests that touch real data. Kairoq handles all three:

- **Saved checks.** A check is a short browser script for a flow that must keep working, for example "fill *Your name*, click *Book*, expect *Thank you*".
  - Agent mode saves the flows it proves with `"save_as"`.
  - Owners can describe a check in plain English. The AI writes the steps (priced like a Discuss message), and the check is kept only if it passes now, unless the owner chooses **Save it anyway**.
  - Up to 15 checks per project. Each can be switched on or off in the **Checks** dialog.
- **After every change.** In Build, Agent and Polish, after the build and the browser test, Kairoq replays the enabled checks. If one fails, the AI is told exactly which step broke and must fix it before the version is saved. This takes up to three attempts.
- **The fix is on us** (`KAIROQ_PAY_WHEN_WORKS`, default `fix`).
  - A change is charged when it completes. If it still shows errors or breaks a saved check after the automatic fixes, the chat says so and the **next Fix of that problem costs nothing** (one free fix per problem; the project remembers it until a change leaves the app working). A free fix that still leaves the same problem is followed by one paid fix, then the loop guard stops.
  - A change that changes nothing is free. A request that fails before anything is saved (an error, a model outage or Stop) is refunded as before.
  - `refund`: the old rule, where the broken change itself is refunded. `off`: every completed change is charged and nothing is free.
  - For a build from a reference, only browser errors make it free, because its new journeys are written from the plan and may never have passed.
- **Loop guard** (`KAIROQ_LOOP_LIMIT`, default 2).
  - Fix requests are the **Fix it** buttons, **Fix these** and **Fix this** on explanation cards, and the security fix.
  - After 2 fix requests in a row that leave the same problem (the same browser errors and failing checks), the next fix request is refused (409, `stuck: true`) instead of charged.
  - The refusal explains in plain words what to do instead: Explain, roll back, describe the problem in your own words, or contact support.
  - Any change that leaves the app working resets the guard.
- **Support refunds.** A customer who is not happy contacts support. The server owner opens **Settings → Support credits**, looks up the customer's credit history, reviews the request, and grants credits back with a reason (`GET /api/create/admin/account?email=…`, `POST /api/create/admin/credits` with `{email, amount, reason}`, owner only). The grant and its reason are kept in the customer's history.
- **A test copy of the data** (`react-sandbox.js`).
  - Checks and the agent's browser tests run against a snapshot of the app's databases (records, users, SQL tables), never the real ones. The snapshot is taken with SQLite `VACUUM INTO`.
  - Uploads go to the copy's own folder. Emails are not sent, and payment checkout returns a test URL. Realtime events stay inside the copy.
  - `query_db` in Agent mode reads the same copy. Copies are deleted after the run.
- **Publish gate.** Publishing re-runs the checks on the version going live and asks before publishing a version that fails them.
- **Live monitor.** Every `KAIROQ_MONITOR_HOURS` (default 24, `0` to turn off), the checks run on each published app's live version. The owner gets one email when a check starts failing, not one per day.

## AI costs and prompt caching

- **Prompt caching.** Every message resends the project to the model, and most of it is the same as last time: the rules, design brief, skills and knowledge, plus the project files during retries and agent steps.
  - DeepSeek, OpenAI and Gemini cache that repeated part automatically on OpenRouter.
  - For Claude models (`anthropic/…`), Kairoq marks cache breakpoints (`cache_control`): on the system prompt and on the last two large user messages. Cache reads cost about a tenth of the normal input price, and cache writes about 1.25×.
  - Turn it off with `KAIROQ_PROMPT_CACHE=off`.
- **Small edits instead of whole files.** The model's output is the most expensive part of a call (about 5× the input price for Claude). In Build mode the model can reply with `"edits":{"src/file.jsx":[{"find":"…","replace":"…"}]}`, and in Agent mode it can use the `edit_files` tool, instead of rewriting whole files.
  - Each `find` must match exactly one place. An exact match is tried first, then one that ignores indentation and trailing spaces.
  - If any edit fails, nothing is applied, and the model is told which edit failed and why.
  - New files, and files that mostly change, are still sent whole.
  - A one-line change shrinks from the whole file to a few hundred characters of output.
- **Cut-off replies are continued.** When a reply hits the output limit (`finish_reason: length`), Kairoq asks the model to continue exactly where it stopped and joins the parts, instead of failing and falling back to another model. This allows up to `KAIROQ_CONTINUATIONS` extra requests (default 2), as Bolt.new and Dyad do.
- **Failed edits escalate.** After the first failed find/replace, the model is told to copy `find` exactly. After a second failure, it must send whole files. A fix that didn't work is followed by "take a different approach", not a small variation.
- **Usage ledger.** Every paid AI call records its cost, model, tier and how many prompt tokens came from the cache.
- **Cost report.** The server owner sees **Settings → AI costs, last 30 days**, also available as `GET /api/create/admin/costs`. It shows calls, total and average cost per tier and model, the share of tokens read from cache, and what one message of that tier sells for at `KAIROQ_CREDIT_PRICE_USD` per credit (default $0.25). Rows that cost more than they earn are shown in red.

## Watching the AI work

Like Lovable, the chat stays clean and the details open beside it.

- **Timeline** (`react-timeline.js`). Every Build, Agent and Polish change records what happened, streams it to the editor as it happens, and keeps it with the finished message:
  - thoughts (the model's reasoning, how long it thought, and in Agent mode each step's headline);
  - the plan (2 to 6 steps the model writes before the code);
  - files read, and files created, edited or deleted;
  - builds, browser tests, saved checks and each fix with its reason;
  - design directions, generated images, database queries and web searches.
- **In the chat:**
  - **While it works**, a shimmering status line ("Writing ChildUsageCard.jsx", "Testing in a browser") with a timer and a Stop button, and the latest activity on a small rail.
  - **Finished answers** have no bubble. They show "Thought for Ns", the answer as formatted text (headings, lists, bold, code), a folded summary ("Edited 3 files · tested in a browser · fixed 1 problem") that opens the rail, and the version, duration, credits and a **Details** link.
- **Details panel.** Click the status line, "Thought for Ns" or Details. A panel opens over the preview, with:
  - **Back to preview**, the duration and the credits;
  - **Timeline**: the full rail. Thoughts and errors expand, and each edited file expands to its diff. The finished answer comes last.
  - **Changes**: every file the version changed, with a line diff from `GET /api/create/projects/:id/changes?version=n`.
  - Esc or any preview toolbar button closes it.
- To keep the editor light, the full reasoning is sent only for the last 10 messages.
- **Fonts.** Geist and Geist Mono.

## Showcase: Travellez (website and app)

`templates/travellez` is a complete corporate travel and spend product built through Kairoq. Its website follows the real travellez.com, with its copy, brand and page structure, and was built with the craft skills above.

- **Website.**
  - Home: hero with the product on a laptop and phone, Smart Itinerary, "Six tabs. Or one trip.", the live inventory stream, the trip-brief demo, stakeholders, product tabs, the AI Copilot demo, the savings calculator, the comparison and the early-access band.
  - Smart Itinerary (`#/product/smart-itinerary`): a London trip where each segment can swap to the smarter option, with the running total.
  - Pricing: monthly or annual billing, a team-size slider that recommends a plan, and the compare table.
  - Savings calculator: the travellez.com formulas. At the defaults (40 travelers, 6 trips, $1,800, 29% hotel) it shows $432,000 a year and $94,915 recoverable.
  - Book a demo, and Solutions for finance, travel managers and travelers.
- **Design.** Warm paper (#fbfaf9), ink (#14161a) and one red (#ef3444). Sora and Plus Jakarta Sans. framer-motion reveals and Lenis smooth scrolling, both off with reduced motion.
- **Workspace** behind sign-in: Dashboard, Trips, Approvals, Spend, Travelers, Controls (in CAD by default).
- **Backend.** SQL tables (`sql/001_init.sql`) and two server functions. Each account is its own company workspace.
  - `functions/travel.js` enforces the workflow in SQL: a trip is approved only while requested and booked only once approved; an expense goes draft → submitted → paid. Trip caps, booking ahead and automatic approval for small in-policy trips are checked when a trip is requested.
  - `functions/lead.js` saves demo requests and calculator breakdown requests. It is public, with a honeypot and one request per email a day.
- **Pipeline run.** `node scripts/showcase-travellez.js <out-dir> [port]` sends it through the Build pipeline: build, browser test and timeline.
  - It saves three user journeys as checks and runs them on desktop and phone: website navigation (including the itinerary savings, the plan fit and the calculator total), book a demo, and create workspace → approve → book.
  - It then publishes the app and takes full-page screenshots.
- **Template.** It is available as the "Corporate travel & spend" template.

## Synthetic customers

Test an app on AI customers before real ones arrive. Open **Customers** in the editor (or use the MCP server below).

- **How a test runs** (`synthetic-customers.js`):
  1. Describe who your customers are and what they come to do. Kairoq creates that many personas (default 10, at most `KAIROQ_SYNTHETIC_MAX`, 50), each with an age, a device (mostly phones), patience and tech comfort.
  2. Each persona opens the current version in a real browser (`runtime-check.session`, the same guard as checks) on a **test copy of the app's data**, so no real bookings, emails or payments happen.
  3. At every step the persona sees the page text and numbered buttons, links and fields, thinks out loud, and clicks, types, selects, scrolls, goes back, finishes or gives up. A visit has at most `KAIROQ_SYNTHETIC_STEPS` (12) steps; `KAIROQ_SYNTHETIC_CONCURRENCY` (4) visits run at once.
- **The report:**
  - **Counted from the visits, not the model:** how many reached the goal, gave up or ran out of steps, where the others left, results by device, and how many got frustrated.
  - **From the model:** a headline, the main issues with quotes, and suggested fixes.
  - **Checked by replaying what visitors did:** see Fix and retest below.
  - **Only send to the chat** sends the issues to the builder as an ordinary change request.
  - Reports are kept per project (the last 20).
- **Price:** each visitor costs a Discuss message on the chosen tier, paid up front. Credits come back only if the run fails before a report exists.
- Synthetic visitors show likely friction (unclear copy, hidden buttons, long forms). They are not a prediction of real sales.

### Other websites, and comparing two sites

The same customers can visit any public website the person has permission to test, for example the same app built with another tool. Open **Test another website, or compare with one** in the Customers dialog. Either put in a link to test instead of this app, or a link to compare with it.
- **Same customers:** in a comparison, the personas are created once and visit both sites, so the numbers compare like for like. Each site gets its own report, and both are linked to the comparison.
- **For the fairest comparison, test two published links.** For example, the Kairoq app's published link against the other tool's. Both sites then have their sends answered the same way.
- **Nothing is really sent:** on another website, every request that would change something (POST, PUT, PATCH, DELETE) is answered by Kairoq and never reaches the site. So nothing is booked, emailed or paid. The visitor is told the form was sent, and the report counts how many visitors sent one (`sent_form`). Links to other sites do nothing, so the visitor stays on the site being tested.
- **Safe browsing:** Chromium reaches other websites only through a local proxy (`runtime-check.js`). The proxy looks up each name itself and connects only to public addresses on port 443. Links, redirects and DNS tricks therefore cannot reach internal hosts or cloud metadata. Links must be https, use a public name (not an IP address), and have no password or unusual port.
- **Limits:**
  - The person must confirm they own the site or have permission to test it. This is recorded in the report.
  - At most `KAIROQ_SYNTHETIC_SITE_MAX` (25) visitors per site.
  - At most `KAIROQ_SYNTHETIC_SITE_PER_HOUR` (6) such tests per account per hour.
- **What another website does not get:** plain-English code cards and Fix and retest, because Kairoq doesn't have that site's code. Replays still confirm problems.
- **Price:** each visitor on each site costs the same as a normal test.

### Fix and retest

A report is the start; the repair loop (`synthetic-repair.js`) goes on to **reproduce → fix → retest → lock in**:

1. **Reproduce (free, part of every test).** Each visit that did not reach the goal is replayed step by step in a fresh browser, on a test copy of the data, with no model. Every problem gets one of these labels:
   - **Confirmed:** the replay shows the problem again. That means a click that fails, a page error, or a button that changes nothing on the screen.
   - **Could not reproduce:** a failure that does not happen again. It is left alone, so the builder does not "fix" something that works.
   - **Visitor experience:** for example "the price felt high", or leaving without pressing anything. Opinions cannot be replayed. They are judged by the rerun.
2. **Fix.** **Fix and retest** sends these to the builder:
   - the confirmed problems, with the exact steps and the file and line behind the element;
   - what visitors found hard.
   It also lists the problems that could not be reproduced, as ones to leave alone.
3. **Retest.** The same steps are replayed on the new version. Each confirmed problem is then marked one of:
   - **fixed**;
   - **still there:** the next round tells the builder its previous fix did not work;
   - **steps changed:** for example the button was renamed. The rerun judges it.
   Rounds stop when everything is fixed, when a later round fixes nothing more, or at the chosen maximum (1 to 3, at most `KAIROQ_REPAIR_ROUNDS`, default 3).
4. **Lock in.** Each fixed problem becomes a **saved check**: the visitor's steps, plus an expectation of the text the working step now shows, such as "Thank you, Ana". It is verified on the new version first. From then on it runs after every change and before publishing, so the problem cannot quietly come back.
5. **Rerun (optional).** The same customers use the new version, and you get a before-and-after: for example "0 of 3 → 2 of 3 reached the goal". Issues are marked **no longer reported**, **still reported** or **new**. The rerun is saved as its own report, linked to the original.

**Price:**
- Each fix round costs a chat edit on the chosen tier. The rerun costs the test's price.
- Each is charged when it starts, so rounds that are never needed are never charged. The editor shows the most it can cost.
- A round or rerun that fails is refunded.
- **Fix rounds:** a round that fixes none of the confirmed problems is free. A round that fixes some problems but leaves errors is charged (refunded only in `KAIROQ_PAY_WHEN_WORKS=refund`).

**MCP:** the `fix_and_retest` tool does the same for AI assistants. `get_synthetic_test` follows the job.

## Customers before code

Lovable and Replit help you build an app. This helps you build a business: find out whether people want it before building it, then see every week what stops signups (`growth.js`). Open **Launch** in the editor.

### Launch: test the idea first
1. **Describe the idea** in a new project, set a signups goal (default 20) and choose how many AI customers react (default 8).
2. **The pitch.** Kairoq writes:
   - the pitch: product name, headline, benefits, the waitlist button and an optional question;
   - launch posts for Reddit (with communities where it genuinely fits), LinkedIn, WhatsApp groups, X and an email to contacts.
   Nothing is invented: no numbers, customers, reviews or press. Every post says you are the founder and asks for honest feedback. You share them yourself.
3. **The landing page.** The builder makes a one-page landing page with a waitlist. Signups are saved in a `waitlist` collection with `submit-only` access: visitors can join, only the owner can read the list.
4. **AI customers react.** They visit the page on a test copy of its data and decide whether to join. They never join the real list. You see how many joined, their objections in their own words, and the full report.
5. **Publish and share.** Your link is filled into the posts. Real signups on the published page count toward the goal:
   - *Not live*: the page isn't published yet;
   - *Collecting*: published, with signups below the goal;
   - *Ready*: "People want this: build it."
6. **Price:** a Discuss message for the pitch, a chat edit for the page, and the test price for the AI customers. Each is charged when it starts. A part that fails, or a page that shows errors, is free.

A launch only starts in a new project, so an existing app is never replaced by a landing page.

### Growth watch: after launch
- **Turn it on in Launch.** Say who your customers are, what they should do, and which collection holds signups (it defaults to `waitlist`).
- **Every week** (`KAIROQ_WATCH_CHECK_HOURS`, checked every 6 hours; each project runs every 7 days):
  - AI customers (default 5) use the **published** version on a test copy of its data.
  - Kairoq counts real visitors (privacy-friendly analytics) and real signups for this week and last week.
- **The brief:** a plain-English weekly summary. It covers the headline with numbers, what is stopping signups (with evidence), what to change next and what is working. It is kept in the project (the last 12) and emailed to the owner. The report behind it opens in Customers, ready for **Fix and retest**, where you pay only for fixes that work.
- **Price:** the owner's account pays the AI customers' visits each week. A run that fails is refunded. An owner who is out of credits is skipped and told once; the watch continues after they top up.
- **Run now** runs it straight away.

## Web research and browsing

The AI can use the web the way a person does before building: search, open any public website in a real browser (JavaScript runs), read it and click through it.

- **Build and Discuss:** when a message contains a link or asks to look something up ("search", "latest", "docs", "pricing of", "compare", a site name…), Kairoq first decides what to search and open (at most 6 actions over two rounds), reads the pages and gives the result to the model with the request. The reply lists its **Sources** under the message. Nothing is charged for the research itself. `KAIROQ_WEB_RESEARCH=off` disables it.
- **Agent mode:** the agent has the tools `web_search`, `web_open` (open a site and read its text plus a numbered list of links, buttons and fields; Pro and Max also get a screenshot), `web_act` (click, type, select, scroll and go back on the open page, by number or by text) and `fetch_url` (raw page or JSON API). At most `KAIROQ_WEB_MAX_ACTIONS` (30) browser actions per task.
- **Safety:** pages open in the same guarded browser as synthetic customers on other websites: public https sites only (no private addresses, ports or credentials), reading only (anything but GET is answered locally, so no form is ever sent to another site), and the browser stays on the site it opened. Page text is given to the model as information, never as instructions. Search uses Brave when `BRAVE_SEARCH_API_KEY` is set, otherwise public Bing RSS or DuckDuckGo results. `KAIROQ_WEB_PAGE_CHARS` (7000) caps how much of a page the model sees.

## Explain it in plain English

For owners who do not read code, Kairoq explains problems and changes in plain English (`explain.js`). Each problem gets a card:
- **What is happening:** one sentence, with the numbers.
- **Where:** the element in plain words, plus the file and line behind it.
- **Why**, **what it costs**, and **the fix.**
- **Show me the code:** the real source lines, with what each important line means.

**Where it appears:**
- **Synthetic-customer reports.** Every issue becomes a card. The card points at the exact elements visitors used, or saw when they gave up. Every build tags elements with `data-kq` file and line locations, so this is a real location, not a guess. These cards are part of the test's price. **Fix this** sends that one problem, with its file and line, to the builder.
- **Errors in the preview.** **Explain** sits next to **Fix it**. If the source does not clearly show the cause, the card says the place is only the most likely one.
- **Changes.** **Explain in plain English** in the Changes tab of Details describes what visitors will notice in that version.

**How it stays accurate and what it costs:**
- The code shown always comes from the project's source. Lines or files the model names that do not exist are dropped.
- `POST /api/create/projects/:id/explain` takes `{kind: "error" | "check" | "change", text, version}`.
- Each explanation costs a Discuss message (editor access). Credits come back if no explanation could be written.

## API keys and the MCP server

AI assistants that support MCP (Claude, ChatGPT, Cursor and others) can use Kairoq for an account.

- **API keys:**
  - Create them in **Settings → API keys and MCP** (`GET/POST/DELETE /api/create/api-keys`).
  - A key (`kq_…`) is shown once. Only its hash is stored. An account can keep up to 10 keys.
- **The MCP server:** `POST /mcp` speaks MCP over Streamable HTTP with JSON responses (`kairoq-mcp.js`, protocol versions 2025-06-18, 2025-03-26 and 2024-11-05). Send the header `Authorization: Bearer kq_…`.
- **Build tools** (what an agent platform needs to use Kairoq as its app builder):
  - `list_templates` lists the working apps to start from.
  - `create_project` creates an app from a prompt and/or a template; with a prompt it starts the first build and returns a `job_id`.
  - `build` asks for a change (`mode` build) or a bigger task (`mode` agent); returns a `job_id`. `fix: true` marks a fix of a problem Kairoq reported (the first fix of a problem is free).
  - `get_job` follows a job: progress, then the message, version, preview URL, browser errors, failing checks and sources.
  - `get_project` returns the project's state: preview URL, published URLs, files, checks, automations, last messages.
  - `publish` puts the current version live (saved checks run first; `force` overrides).
- **Test tools:**
  - `list_projects` lists the projects the account can open.
  - `run_synthetic_test` sends synthetic customers through a project (editor access, charges credits). With `site` it tests another public website instead. With `compare_with`, the same customers visit both and you get both scores. Both need `permission: true`. It returns a job id.
  - `get_synthetic_test` returns the progress of a job, or a finished report with its fix request and which problems the replays confirmed.
  - `fix_and_retest` fixes what a report confirmed, replays the same steps, saves checks and can rerun the same customers (editor access, charges per round). It returns a job id.
  - `list_synthetic_reports` lists a project's reports.
- **Access:** every call uses the account's own project roles and credits. A key from another account cannot see or test the project.

### Using Kairoq from Paperclip and other agent platforms

Platforms that run teams of AI agents (Paperclip, and any assistant or orchestrator that can connect an MCP server) can give their agents Kairoq as "the employee that builds, tests and publishes apps":

1. In Kairoq, create an API key under **Settings → API keys and MCP**.
2. In the platform, add an MCP server (Paperclip: **Apps & Connections → your own MCP server**) with the URL `https://<your Kairoq host>/mcp`, transport Streamable HTTP, and the header `Authorization: Bearer kq_…`. Set the actions you want gated (for example `publish` and `build` to "Ask first").
3. Agents can then `create_project` → `get_job` → `get_project` → `publish`, run `run_synthetic_test` and `fix_and_retest` on the result, and read the plain-English reports, all against the key owner's credits and projects.

The whole loop is covered by `test/mcp-build.test.js`.

## Build from a reference

Give Kairoq a website, a GitHub repository, screenshots or the files of a JavaScript app. It studies how the product works, writes a plan for you to approve, and builds **its own version**: comparable features and design quality, with an original name, original text and openly licensed or generated images. Open it with **Reference** in the editor.

1. **Analyze** (`react-reference.js`). One credit-priced step (a Discuss message on the chosen tier, with images). Refunded if it fails.
   - **Website.** A real browser (Playwright) opens up to 6 public pages of the site, navigation first. It records:
     - headings, navigation, buttons and forms (fields, labels, required);
     - the API calls the pages make: method, path, query names and the JSON *shape* (keys and types, never values);
     - an OpenAPI document if the site publishes one at a well-known path;
     - third-party services it can recognise (Stripe, maps, chat, analytics, booking engines and so on);
     - computed design values: colours, fonts, type scale, radii, shadows, breakpoints, animations and sticky elements;
     - the home page on a 390px phone: menu button, sideways overflow, bottom bar;
     - screenshots on desktop and phone.
   - **What the website analysis never does.** It reads only what any visitor's browser receives. It follows `robots.txt`, never signs in, submits forms or follows logout and delete links, and only opens public hosts (private and internal addresses are blocked, including after DNS lookup).
   - **GitHub repository.** Reads the license, languages, frameworks (from `package.json`), the route, page and model files, the README, the schema files (Prisma or SQL) and any OpenAPI file. A private repository uses the project's GitHub token. It never reads `.env` files or `node_modules`. If the license is not permissive (MIT, Apache-2.0, BSD, ISC and similar), the plan says so and the AI writes all code itself.
   - **Screenshots.** Up to 4 images. The planner sees them.
   - **App files with REA.** A zip of a JavaScript or Electron app (an ASAR file inside is used directly), analyzed with [REA](https://github.com/morluto/rea) `analyze-javascript-application`. You must confirm that you own the app or have the right to analyze it. This needs REA on the server (below).
2. **Plan.** The model turns the analysis into a feature inventory with priorities, plus:
   - pages and their sections, data collections, sign-in and roles, and integrations with the documented API or SDK and app secret each one needs;
   - server functions, user journeys to test, a design direction (palette and fonts from Kairoq's list), assets to look for, build steps and assumptions.
   - The plan is shown in the dialog. Untick features you don't want, or edit the full JSON.
3. **Build.** Runs as an Agent task with the approved plan, with the reference screenshots as visual input. Before the agent starts:
   - The plan's design becomes the project's colours and fonts.
   - Kairoq looks for **openly licensed assets** (`react-asset-search.js`):
     - photos and sounds from Openverse, only with licenses that allow commercial use (CC0, public domain, CC BY, CC BY-SA);
     - 3D models from Poly Haven (CC0); generated apps can show them with `three`.
   - Photos are saved as uploads, and every asset's credit is kept in the project. The AI is told to add a "Photo credits" line where a license requires attribution.
4. **Test and repair** (`react-reference-run.js`).
   - Each planned journey is written as a saved check and run in a browser on desktop and on a phone. The phone run also fails on sideways scrolling.
   - Failures go back to the AI with the exact failing step, for up to two repair rounds.
   - A journey that still fails on desktop is switched off, so it does not block later changes, and reported. Journeys that never passed do not make the build free; browser errors do (pay only when it works).
   - The finished app is then screenshotted and compared with the reference by the design model (a 0 to 10 score, strengths and concrete improvements, never "copy their brand"). Below 8, Kairoq runs one Polish pass with those improvements.
5. **Deploy** (owners only, optional).
   - **Publish when every journey passes** publishes the app, then opens the live site in the browser to check it has no errors and, with a public URL, that it answers.
   - **Push to GitHub** pushes the source with the project's GitHub token (Settings).
   - Hosting runs on Kairoq's own server (Railway), with custom domains as usual. Each app's database, sign-in and storage are built in, so nothing else has to be provisioned.

- **Price.** A reference build costs an agent task plus `KAIROQ_REFERENCE_CREDITS` for the tests, repairs and design review (default: twice the tier price plus one design review). The dialog shows both prices.
- **REA.** Install it on the server (`npm install --global rea-agents`, Node 22.19 or newer) and set `KAIROQ_REA_COMMAND=rea`. With REA:
  - website analysis also records the browser session as a HAR file and adds REA's `inspect-web-network-capture` analysis to the plan;
  - zip uploads of JavaScript or Electron apps are accepted.
  - Native binaries (which need Hopper, Ghidra or IDA) are not supported on a hosted server.
- **Turning parts off.** `KAIROQ_ASSET_SEARCH=off` stops the asset search (photos can still be generated). Without a browser on the server, use a repository or screenshots.
- **Responsible use.** The prompts tell the AI to study and not copy. Kairoq does not get around logins, paywalls, `robots.txt` or terms of service, and the owner is responsible for having the right to use what they analyze.

## Growth features

- **Landing page and pricing.**
  - Signed-out visitors to `/create` see a landing page with features, the templates gallery, live pricing and sign-up.
  - Pricing is built from the free credits, `KAIROQ_PLANS` and `KAIROQ_CREDIT_PACKS`.
  - A prompt typed on the landing page is built automatically right after sign-up.
- **Templates.** Six starter apps (`create-templates.js`): restaurant, hotel guest portal, SaaS landing page, team CRM, appointment booking, portfolio. Each one is a working app using the backend, and you keep building on it through chat.
- **Monthly plans.**
  - `KAIROQ_PLANS` lists Stripe subscription Prices. Checkout runs in subscription mode.
  - Every paid invoice (first and renewals) adds the plan's credits, once per invoice, after re-reading the invoice and subscription from Stripe.
  - Cancellation ends the plan. Credits already paid for are kept.
  - **Manage billing** opens Stripe's customer portal.
  - Add webhook events `invoice.paid`, `customer.subscription.updated` and `customer.subscription.deleted` to the account webhook.
- **Collaborators.**
  - The owner invites people by email as **editor** (chat, visual edits, restore, publish) or **viewer** (read-only).
  - Settings, domains, GitHub, sharing, members and deleting stay with the owner.
  - Each person spends their own credits.
- **Share links and remix.**
  - **Share** creates a public link (`/create/share/<token>`) that shows a live preview.
  - With remix enabled, anyone signed in can copy the app's code and images into their own account. Data and keys are never copied.
  - Turning sharing off disables the link.
- **Analytics.**
  - Published pages count views and daily unique visitors on the server.
  - No cookies and no scripts. A visitor is a salted hash of IP and browser that changes daily.
  - Bots, previews and asset requests are skipped.
  - Totals, a 30-day chart and top referrers appear in **Publish**.
- **SEO.**
  - Published pages get a title, description, canonical URL and Open Graph/Twitter tags, plus `robots.txt` and `sitemap.xml`.
  - If no share image is set, Kairoq takes a 1200×630 screenshot when you publish.

## Scale and operations

- **Parallel builds.** Vite builds run in worker threads (`KAIROQ_BUILD_WORKERS`, default 2), so several projects build at once without blocking the server. A build that exceeds `KAIROQ_BUILD_TIMEOUT_MS` is stopped by terminating its worker.
- **Backups.**
  - Every day, `VACUUM INTO` writes consistent copies of the accounts database and each app's database, plus the hosting registry, to `workspace/backups/<timestamp>/`.
  - Backups are kept for `KAIROQ_BACKUP_DAYS` (default 7).
  - The owner can run one on demand (`POST /api/create/admin/backup`) and see build, job and account counts (`GET /api/create/admin/status`).
  - These backups live on the same volume, so also enable Railway volume backups, or copy the folder off-site.
- **Rate limits** use the last `X-Forwarded-For` entry (the one Railway's proxy adds), so clients can't spoof their address to get around them.
- **Postgres.** Everything is SQLite on the Railway volume today, which suits one server. To run several servers, move accounts and app data to Postgres, and builds and projects to shared storage. The data access is isolated in `builder-accounts.js`, `react-backend.js` and `react-analytics.js`, which keeps that move contained.

## Checking real-model quality

`scripts/create-quality-check.js` builds six typical apps with the configured model. It applies a follow-up edit to each, opens every result in Chromium, and reports pass/fail, attempts and timing. It spends real model credit (roughly a few cents per app with DeepSeek).

```
OPENROUTER_API_KEY=... KAIROQ_BUILDER_MODE=paid-first KAIROQ_BUILDER_PAID_APPROVED=true \
  node scripts/create-quality-check.js --limit 6 --out quality-report.json
```

## Publishing and domains

- **Publish** makes a version live at `/sites/<name>/` on the Kairoq host. Publishing again moves it to the current version.
- **Subdomains (optional):** set `KAIROQ_SITES_DOMAIN` to a **separate domain you own only for published apps** (for example `example-sites.com`, not a subdomain of Kairoq's own domain), point wildcard DNS `*.example-sites.com` at Kairoq, and add the wildcard domain in Railway. Published apps are then also served at `<name>.example-sites.com`.
  - Published apps run their own code without a sandbox on these subdomains, so they must not share a site with the editor. Kairoq logs a warning at startup when `KAIROQ_SITES_DOMAIN` shares its parent domain with `KAIROQ_PUBLIC_URL`.
- **Custom domains:** the customer adds a domain. Kairoq shows two DNS records: a `CNAME` to Kairoq and a `TXT` record at `_kairoq.<domain>` that proves ownership. After **Verify** succeeds, requests for that host serve the published app.
- **HTTPS for custom domains:** Railway issues certificates only for domains added to the service. Add each verified custom domain in Railway (Settings → Networking → Custom Domain) until this is automated through the Railway API.

## Accounts and credits

- Customers sign up at `/create` with email and password. Passwords are hashed with scrypt. Sessions are random tokens, stored hashed, in an HttpOnly cookie.
- New accounts get `KAIROQ_FREE_CREDITS` credits (default 30). When email is set up, they are granted once the address is verified (by the email link, a password reset or Google sign-in), so throwaway sign-ups cannot collect them. Each chat edit costs 1 credit, taken when the edit starts and refunded if it fails.
- The owner login (`APP_PASSWORD`) builds without credits. **Set `APP_PASSWORD` in production.** Without it, every visitor counts as the owner.
- `KAIROQ_BUILDER_SIGNUPS=closed` turns off new sign-ups.

### Selling credits with Stripe

1. In Stripe, create a product with one-time Prices for each credit pack.
2. Set `KAIROQ_STRIPE_SECRET_KEY` and `KAIROQ_CREDIT_PACKS`, for example:
   `[{"id":"starter","name":"Starter","credits":100,"price":"price_...","label":"$20"}]`
3. In Stripe, add a webhook endpoint `https://<your-kairoq-host>/api/create/stripe/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`, and set `KAIROQ_STRIPE_WEBHOOK_SECRET` to its signing secret.

Credits are added only after the webhook signature is checked and the Checkout Session is read back from Stripe with `payment_status: paid`. Each session is credited once.

## Storage

| Data | Location |
|---|---|
| Projects, versions, builds | `workspace/react-projects/` (`KAIROQ_REACT_PROJECTS_DIR`) |
| Published names and domains | `workspace/react-projects/hosting.json` |
| Accounts, sessions, credit ledger | `workspace/builder-accounts.sqlite` (`KAIROQ_BUILDER_ACCOUNTS_DB`) |

On Railway, `workspace/` should be on the persistent volume.

## Limits

- Up to 80 source files, 200 KB per file and 1.5 MB per project.
- Third-party images or fonts that fail to load are not reported as app problems (no Fix it), since they aren't code errors.
- Builds run in `KAIROQ_BUILD_WORKERS` worker threads and time out after `KAIROQ_BUILD_TIMEOUT_MS` (90 seconds).
