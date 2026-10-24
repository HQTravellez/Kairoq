# Hermes Agent (upstream)

Kairoq's chat runs on Hermes Agent by Nous Research, used unmodified from its
official container image. Kairoq adds only `config.yaml` and `entrypoint.sh`.

| | |
|---|---|
| Project | https://github.com/NousResearch/hermes-agent |
| License | MIT, © Nous Research |
| Image | `nousresearch/hermes-agent:v2026.9.24` |
| Source revision | `f97608f178d1ffeca59860195ab7da295f7c8e5f` (tag `v2026.9.24`, Hermes 0.21.5) |
| Config schema | `_config_version: 46` |
| Interface used | OpenAI-compatible API server: `POST /v1/chat/completions` (streamed), `GET /health` |

## Upgrading

1. Pick a newer stable tag from the upstream releases and set `HERMES_TAG` in `Dockerfile`.
2. Set `_config_version` in `config.yaml` to that release's value
   (`hermes_cli/config_defaults.py`, key `_config_version`).
3. Check that every toolset name in `config.yaml` still exists in that release's `toolsets.py`.
4. Deploy to the Hermes service and run the checks in `docs/HERMES.md` (health, a reply in
   Kairoq, and `GET /v1/toolsets` showing only the six allowed toolsets enabled).
5. Update this file.
