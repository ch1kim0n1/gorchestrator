# Multi-stage Dockerfile for GOrchestrator
# Base image pinned by digest for reproducible, supply-chain-safe builds.
# node:20-alpine @ 2026-05 — update the digest deliberately when bumping.
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies. --ignore-scripts prevents the `prepare` lifecycle from
# running `npm run build` before src/ is copied (it would fail otherwise).
RUN npm ci --ignore-scripts

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only. --ignore-scripts skips our own `prepare`
# build hook (no dev deps / no src here; dist/ is copied from the builder).
# We then rebuild native modules (better-sqlite3): node:20-alpine is musl, which
# has no prebuilt binary, so a build toolchain is needed to compile from source.
# The toolchain is installed and removed in the same layer to keep the image lean.
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
 && npm ci --omit=dev --ignore-scripts \
 && npm rebuild better-sqlite3 \
 && apk del .build-deps

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Drop privileges: run as built-in non-root `node` user
RUN chown -R node:node /app
USER node

# Health/MCP HTTP server binds HEALTH_PORT (default 8080).
EXPOSE 8080

# Health check — uses node (curl/wget are absent in alpine). Honors HEALTH_PORT.
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "const p=process.env.HEALTH_PORT||process.env.GORCHESTRATOR_PORT||8080;require('http').get('http://localhost:'+p+'/health/live',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

# Run the MCP server
CMD ["node", "dist/serve.js"]
