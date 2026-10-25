# Kairoq: rules for working on this repo

Kairoq is Ka's product: a chat assistant, a Sales Agent and an app builder ("Create", `/create`).
It runs on Railway at kairoq-production.up.railway.app. Read this file before every task.

## How Ka wants work done

- **Research, plan, then build.** Plan the whole feature and its design before changing code;
  never fix things piecemeal or pick things at random. For anything bigger than a small fix:
  1. **Research**: read the code that is involved and anything Ka linked. Check whether Kairoq
     already has it (it often does: reference builds, looks, assets, checks, launch gate).
  2. **Plan**: send Ka a short plan in plain words (what he will see, what changes, what is
     left out) before writing code.
  3. **Build**, then **check**: tests, plus a real browser screenshot for anything visual.
     Look at the screenshot critically before showing it; "it renders" is not "it looks good".
- **Four coding habits** (from andrej-karpathy-skills, MIT; the same rules Kairoq's builder
  follows in `builder-method.js`):
  1. **Think before coding**: read the code, state assumptions, ask only when truly blocked.
  2. **Keep it simple**: the smallest solution that works; no speculative extras.
  3. **Change only what's needed**: touch only the files and lines the task needs.
  4. **Prove it**: define what "done" means first, then run the tests and report real results.
- **Crisp, plain answers.** Short replies, plain words, no jargon. Lead with the answer.
- **Wire things in for real.** When Ka shares a GitHub project, say honestly whether it fits;
  if it does, integrate it properly (not hidden behind a flag nobody turns on). Check the
  licence first: AGPL code cannot go into Kairoq's server; MIT, Apache-2.0, BSD and OFL can.
- Users see the agent as **"Kairoq Agent"**, never "Hermes" (Hermes Agent is MIT; the licence
  notice stays in `public/licenses.html`).

## Never

- Never type or paste API keys, passwords or secrets into websites or files. Ka adds keys to
  Railway himself; tell him the variable name.
- Never weaken security to make something work (for example TLS `rejectUnauthorized:false`).
  Find the proper fix (for Supabase: verify with its CA certificate).
- Never resolve merge conflicts in GitHub's web editor: it once kept both sides and broke main.
  Fix conflicts locally, run the tests, push.
- Never merge without Ka: he merges PRs himself, in the order given.
- Never invent data: no fake reviews, quotes, counts or test results.
- Never `pkill -f` a pattern that matches your own shell command (it kills the shell); kill by PID.

## Pull requests

- One feature per PR, branched from `main` (or from the PR it builds on, stated in the PR).
- PR text: what Ka will see, what is left out, how it was tested.
- Tell Ka the merge order. After merges, offer to check the live site.

## Tests

```
npm run check                      # syntax of the main files
node --test test/<file>.test.js    # one file (fast)
node --test                        # everything (long; run files separately when it stalls)
```

- Browser tests need Chromium: set `CHROMIUM_PATH` (CI uses `/usr/bin/chromium`).
- Tests that start a browser must call `require('./runtime-check').close()` at the end, or
  node never exits.
- **Known failures on main** (the CI `regression` check is red because of these; they are not
  caused by new PRs): chat-browser, concurrent-discuss-browser, create-edits, create-design,
  create-review-fixes, create-checks, create-reference (tests 8 and 9: "no scripted reply"),
  create-tier5, main-chat-link-research, mcp-build, model-picker-simplified, memory, web.
  Before saying a PR broke something, run the same file on `main` and compare the error.
  When CI fails only on these, comment once on the PR and re-run it once.

## Where things are

(Some of these arrive with PRs #162 to #167; until they are merged they live on those branches.)

| Area | Files |
|---|---|
| Server, chat, models | `server.js`, `public/app.js`, `public/index.html` |
| App builder API | `create-api.js` (routes; permissions in the `NEED` map) |
| App builder UI | `public/create.html`, `public/create.js`, `public/create.css` |
| Build engine | `react-builder.js` (prompt, allowed packages, Vite build, serving) |
| Generated app backend | `react-backend.js` (auth, collections), `react-sql.js` |
| Look and design | `looks.js`, `react-design.js`, `public/create-look.js` |
| Build from a reference | `react-reference.js`, `react-reference-run.js`, `react-reviews.js`, `react-parity.js`, `react-sweep.js` |
| Checks before going live | `runtime-check.js`, `react-checks.js`, `launch-gate.js` |
| 3D | `react-models.js`, `react-model3d.js`, `react-scene.js`, `blender.js` |
| Connected services | `docs/CONNECTED-SERVICES.md` (Supabase, Crawl4AI, Stirling PDF, last30days, Blender) |
| Licences of what we use | `THIRD_PARTY_NOTICES.md` |
