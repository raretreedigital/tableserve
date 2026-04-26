# ── Stage 1: Install all dependencies (including dev) ─────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# ── Stage 2: Build SvelteKit with adapter-node ────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build produces /app/build — the Node.js server bundle
RUN npm run build

# ── Stage 3: Lean production image ────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# adapter-node reads this to set the server port
ENV PORT=3001
ENV HOST=0.0.0.0

# Only the build output and the adapter runtime are needed
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json

# Install only the adapter-node production runtime (no dev deps)
RUN npm install --omit=dev --ignore-scripts

EXPOSE 3001

CMD ["node", "build"]
