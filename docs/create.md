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
- **Project knowledge.** Under **Settings**, owners write instructions the model follows on every message (brand, tone, rules). Up to 8,000 characters.
- **Security scan.** The **Security** button checks the code and backend settings: secrets in browser code, collections with personal data open to everyone, unsafe HTML, server functions that change data without checking the user, and unsigned webhooks. **Fix with AI** sends the findings to the model.
- **Agent mode.** For bigger tasks, the model works in steps until the job is done.
  - Tools: read and search files, write files, build and open the app in headless Chromium, run UI steps (click, fill, select, expect text, go to a route), read server logs, run SELECT queries on the app's SQL tables, search the web and read pages (`fetch_url` is SSRF-guarded).
  - Pro, Max and image tiers also get a screenshot after each test. Standard models (DeepSeek) get the page's visible text instead.
  - The result is one new version. The chat shows each step, and the finished message keeps a list of them.
  - Limits: `KAIROQ_AGENT_MAX_STEPS` (15) steps per task. A task costs the tier's credits × `KAIROQ_AGENT_MULTIPLIER` (3).
  - **Stop** cancels any running job (build, discuss or agent) and refunds its credits.
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
  - The server checks for due jobs every 5 minutes.

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

Generated apps can import: react, react-dom, react-router-dom, lucide-react, recharts, framer-motion, date-fns, clsx, tailwind-merge, class-variance-authority, zod, react-hook-form, the Radix primitives (dialog, dropdown-menu, tabs, tooltip, popover, select, accordion, switch), sonner, react-markdown, @tanstack/react-query, canvas-confetti, react-day-picker, embla-carousel-react and qrcode.react. Other imports are rejected before the build. Code downloads list only the packages the app uses.

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
- **Subdomains (optional):** set `KAIROQ_SITES_DOMAIN=sites.example.com`, point wildcard DNS `*.sites.example.com` at Kairoq, and add the wildcard domain in Railway. Published apps are then also served at `<name>.sites.example.com`.
- **Custom domains:** the customer adds a domain. Kairoq shows two DNS records: a `CNAME` to Kairoq and a `TXT` record at `_kairoq.<domain>` that proves ownership. After **Verify** succeeds, requests for that host serve the published app.
- **HTTPS for custom domains:** Railway issues certificates only for domains added to the service. Add each verified custom domain in Railway (Settings → Networking → Custom Domain) until this is automated through the Railway API.

## Accounts and credits

- Customers sign up at `/create` with email and password. Passwords are hashed with scrypt. Sessions are random tokens, stored hashed, in an HttpOnly cookie.
- New accounts get `KAIROQ_FREE_CREDITS` credits (default 30). Each chat edit costs 1 credit, taken when the edit starts and refunded if it fails.
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
- Builds run in `KAIROQ_BUILD_WORKERS` worker threads and time out after `KAIROQ_BUILD_TIMEOUT_MS` (90 seconds).
