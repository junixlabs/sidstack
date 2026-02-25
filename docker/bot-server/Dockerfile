# SidStack Bot Server (SidBot)
# Gemini intent router + Claude Code bridge

FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/bot-server/package.json packages/bot-server/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @sidstack/bot-server

# Copy source and build
COPY packages/bot-server/ packages/bot-server/

RUN pnpm --filter @sidstack/bot-server build

# --- Production stage ---
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/bot-server/package.json packages/bot-server/

RUN pnpm install --frozen-lockfile --prod --filter @sidstack/bot-server

# Copy built artifacts
COPY --from=builder /app/packages/bot-server/dist packages/bot-server/dist

ENV NODE_ENV=production
ENV PORT=3222

EXPOSE 3222

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -q -O- http://localhost:3222/health || exit 1

CMD ["node", "packages/bot-server/dist/index.js"]
