FROM node:22-bookworm-slim
WORKDIR /app
COPY . .
RUN npm install --omit=dev
ENV NODE_ENV=production TZ=UTC
EXPOSE 3002
CMD ["node","deployment-start.js"]
