FROM public.ecr.aws/docker/library/node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-liberation ca-certificates ffmpeg && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --omit=dev
# OpenCode as the build engine (opencode-engine.js) when the Railway variable KAIROQ_OPENCODE=on
# or KAIROQ_QUALITY=top (quality.js then also makes it the engine).
ARG KAIROQ_OPENCODE=off
ARG KAIROQ_QUALITY=
RUN if [ "$KAIROQ_OPENCODE" = "on" ] || [ "$KAIROQ_QUALITY" = "top" ]; then npm install -g --omit=dev opencode-ai@1.18.34; fi
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
# last30days research (last30days.js, vendor/last30days, MIT) needs Python 3.12+; Debian bookworm
# has 3.11, so uv installs a standalone 3.12. yt-dlp lets it read YouTube. Set the Railway
# variable KAIROQ_LAST30DAYS=off to leave both out of the image.
ARG KAIROQ_LAST30DAYS=on
COPY --from=ghcr.io/astral-sh/uv:0.8.17 /uv /usr/local/bin/uv
RUN if [ "$KAIROQ_LAST30DAYS" = "on" ]; then \
      UV_PYTHON_INSTALL_DIR=/opt/python uv python install 3.12 && \
      ln -sf "$(UV_PYTHON_INSTALL_DIR=/opt/python uv python find 3.12)" /usr/local/bin/python3.12 && \
      UV_TOOL_DIR=/opt/uv-tools UV_TOOL_BIN_DIR=/usr/local/bin UV_PYTHON_INSTALL_DIR=/opt/python uv tool install --python 3.12 yt-dlp && \
      python3.12 --version && yt-dlp --version; fi
ENV KAIROQ_PYTHON=/usr/local/bin/python3.12
# Blender (blender.org, GPL; unmodified, as the "bpy" Python module) for 3D in Create
# (blender.js, scripts/blender-kairoq.py): converts uploaded FBX/OBJ/STL/PLY/.blend/zipped glTF
# to GLB, makes heavy models lighter and renders preview pictures, without a screen. About 1 GB;
# set the Railway variable KAIROQ_BLENDER_INSTALL=off to leave it out (then only .glb uploads).
ARG KAIROQ_BLENDER_INSTALL=on
RUN if [ "$KAIROQ_BLENDER_INSTALL" = "on" ]; then \
      apt-get update && apt-get install -y --no-install-recommends libgl1 libglx0 libsm6 libice6 libx11-6 libxext6 libxfixes3 libxi6 libxkbcommon0 libxrender1 && rm -rf /var/lib/apt/lists/* && \
      UV_PYTHON_INSTALL_DIR=/opt/python uv venv --python 3.13 /opt/blender && \
      UV_PYTHON_INSTALL_DIR=/opt/python uv pip install --no-cache --python /opt/blender/bin/python bpy==5.2.3 && \
      /opt/blender/bin/python -c "import bpy; print('Blender', bpy.app.version_string)"; fi
ENV KAIROQ_BPY_PYTHON=/opt/blender/bin/python
# Safari's engine (WebKit, through Playwright) for the "iPhone Safari" checks and the editor's
# "Real Safari" button (runtime-check.js). About 300 MB with its system libraries; build with
# KAIROQ_WEBKIT=off to leave it out (Safari checks are then skipped, not failed).
ARG KAIROQ_WEBKIT=on
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
RUN if [ "$KAIROQ_WEBKIT" = "on" ]; then npx playwright-core install --with-deps webkit && rm -rf /var/lib/apt/lists/*; fi
COPY . .
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV NODE_ENV=production TZ=UTC
# Unit and browser regression tests run in GitHub Actions, not during the production image build.
EXPOSE 3002
CMD ["node","deployment-start.js"]
