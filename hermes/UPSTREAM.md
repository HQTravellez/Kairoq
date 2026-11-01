# Hermes Agent (upstream)

Kairoq's chat runs on Hermes Agent by Nous Research, used unmodified from its
official container image. Kairoq adds `config.yaml`, `entrypoint.sh` and the skill
libraries in `skills/`.

| | |
|---|---|
| Project | https://github.com/NousResearch/hermes-agent |
| License | MIT, © Nous Research |
| Image | `nousresearch/hermes-agent:v2026.9.24` |
| Source revision | `f97608f178d1ffeca59860195ab7da295f7c8e5f` (tag `v2026.9.24`, Hermes 0.21.5) |
| Config schema | `_config_version: 46` |
| Interface used | OpenAI-compatible API server: `POST /v1/chat/completions` (streamed), `GET /health` |

## Superpowers (skills)

| | |
|---|---|
| Project | https://github.com/obra/superpowers |
| License | MIT, © 2025 Jesse Vincent (`skills/superpowers/LICENSE`) |
| Source revision | `2ce8aa15d05bd57213e6f746f953aafb7ded7a8b` (2026-10-21) |
| Contents | all 15 skills from `skills/`, unmodified, in `skills/superpowers/` |

Shipped read-only at `/opt/kairoq/skills/superpowers` and listed in `skills.external_dirs`.
To update: replace `skills/superpowers/` with the `skills/` folder of a newer revision, keep
`LICENSE`, and update the revision above.

## Impeccable and Hallmark (design skills)

| | |
|---|---|
| Impeccable | https://github.com/pbakaus/impeccable, Apache-2.0, © Paul Bakaus; 4.8.0, the prebuilt Hermes skill (`.hermes/skills/impeccable/`) without `scripts/` (the launcher, binary and hooks need a terminal the agent does not have) |
| Hallmark | https://github.com/Nutlope/hallmark, MIT, © Hallmark contributors (Together AI); revision 4f6a46c, `skills/hallmark/` without `scripts/` and the theme pictures |
| Contents | `skills/design/impeccable/` (SKILL.md, reference/, LICENSE, NOTICE.md) and `skills/design/hallmark/` (SKILL.md, references/, agents/, LICENSE) |
| Change | One "Kairoq note" block at the top of each SKILL.md saying the script steps do not apply here |

Shipped read-only at `/opt/kairoq/skills/design`. The same two projects power the app builder's
design loop (`impeccable.js`, `hallmark.js`, `design-moves.js`).

## Upgrading

1. Pick a newer stable tag from the upstream releases and set `HERMES_TAG` in `Dockerfile`.
2. Set `_config_version` in `config.yaml` to that release's value
   (`hermes_cli/config_defaults.py`, key `_config_version`).
3. Check that every toolset name in `config.yaml` still exists in that release's `toolsets.py`.
4. Deploy to the Hermes service and run the checks in `docs/HERMES.md` (health, a reply in
   Kairoq, and `GET /v1/toolsets` showing only the six allowed toolsets enabled).
5. Update this file.
