# ============================================
# Stage 1: Install dependencies
# ============================================

ARG NODE_VERSION=24-slim

FROM node:${NODE_VERSION} AS dependencies

WORKDIR /app

# openssl so `prisma generate` (in the postinstall below) detects the same
# OpenSSL major as the slim runtime, keeping the generated engine consistent.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Copy package files to leverage Docker cache.
# package-lock.json is the committed, reproducible npm lockfile (bun.lock is
# kept for bun users but the Docker build resolves with npm). prisma/ must be
# present because the postinstall runs `prisma generate`.
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY scripts ./scripts

# Install all dependencies (prod + dev; the builder stage needs dev deps).
# The postinstall (prisma generate + maplibre worker copy) runs here.
# No --mount=type=cache: the Railway Metal builder rejects cache mounts
# without an explicit `id`, and the mount is only a build-speed optimisation.
RUN npm ci --no-audit --no-fund

# ============================================
# Stage 2: Build the Next.js application
# ============================================

FROM node:${NODE_VERSION} AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time env vars — override these with --build-arg or in compose.yml
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth/sign-in
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth/sign-up
ARG NEXT_PUBLIC_SENTRY_DISABLED=true

ENV BUILD_STANDALONE=true

RUN npm run build

# ============================================
# Stage 3: Production runner
# ============================================

FROM node:${NODE_VERSION} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Prisma CLI — runs `prisma migrate deploy` on boot so production schema
# changes are applied before the app starts serving traffic.
# openssl is required for Prisma's query engine on slim images.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g prisma@6.19.3

# Copy public assets
COPY --from=builder --chown=node:node /app/public ./public

# Prisma schema + migration history
COPY --from=builder --chown=node:node /app/prisma ./prisma

# Create .next dir with correct permissions for prerender cache
RUN mkdir .next && chown node:node .next

# Copy standalone output and static files
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Run as non-root user
USER node

EXPOSE 3000

CMD ["sh", "-c", "prisma migrate deploy && node server.js"]
