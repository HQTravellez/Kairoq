# Optional external software analysis tools

Kairoq integrates **discovery-only** support for [HKUDS/CLI-Anything](https://github.com/HKUDS/CLI-Anything) and **static JavaScript/Electron inspection** through [morluto/rea](https://github.com/morluto/rea).

Neither dependency is downloaded or executed automatically. Both flags default **off**. The current app builder runs on Node 22+; REA requires Node >=22.23.4 in the 22 series (or a supported newer series). Install on a dedicated sandbox runner and verify tool versions first.

## CLI-Anything

Install an approved version of CLI-Hub into the sandbox, then set `KAIROQ_CLI_ANYTHING_ENABLED=true`. Available OpenCode tool actions:

- `kairoq_cli_harness_list` → `cli-hub list`
- `kairoq_cli_harness_info` → `cli-hub info <identifier>`

These only discover harnesses. They **do not** launch installed programs, create a CLI harness, download packages, or grant a shell. External command execution needs a separate isolated, allowlisted execution service with approval and observable results.

## REA

Install the official `rea-agents` CLI in the isolated runner, verify provenance and licenses and set `KAIROQ_REA_ENABLED=true`. `kairoq_rea_javascript_inspect` accepts a **workspace-relative** extracted JS/Electron folder or ASAR file and runs `rea analyze-javascript-application <workspace-target> --json`. No native decompilation, dynamic analysis or website reverse engineering is exposed by this adapter.

Guardrails: no shell, 30s timeout, 128 KiB output limit, no arbitrary command strings, restricted workspace path with symlink canonicalization, and no ambient credential propagation (only PATH and HOME). Always use only software you own or are authorized to inspect; honor third-party licenses.

## Rollout

1. Execute `node --test test/external-agent-tools.test.js` and the relevant Kairoq builder suite.
2. Install tools in a dedicated sandbox/staging image, **not** production by default.
3. Enable one flag at a time and verify tool discovery and expected output.
4. Test that attempts to escape the workspace and inspect unapproved paths fail.
5. Only later design a separate approved execution capability for CLI harnesses; do not give the agent arbitrary shell privileges.

These integrations expand Kairoq's analysis/tool reach, **not** its ability to reproduce proprietary apps or safely execute untrusted programs automatically.
