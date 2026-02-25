# SidStack MCP Server
# Streamable HTTP transport for remote Claude Code agent access
# Calls API Server internally — no direct SQLite access

FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace config + tsconfig
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

# Copy only the packages we need
COPY packages/shared/package.json packages/shared/
COPY packages/mcp-server/package.json packages/mcp-server/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @sidstack/mcp-server --filter @sidstack/shared

# Copy source and build
COPY packages/shared/ packages/shared/
COPY packages/mcp-server/ packages/mcp-server/

RUN pnpm --filter @sidstack/shared build && \
    pnpm --filter @sidstack/mcp-server build

# --- Production stage ---
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/mcp-server/package.json packages/mcp-server/

RUN pnpm install --frozen-lockfile --prod --filter @sidstack/mcp-server --filter @sidstack/shared

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/mcp-server/dist packages/mcp-server/dist

# Copy shared templates (used by knowledge tools)
COPY packages/shared/templates packages/shared/templates

# MCP log directory
RUN mkdir -p /root/.sidstack/logs

ENV NODE_ENV=production
ENV MCP_PORT=19433

EXPOSE 19433

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -q -O- http://localhost:19433/health || exit 1

# HTTP mode for remote access
CMD ["node", "packages/mcp-server/dist/server.js", "--http"]
