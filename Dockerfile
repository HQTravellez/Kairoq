FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-liberation ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV NODE_ENV=production TZ=UTC
EXPOSE 3002
CMD ["node","deployment-start.js"]
