### Build dependencies (includes dev deps for Vite build)
FROM node:20-alpine AS deps

WORKDIR /app
COPY package*.json ./
RUN npm ci

### Build frontend
FROM node:20-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Always build fresh frontend (remove old dist first to ensure clean build)
RUN rm -rf dist && npm run build

### Runtime (production-only deps)
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5554

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 5554

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); const port = Number(process.env.PORT || 5554); const req = http.request({ host: '127.0.0.1', port, path: '/health', timeout: 2000 }, (res) => process.exit(res.statusCode === 200 ? 0 : 1)); req.on('error', () => process.exit(1)); req.end();"

CMD ["node", "server/index.js"]