# syntax=docker/dockerfile:1
# ZeRisk — production image for Coolify (Next.js standalone, glibc base).
# The app's runtime data source is the in-memory deterministic generator, so no
# database is required at runtime; Prisma/SQLite is only used by `npm run seed`.

FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma schema references env("DATABASE_URL"); provide a harmless default so
# `prisma generate` (run via postinstall/build) never fails during the build.
ENV DATABASE_URL="file:./dev.db"
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# ---- deps ----
FROM base AS deps
WORKDIR /app
# Match the npm that generated package-lock.json.
RUN npm i -g npm@11
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---- build ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
