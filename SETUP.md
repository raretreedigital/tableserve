# TableServe — Setup Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Repository Structure](#repository-structure)
3. [Local Development](#local-development)
4. [Environment Variables](#environment-variables)
5. [Database Setup](#database-setup)
6. [Running the Services](#running-the-services)
7. [Docker / Production Deployment](#docker--production-deployment)
8. [Nginx Configuration](#nginx-configuration)
9. [Useful Commands](#useful-commands)

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Bun** | ≥ 1.1 | `curl -fsSL https://bun.sh/install \| bash` |
| **Node.js** | ≥ 20 LTS | [nodejs.org](https://nodejs.org) or `nvm install 20` |
| **pnpm** | ≥ 9 | `npm i -g pnpm` |
| **PostgreSQL** | ≥ 15 | `brew install postgresql@15` or Docker |
| **Docker + Compose** | latest | [docker.com](https://www.docker.com/products/docker-desktop/) |

---

## Repository Structure

```
table-serve/
├── table-serve-backend/   # Bun + Hono REST API (port 3000)
├── table-serve-frontend/  # SvelteKit 5 app (port 5173 dev / 3001 prod)
├── table-serve-app/       # Flutter mobile app (waiters)
├── docker-compose.yml     # Production stack
└── SETUP.md               # This file
```

---

## Local Development

### 1 — Clone and install dependencies

```bash
git clone <repo-url>
cd table-serve

# Backend
cd table-serve-backend
bun install

# Frontend
cd ../table-serve-frontend
pnpm install
```

### 2 — Create environment files

```bash
# Backend
cp table-serve-backend/.env.example table-serve-backend/.env

# Frontend
cp table-serve-frontend/.env.example table-serve-frontend/.env
```

Fill in the values — see the [Environment Variables](#environment-variables) section below.

### 3 — Start a local PostgreSQL database

Option A — Docker (recommended):
```bash
docker run -d \
  --name tableserve-db \
  -e POSTGRES_USER=tableserve \
  -e POSTGRES_PASSWORD=tableserve \
  -e POSTGRES_DB=tableserve \
  -p 5432:5432 \
  postgres:15-alpine
```

Option B — Local Postgres:
```bash
createdb tableserve
createuser tableserve --pwprompt
psql -c "GRANT ALL ON DATABASE tableserve TO tableserve;"
```

### 4 — Run database migrations

The backend runs all migrations automatically on startup via `ALTER TABLE IF NOT EXISTS` statements. No manual step needed.

To run Drizzle migrations manually:
```bash
cd table-serve-backend
bun run db:migrate
```

### 5 — Start the backend

```bash
cd table-serve-backend
bun --watch src/index.ts
```

The API will be available at `http://localhost:3000`.

### 6 — Start the frontend

```bash
cd table-serve-frontend
pnpm dev
```

The app will be available at `http://localhost:5173`.  
The Vite dev server proxies `/api` → `http://localhost:3000`.

### 7 — (Optional) Flutter mobile app

```bash
cd table-serve-app
flutter pub get
flutter run
```

---

## Environment Variables

### Backend — `table-serve-backend/.env`

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | `postgresql://tableserve:tableserve@localhost:5432/tableserve` | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | `change-me-32-chars-min` | Secret used to sign all JWTs |
| `PORT` | — | `3000` | HTTP port (default: 3000) |
| `NODE_ENV` | — | `production` | `development` / `production` |
| `LOG_LEVEL` | — | `info` | `debug` / `info` / `warn` / `error` |
| `LOKI_URL` | — | `http://loki:3100` | Grafana Loki push endpoint (optional) |
| `CORS_ORIGIN` | — | `https://app.example.com` | Allowed CORS origin (defaults to `*` in dev) |

### Frontend — `table-serve-frontend/.env`

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `PUBLIC_API_URL` | ✅ | `https://api.example.com` | Backend base URL (used at build time) |

> In local dev, `PUBLIC_API_URL` can be left empty — Vite proxies `/api` to `localhost:3000` automatically.

---

## Database Setup

The schema is managed by **Drizzle ORM**. The main tables are:

| Table | Description |
|-------|-------------|
| `organization` | Restaurant tenants |
| `organizationProfile` | Logo, banner, branding, feature flags |
| `restaurantTable` | Tables with NFC tokens, session state |
| `menuCategory` | Menu sections |
| `menuItem` | Dishes with pricing |
| `order` | Customer orders with idempotency |
| `orderItem` | Line items |
| `waiter` / `staff` | Authenticated users |
| `subscription` | Billing plan per org |

To generate a new migration after schema changes:
```bash
cd table-serve-backend
bun run db:generate   # generates SQL in drizzle/
bun run db:migrate    # applies pending migrations
```

---

## Running the Services

### Development (separate terminals)

```bash
# Terminal 1 — backend
cd table-serve-backend && bun --watch src/index.ts

# Terminal 2 — frontend
cd table-serve-frontend && pnpm dev
```

### All services with Docker Compose (production-like)

```bash
docker compose up --build
```

Services started:
| Service | Port | Notes |
|---------|------|-------|
| `backend` | 3000 | Bun API |
| `frontend` | 3001 | Node adapter |
| `postgres` | 5432 | PostgreSQL 15 |
| `loki` | 3100 | Log aggregation |
| `grafana` | 3200 | Observability dashboard |

---

## Docker / Production Deployment

### Build images individually

```bash
# Backend
docker build -t tableserve-backend ./table-serve-backend

# Frontend
docker build -t tableserve-frontend ./table-serve-frontend
```

### Run with Compose (recommended)

1. Copy and edit the production env file:
   ```bash
   cp docker-compose.yml docker-compose.prod.yml
   # Edit env vars inside docker-compose.prod.yml
   ```

2. Start everything:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

3. View logs:
   ```bash
   docker compose logs -f backend
   ```

### Health check

```bash
curl http://localhost:3000/health
# → { "status": "ok", "version": "..." }
```

---

## Nginx Configuration

Example reverse proxy config for a production setup with both frontend and backend on one server:

```nginx
# /etc/nginx/sites-available/tableserve

server {
    listen 80;
    server_name app.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.example.com;

    ssl_certificate     /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

    # Frontend (SvelteKit)
    location / {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass         http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        # Increase for image uploads (base64 logo/banner ~8 MB raw)
        client_max_body_size 12M;
    }
}
```

Enable the site:
```bash
ln -s /etc/nginx/sites-available/tableserve /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## Useful Commands

```bash
# Backend — check TypeScript types
cd table-serve-backend && bunx tsc --noEmit

# Frontend — build for production
cd table-serve-frontend && pnpm build

# Frontend — preview production build
cd table-serve-frontend && pnpm preview

# Wipe and reset database (local dev)
psql -c "DROP DATABASE tableserve; CREATE DATABASE tableserve;"
bun run db:migrate

# Stream backend logs in Docker
docker compose logs -f backend

# Open Grafana
open http://localhost:3200   # admin / admin (default)
```

---

## First-Time Admin Setup

1. Open `http://localhost:5173/admin/register`
2. Create your organization and admin account
3. Log in at `/admin/login`
4. Add tables, upload your logo/banner in **Settings**
5. Add menu categories and items in **Menu**
6. Print or program NFC tags with the URL shown in **Tables → NFC Link**

For super-admin access (managing multiple organizations), register at `/superadmin/register` then log in at `/superadmin/login`.
