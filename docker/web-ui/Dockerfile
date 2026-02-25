# SidStack Web UI
# Static React SPA — served by Caddy

FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace config + tsconfig
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/web-ui/package.json packages/web-ui/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @sidstack/web-ui

# Copy source and build
COPY packages/web-ui/ packages/web-ui/

# API URL injected at build time (Vite replaces import.meta.env)
ARG VITE_API_URL=
ENV VITE_API_URL=${VITE_API_URL}

RUN pnpm --filter @sidstack/web-ui build

# --- Production stage: static file server ---
FROM caddy:2-alpine

COPY --from=builder /app/packages/web-ui/dist /srv
COPY docker/web-ui/Caddyfile /etc/caddy/Caddyfile

EXPOSE 5174
