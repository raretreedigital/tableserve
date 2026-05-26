FROM oven/bun:1.2-alpine AS deps

WORKDIR /app

COPY table-serve-backend/package.json table-serve-backend/bun.lock* ./
RUN bun install --frozen-lockfile --production

# ── Stage 2: Build (generate drizzle types / any compile step) ─────────────────
FROM oven/bun:1.2-alpine AS builder

WORKDIR /app

COPY table-serve-backend/package.json table-serve-backend/bun.lock* ./
RUN bun install --frozen-lockfile

COPY table-serve-backend/ .

# Generate Drizzle client types so they are baked into the image
RUN bun run db:generate || true

# ── Stage 3: Production image ──────────────────────────────────────────────────
FROM oven/bun:1.2-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Only copy production deps from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source + generated drizzle output
COPY --from=builder /app/src ./src
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Port is set via PORT env var injected by Railway (default 3000 locally)
EXPOSE ${PORT:-3000}

# Run DB migrations then start the server
# Migrations are idempotent — safe to run on every container start
CMD ["sh", "-c", "bun run db:migrate && bun run start"]
