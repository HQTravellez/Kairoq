FROM public.ecr.aws/docker/library/node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-liberation ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV NODE_ENV=production TZ=UTC
# Bound Chromium/Playwright parallelism to avoid renderer starvation on shared CI builders.
RUN node --test --test-concurrency=2 test/design-progress.test.js test/generic-release-proof.test.js test/build-publication.test.js test/product-orchestration.test.js test/api-backend.test.js test/api-bundle-docs.test.js test/magic-login.test.js test/api-studio.test.js test/api-oauth-sdk.test.js test/api-evolution.test.js test/api-integration.test.js test/api-learning.test.js test/complex-products.test.js test/builder-assets.test.js test/project-github.test.js test/project-portability.test.js test/studio-assets.test.js test/benchmark-gates.test.js test/evidence-route.test.js test/journey-qa.test.js test/design-pipeline.test.js test/app-release.test.js test/real-visual-repair.test.js test/app-runtime.test.js test/app-platform.test.js test/app-platform-browser.test.js test/developer-agent.test.js test/website-benchmark.test.js test/website-release.test.js test/website-capabilities.test.js test/visual-effects.test.js test/react-builder.test.js test/builder-budget.test.js test/create-tier1.test.js test/create-tier2.test.js test/create-tier3.test.js test/create-tier4.test.js test/create-tier5.test.js test/create-review-fixes.test.js test/create-mobile.test.js test/create-design.test.js test/model-eval.test.js test/create-checks.test.js test/builder-costs.test.js test/create-edits.test.js test/model-continue.test.js test/create-reference.test.js test/create-thinking.test.js test/security-hardening.test.js test/create-support.test.js test/synthetic-customers.test.js test/growth.test.js test/web.test.js test/automations.test.js test/mcp-build.test.js test/support.test.js test/site-check.test.js test/learning.test.js test/memory.test.js test/partners.test.js test/whatsapp.test.js test/hosting-billing.test.js
EXPOSE 3002
CMD ["node","deployment-start.js"]
