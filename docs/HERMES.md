# Hermes chat

Kairoq's chat is answered by **Hermes Agent** (Nous Research, MIT), running as its own
private Railway service from the official image. Kairoq talks to it through Hermes' built-in
OpenAI-compatible API server — no custom Python gateway, no copied Hermes code.

```
Browser ──► Kairoq (Node) ──private network──► Hermes service ──► model (OpenRouter by default)
             /api/chat/stream    POST /v1/chat/completions (SSE)
```

- **Who gets Hermes:** the signed-in owner. Anyone else, or a request for a local model, uses
  Kairoq's existing routes.
- **Fallback:** if Hermes can't start a reply (down, wrong key, busy, 20 s with no answer),
  Kairoq shows "Hermes unavailable — using backup model…" and uses the existing routes. If
  Hermes fails after text has appeared, the error is shown instead of mixing two answers.
- **History:** Kairoq sends the visible conversation every time, so edit/regenerate keep working.
- **Memory:** all requests share `X-Hermes-Session-Key: kairoq:owner`, so Hermes' long-term
  memory follows the owner across chats. Stored on the service's volume.
- **Tool progress** from Hermes (e.g. 🔍 Searching "…") appears in the chat status line.

## Skills: Superpowers

All 15 skills from [Superpowers](https://github.com/obra/superpowers) (Jesse Vincent, MIT)
ship in the Hermes image, unmodified, in `hermes/skills/superpowers/`. Hermes lists them in
its prompt and opens one when a request matches (e.g. *systematic-debugging* for a bug,
*brainstorming* before designing a feature, *writing-plans* for a multi-step job,
*verification-before-completion* before claiming something works). They are read-only to
Hermes. Skills that assume a terminal, git or sub-agents (worktrees, subagent-driven
development, finishing a branch) can only be followed as advice here, because chat Hermes
has no shell. Hermes' own bundled skills are also available.

## Memory and self-learning

Hermes keeps its own long-term memory and learns new skills by itself. Both live on the
service's volume (`/opt/data`), so they survive restarts and redeploys.

- **Within a chat:** Hermes sees the chat's last **100 messages** (other models get 50).
- **Every past chat:** all conversations are stored in Hermes' database and searchable with
  `session_search` (no limit, no extra cost), so it can look up something said weeks ago
  in another chat. Checked locally: a new chat found an earlier chat by searching for a
  word from it.
- **Always-on memory:** `memories/USER.md` (what it knows about you, up to 3,000 characters)
  and `memories/MEMORY.md` (its own notes, up to 5,000), loaded into every new chat. Every
  4 messages a background review saves anything worth keeping (4 is how often it checks,
  not a limit). Saying "remember that…" makes it save right away.
- **Self-learning:** when a reply takes 5 or more tool steps, a background review decides
  whether the approach is worth keeping and writes it as a new skill in `/opt/data/skills`.
  Learned skills show up in later chats next to Superpowers and Hermes' bundled skills.
- Settings: `memory.nudge_interval` and `skills.creation_nudge_interval` in
  `hermes/config.yaml`. Writes are not held for approval (`write_approval: false`), because
  nobody is at a terminal to approve them.
- Memory is shared by all of the owner's chats (one Hermes home, one owner). Ask Hermes
  "what do you remember about me?" to see it.

Checked locally on Hermes v2026.9.24 with a scripted model, using Kairoq's own client:
after 4 turns the review saved a fact to `USER.md`, and a brand-new chat had it in its
prompt; a 6-step reply triggered a skill review that saved `booking-inquiry-triage`, which
the next chat listed. Real models decide for themselves what is worth saving.

## What Hermes is allowed to do

Set in `hermes/config.yaml`, which is re-installed on every boot so nothing at runtime can
widen it.

| Allowed | Removed |
|---|---|
| web search and page reading, image understanding, long-term memory, past-chat recall, to-do planning, skills | terminal, files, browser automation, desktop control, code execution, sub-agents, scheduled jobs, connected accounts, image/video/speech generation, kanban, projects |

Checked locally against Hermes v2026.9.24 with a fake model that tried to run shell commands
and write files, directly and through Hermes' `tool_call`: every attempt was refused and
nothing was executed.

Web search needs no key: Hermes uses its free search providers unless you add one
(see Hermes' web-search docs).

## Railway setup

### 1. Hermes service

Reuse the existing **Kairoq Hermes Python** service or create a new one from this repo.

- **Settings → Config-as-code file:** `hermes/railway.json` (builds `hermes/Dockerfile`
  from the repo root, health check on `/health`).
- **Volume:** mount at **`/opt/data`** (Hermes' home: memory, sessions, skills). If the
  service already has a volume at `/data`, change its mount path to `/opt/data`.
- **No public domain.** Only the private network address is used.
- **Variables:**

| Variable | Value |
|---|---|
| `API_SERVER_KEY` | a new random secret, at least 32 characters (`openssl rand -hex 32`) |
| `OPENROUTER_API_KEY` | your OpenRouter key (reference the Kairoq service's variable) |
| `KAIROQ_HERMES_MODEL` | optional; default `openrouter/free`. A model with reliable tool calling gives better web answers |
| `PORT` | `8642` |

Optional: `KAIROQ_HERMES_PROVIDER` and `KAIROQ_HERMES_BASE_URL` to use another
OpenAI-compatible provider instead of OpenRouter.

The service refuses to start if `API_SERVER_KEY` is missing or shorter than 32 characters.

### 2. Kairoq service

| Variable | Value |
|---|---|
| `KAIROQ_HERMES_URL` | `http://<hermes-service-private-domain>:8642` (Railway shows the `….railway.internal` name) |
| `KAIROQ_HERMES_KEY` | the same value as `API_SERVER_KEY` |

Remove `KAIROQ_PYTHON_AGENT_URL` / `KAIROQ_PYTHON_AGENT_TOKEN` if they were set for the
earlier experiment; this integration doesn't use them.

### 3. Check it

1. Hermes service logs show `API server listening on http://:8642`.
2. Signed in to Kairoq, open `/api/hermes/status` → `{"configured":true,"ok":true}`.
3. Send a chat message. The status line shows "Hermes is thinking…" and the reply streams in.
4. Ask something current ("what's in the news about Railway today?") and watch for the
   search status line.

To turn Hermes off, delete `KAIROQ_HERMES_URL` on the Kairoq service. Chat goes back to the
existing routes immediately.

## Browser use in chat

Separate from Hermes. When a message asks Kairoq to **do or find something on a website**
("find the price of a double room on hotel.com", "open the browser and check example.com"),
chat opens the site in Kairoq's own headless Chromium and works through it with the browser
agent (`browser-agent.js`): clicking, typing, scrolling. Each step appears in the status line
and a live screenshot is shown above the answer. The answer ends with the list of steps taken.

- A bare link or "summarise this site" still goes to the page reader / Hermes.
- Owner only, public `https` sites only. Forms are never really submitted (runtime-check guards).
- Sites with captchas or sign-in walls end as "blocked" with a clear message.
- Uses the same model as the /create web agent; step limit `KAIROQ_WEB_TASK_STEPS` (default 15).
- If Chromium can't start, chat says so and falls back to reading the page.

Code: `chat-browser.js`, the `browser` SSE event in `public/app.js` (`showBrowserFrame`),
tests in `test/chat-browser.test.js` (runs a real Chromium when one is installed).

## Code

- `hermes-chat.js` — streaming client, timeouts, error handling, attachment conversion.
- `server.js` → `handleChat` — routing and fallback; `GET /api/hermes/status`.
- `hermes/` — Dockerfile, `config.yaml`, `entrypoint.sh`, `railway.json`, `UPSTREAM.md`.
- `test/hermes-chat.test.js` — runs without Hermes, against a fake of its API server.

## Fast replies (like the Hermes desktop app)

The Hermes desktop app feels instant because it uses a fast hosted model (Gemma 4 31B on
Ollama Cloud) and streams every word. Kairoq's "Free Auto" route instead waits in line for
free OpenRouter models and, when those are busy, falls back to providers that only send the
whole answer at the end, so a reply can take 20+ seconds and then appear all at once.

To get the same speed, point Kairoq's OpenAI-compatible model route at Ollama Cloud
(Railway → Kairoq service → Variables):

| Variable | Value |
|---|---|
| `LOCAL_LLM_BASE_URL` | `https://ollama.com/v1` |
| `LOCAL_LLM_API_KEY` | key from ollama.com/settings/keys |
| `LOCAL_LLM_MODEL` | `gemma4:31b` |

With `ZERO_COST_MODE` on (the default) chat tries this route first and streams it. Ollama
lists Gemma 4 31B at about $0.14 per million input tokens and $0.40 per million output tokens
and may ask for a payment method before the key works.

When Hermes is configured, owner chats go to Hermes first. Hermes adds memory and tools,
which costs a little time on each reply; how fast it feels then depends on the model Hermes
itself uses (`KAIROQ_HERMES_MODEL`).

### Thought panel

Models that share their thinking (`delta.reasoning`, `delta.reasoning_content`, or
`<think>…</think>` at the start of the answer) now show it live in a "Thinking…" panel above
the reply. It folds to "Thought for Ns" when the answer starts and is saved with the chat.
Hermes tool steps (searches, page reads) appear in the same panel. The **Low / Med / High**
picker next to the model sets how hard the model thinks (`reasoning_effort`).


## Fast app builds (Ollama Cloud)

Standard app builds use the free OpenRouter models by default. They wait in line and think without
showing anything, so a build takes about 4 minutes. With the same Ollama Cloud key, Kairoq sends
Standard builds to a fast coding model first. It streams the plan and files straight away, and if it
fails the usual models take over.

| Variable on the Kairoq service | Value |
|---|---|
| `LOCAL_LLM_BASE_URL` | `https://ollama.com/v1` |
| `LOCAL_LLM_API_KEY` | key from ollama.com/settings/keys |
| `KAIROQ_BUILDER_FAST_MODEL` (optional) | default `qwen3-coder:480b`; any Ollama Cloud model name |
| `KAIROQ_BUILDER_FAST` (optional) | `off` to turn it off |

Any other OpenAI-compatible endpoint works too, set with `KAIROQ_BUILDER_FAST_URL` and `KAIROQ_BUILDER_FAST_KEY`.
