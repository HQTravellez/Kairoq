FROM public.ecr.aws/docker/library/node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-liberation ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --omit=dev
# OpenCode as the build engine (opencode-engine.js) when the Railway variable KAIROQ_OPENCODE=on;
# then also set KAIROQ_BUILD_ENGINE=opencode to use it.
ARG KAIROQ_OPENCODE=off
RUN if [ "$KAIROQ_OPENCODE" = "on" ]; then npm install -g --omit=dev opencode-ai@1.18.34; fi
# Lightpanda, a light headless browser, as the fast lane for the live guard and for reading pages
# for search engines (runtime-check.js), when the Railway variable KAIROQ_LIGHTPANDA=on. It runs
# unmodified as its own process (AGPL-3.0, github.com/lightpanda-io/browser) with telemetry off;
# Chromium stays for everything else and confirms anything Lightpanda finds. Set
# LIGHTPANDA_SHA256 to pin the exact build (sha256sum of the downloaded file).
ARG KAIROQ_LIGHTPANDA=off
ARG LIGHTPANDA_URL=https://github.com/lightpanda-io/browser/releases/download/nightly/lightpanda-x86_64-linux
ARG LIGHTPANDA_SHA256=
RUN if [ "$KAIROQ_LIGHTPANDA" = "on" ]; then \
      apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/* && \
      curl -fsSL -o /usr/local/bin/lightpanda "$LIGHTPANDA_URL" && \
      if [ -n "$LIGHTPANDA_SHA256" ]; then echo "$LIGHTPANDA_SHA256  /usr/local/bin/lightpanda" | sha256sum -c -; fi && \
      chmod +x /usr/local/bin/lightpanda && LIGHTPANDA_DISABLE_TELEMETRY=true /usr/local/bin/lightpanda version; fi
ENV LIGHTPANDA_DISABLE_TELEMETRY=true
COPY . .
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV NODE_ENV=production TZ=UTC
# Bound Chromium/Playwright parallelism to avoid renderer starvation on shared CI builders.
RUN node --test --test-concurrency=2 --test-timeout=300000 test/design-progress.test.js test/generic-release-proof.test.js test/build-publication.test.js test/product-orchestration.test.js test/api-backend.test.js test/api-bundle-docs.test.js test/magic-login.test.js test/api-studio.test.js test/api-oauth-sdk.test.js test/api-evolution.test.js test/api-integration.test.js test/api-learning.test.js test/complex-products.test.js test/builder-assets.test.js test/project-github.test.js test/project-portability.test.js test/studio-assets.test.js test/benchmark-gates.test.js test/evidence-route.test.js test/journey-qa.test.js test/design-pipeline.test.js test/app-release.test.js test/real-visual-repair.test.js test/app-runtime.test.js test/app-platform.test.js test/app-platform-browser.test.js test/developer-agent.test.js test/website-benchmark.test.js test/website-release.test.js test/website-capabilities.test.js test/visual-effects.test.js test/react-builder.test.js test/builder-budget.test.js test/create-tier1.test.js test/create-tier2.test.js test/create-tier3.test.js test/create-tier4.test.js test/create-tier5.test.js test/create-review-fixes.test.js test/create-mobile.test.js test/create-design.test.js test/model-eval.test.js test/create-checks.test.js test/builder-costs.test.js test/create-edits.test.js test/model-continue.test.js test/create-reference.test.js test/create-thinking.test.js test/security-hardening.test.js test/create-support.test.js test/synthetic-customers.test.js test/growth.test.js test/web.test.js test/automations.test.js test/mcp-build.test.js test/support.test.js test/site-check.test.js test/learning.test.js test/memory.test.js test/partners.test.js test/whatsapp.test.js test/hosting-billing.test.js test/app-assistant.test.js test/browser-agent.test.js test/batches.test.js test/web-replay.test.js test/template-thumbs.test.js test/chat-files.test.js test/preview-rebuild.test.js test/dead-clicks.test.js test/storage.test.js test/clarify.test.js test/setup-status.test.js test/rollback-journey.test.js test/site-search.test.js test/builder-provider.test.js test/app-referrals.test.js test/project-memory.test.js test/ai-checks.test.js test/compression.test.js test/code-editor.test.js test/postgres.test.js test/python-functions.test.js test/opencode-engine.test.js test/videos.test.js test/live-guard.test.js test/lightpanda.test.js test/feed-watch.test.js test/launch-gate.test.js test/outreach.test.js test/design-directions.test.js test/open-access.test.js test/experiential.test.js test/model-choices.test.js
EXPOSE 3002
CMD ["node","deployment-start.js"]
