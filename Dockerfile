FROM node:22-bookworm-slim
WORKDIR /app
COPY . .
RUN npm install --omit=dev && npm run build
ENV NODE_ENV=production TZ=UTC
EXPOSE 3002
CMD ["node","server.js"]
