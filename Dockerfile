FROM public.ecr.aws/docker/library/node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-liberation ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV NODE_ENV=production TZ=UTC
# Bound Chromium/Playwright parallelism to avoid renderer starvation on shared CI builders.
RUN node --test --test-concurrency=2 test/api-studio.test.js test/api-oauth-sdk.test.js test/api-evolution.test.js test/api-integration.test.js test/api-learning.test.js test/complex-products.test.js test/builder-assets.test.js test/project-github.test.js test/project-portability.test.js test/studio-assets.test.js test/benchmark-gates.test.js test/evidence-route.test.js test/journey-qa.test.js test/design-pipeline.test.js test/app-release.test.js test/real-visual-repair.test.js test/app-runtime.test.js test/developer-agent.test.js test/website-benchmark.test.js test/website-release.test.js test/website-capabilities.test.js test/visual-effects.test.js
EXPOSE 3002
CMD ["node","deployment-start.js"]
