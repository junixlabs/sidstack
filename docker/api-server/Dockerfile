# SidStack API Server
# Central data gateway — only service with direct SQLite access

FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace config + tsconfig
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

# Copy only the packages we need
COPY packages/shared/package.json packages/shared/
COPY packages/api-server/package.json packages/api-server/

# Install dependencies (including native better-sqlite3)
RUN pnpm install --frozen-lockfile --filter @sidstack/api-server --filter @sidstack/shared

# Copy source and build
COPY packages/shared/ packages/shared/
COPY packages/api-server/ packages/api-server/

RUN pnpm --filter @sidstack/shared build && \
    pnpm --filter @sidstack/api-server build

# --- Production stage ---
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/api-server/package.json packages/api-server/

RUN pnpm install --frozen-lockfile --prod --filter @sidstack/api-server --filter @sidstack/shared

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/api-server/dist packages/api-server/dist

# Copy shared templates (used by knowledge system)
COPY packages/shared/templates packages/shared/templates

# Data volume for SQLite persistence
RUN mkdir -p /data
VOLUME /data

ENV NODE_ENV=production
ENV DATABASE_PATH=/data/sidstack.db
ENV API_PORT=19432

EXPOSE 19432

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -q -O- http://localhost:19432/health || exit 1

CMD ["node", "packages/api-server/dist/index.js"]
