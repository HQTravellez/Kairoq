# Kairoq + HyperFrames

Repository: https://github.com/heygen-com/hyperframes. License: Apache 2.0. Upstream commit inspected: \`4371981b740d92f70e520cfbec34db68a1c93434\`. The CLI version considered here is \`0.8.185\`.

## What Kairoq adds

\`hyperframes-video.js\` supports **deterministic HTML-native 3-second motion clips**, in 9:16 or 16:9, from bounded text and hex-brand-colour inputs. It creates a temp HyperFrames project with seekable GSAP timelines and calls the external CLI \`check --json\` and \`render --quality draft --fps 15 --output render.mp4\`. It verifies MP4 structure, filesize and duration with \`ffprobe\`.

This **does not** replace the existing fal/Wan photo animation, Remotion, or HeyGen avatars. The adapter enables text/card/brand motion suitable for intros and social captions; footage, music, TTS and full storyboard generation are later capabilities.

## Security and production restrictions

- **Disabled by default**; requires the explicit trusted-worker environment variable \`KAIROQ_HYPERFRAMES=on\` and an **absolute** \`HYPERFRAMES_BIN\` path to an installed CLI.
- Never installs or downloads packages at runtime. \`npx\` is not executed from a web request. HTML is generated from Kairoq's own static template, escaped text and limited brand inputs — users **cannot upload arbitrary scripts or compositions for execution**.
- The CLI is a browser-and-FFmpeg renderer. Run it **only in a separate, sandboxed worker** with CPU/memory/time limits, network and filesystem isolation. The existing Railway Kairoq API must **not** start arbitrary HyperFrames rendering tasks in its own web process.
- The CLI's environment is purposefully limited and contains no Kairoq account tokens, provider API keys or database URLs.
- There is no Kairoq HTTP/UI route or automatic production deployment in this PR. It is a backend prototype and offline rendering proof.
- The CLI may separately contact services if explicitly configured or if third-party references are allowed in compositions. Do not permit external assets, remote fonts or arbitrary URL captures in a production worker without a network policy.

## Running in a trusted isolated worker

Node >=22, FFmpeg, Chrome and \`hyperframes\` CLI required. Installation and enabling are **operator actions**.

For a pinned test worker install HyperFrames CLI \`0.8.185\` into a separate directory, for example \`npm install --prefix /tmp/hf-tools --no-save hyperframes@0.8.185\`. For live production, use a digest-pinned image and review dependency licenses and sandbox restrictions. Do not install in the Kairoq API container automatically.

Example (trusted test worker only):

\`\`\`sh
export KAIROQ_HYPERFRAMES=on
export HYPERFRAMES_BIN=/tmp/hf-tools/node_modules/.bin/hyperframes
export CHROMIUM_PATH=/usr/bin/chromium
node scripts/hyperframes-smoke.js
\`\`\`

The result is \`benchmark-artifacts/hyperframes-motion.mp4\` only after HyperFrames has passed its own \`check\`, the MP4 signature check and \`ffprobe\` duration check. Actual pixel/auditory quality still requires inspection.

## Verification

- \`node --test test/hyperframes-video.test.js\`: offline mock CLI tests for safe escaping, preconfigured binary, subprocess allowlist, no external model calls, invalid/corrupt files and incorrect duration.
- \`node scripts/hyperframes-smoke.js\`: real CLI smoke in opt-in worker, with actual MP4 artifact when supported.
- No third-party API key, GPU provider or HeyGen credits are required for local rendering. Compute and hosting resources are still consumed.

### Future release steps

1. Validate real video render and compare its actual frames against the source composition.
2. Add a dedicated queue-based, isolated HyperFrames rendering worker, with per-account quotas, cancellable jobs, and secure artifact storage.
3. Add a clearly labeled Motion Video choice to Kairoq's existing video section (alongside existing photo animation), then a verified preview/download flow.
4. Add full accessibility/contrast, responsive/video-format checks, brand presets, optional voice/music, and commercial licensing checks for uploaded media.

## Actual CI evidence (2026-10-21)

A real HyperFrames CLI `0.8.185` worker, with local GSAP `3.13.0`, checked and rendered the 3-second 9:16 example successfully: **145,959-byte MP4**, **3.000 seconds** validated via `ffprobe`; no model API calls. The isolated CI invocation is at https://github.com/HQTravellez/Kairoq/actions/runs/39708625583. Subsequent CI also decodes two PNG frames and verifies they are not identical. The files are downloadable as that run's `hyperframes-actual-render` artifact (the frame checks apply to subsequent runs). Real video generation is therefore demonstrated for this template, **not** for arbitrary source compositions.

Human visual and audio review, production queue isolation, quotas and deployment remain outstanding. Do not treat offline success as a fully integrated Kairoq video UI.
