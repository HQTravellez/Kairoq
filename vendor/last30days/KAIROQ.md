# last30days in Kairoq

| | |
|---|---|
| Project | https://github.com/mvanhorn/last30days-skill |
| License | MIT, © 2026 Matt Van Horn (`LICENSE`) |
| Source revision | `f3cd06a620e385ce15109ed6d3b70fc20c89eccc` (2026-10-22, v3.30.0) |
| Contents | `skills/last30days/`: `SKILL.md`, `references/`, `scripts/` (unmodified), without `assets/`, developer scripts and caches |

Kairoq runs `scripts/last30days.py` itself from `last30days.js`:
- fixed arguments: `--research-only --emit=compact --no-browser-cookies --quick|--deep -- <topic>`;
- no shell, and a fresh empty `HOME`;
- only these keys are passed: Brave, ScrapeCreators, xAI, X, Serper and Perplexity.

The chat model then writes up the evidence.

To update, copy those folders from a newer revision, run `npm test -- test/last30days.test.js`, and
change the revision above.
