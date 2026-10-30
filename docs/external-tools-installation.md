# CLI-Anything and REA: isolated installation

Upstream official packages:
- `cli-anything-hub==0.4.1` on PyPI (HKUDS/CLI-Anything), command `cli-hub`.
- `rea-agents@6.8.0` on npm (morluto/rea), command `rea`.

CI workflow `external-tool-install-smoke.yml` installs these pinned tools on a disposable GitHub Actions runner, executes read-only `cli-hub list --json` and static `rea analyze-javascript-application PATH --json` on a fabricated local JavaScript application.

These commands do NOT install or launch any external GUI harness, reverse engineer third-party software, or access unauthorized paths.

Production remains **opt-in at image build**: `docker build --build-arg KAIROQ_EXTERNAL_TOOLS_INSTALL=on`. Enabling the Railway environment flags alone does not install these executables. After changing build settings, redeploy and inspect container image outputs. Install in separate staging environment first. The runtime adapter still enforces `KAIROQ_CLI_ANYTHING_ENABLED` / `KAIROQ_REA_ENABLED` and workspace path restrictions. Do not activate both without testing the exact deployed image and workloads.

Minimum REA Node version: 22.23.4. Pin the runtime base accordingly when deploying the optional tool build. CI uses Node 22.23.4. CLI Hub may query its registry during `list`; egress must be approved in your environment.

Validation levels: committed / CI succeeded / image built / service deployed / actual tool executed are separate. CI success is not proof of production activation.
