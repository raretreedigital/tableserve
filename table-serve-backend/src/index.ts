import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { auth } from './lib/auth'
import { env } from './lib/env'
import { log, requestLogger } from './lib/logger'
import { superAdminRouter } from './routes/superadmin'
import { adminRouter } from './routes/admin'
import { customerRouter } from './routes/customer'
import { waiterRouter } from './routes/waiter'

const app = new Hono()

// ─── Security Headers ─────────────────────────

app.use('*', secureHeaders({
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  referrerPolicy: 'strict-origin-when-cross-origin',
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
  contentSecurityPolicy: false,
}))

// ─── In-memory Rate Limiting ──────────────────

const _rateBuckets = new Map<string, { count: number; reset: number }>()
setInterval(() => { const n = Date.now(); for (const [k, v] of _rateBuckets) if (n > v.reset) _rateBuckets.delete(k) }, 5 * 60 * 1000)

function rateLimit(windowMs: number, max: number) {
  return async (c: any, next: () => Promise<void>) => {
    const ip = (c.req.header('x-forwarded-for') ?? c.req.header('cf-connecting-ip') ?? 'unknown').split(',')[0].trim()
    const key = `${ip}:${c.req.path}`
    const now = Date.now()
    const b = _rateBuckets.get(key)
    if (!b || now > b.reset) { _rateBuckets.set(key, { count: 1, reset: now + windowMs }) }
    else if (++b.count > max) return c.json({ error: 'Too many requests. Please slow down.' }, 429)
    await next()
  }
}

app.use('/api/auth/*', rateLimit(60_000, 15))
app.use('/api/*', rateLimit(60_000, 200))

// ─── Global Middleware ────────────────────────

app.use(
  '*',
  cors({
    origin: [...env.FRONTEND_URLS, ...env.EXTRA_TRUSTED_ORIGINS, '*'], // * allows the Flutter app
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization', 'x-organization-id', 'x-table-session', 'idempotency-key'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })
)

app.use('*', requestLogger())

// ─── better-auth handler ──────────────────────

app.on(['GET', 'POST'], '/api/auth/**', (c) => {
  return auth.handler(c.req.raw)
})

// ─── API Routes ───────────────────────────────

app.route('/api/superadmin', superAdminRouter)
app.route('/api/admin', adminRouter)
app.route('/api/customer', customerRouter)
app.route('/api/waiter', waiterRouter)

// ─── Health check ─────────────────────────────

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// ─── 404 handler ──────────────────────────────

app.notFound((c) => c.json({ error: 'Route not found.' }, 404))

app.onError((err, c) => {
  log.error('unhandled', { message: err.message, stack: err.stack })
  return c.json({ error: 'Internal server error.' }, 500)
})

log.info('startup', { port: env.PORT })

// ─── Ensure new columns exist (safe, idempotent) ──────────────────────────────
import { db as _db } from './db'
import { sql as _sql } from 'drizzle-orm'
_db.execute(_sql`ALTER TABLE restaurant_table ADD COLUMN IF NOT EXISTS bill_requested boolean NOT NULL DEFAULT false`).catch(() => {})
_db.execute(_sql`ALTER TABLE organization_profile ADD COLUMN IF NOT EXISTS kds_token text`).catch(() => {})
_db.execute(_sql`ALTER TABLE organization_profile ADD COLUMN IF NOT EXISTS collect_customer_details boolean NOT NULL DEFAULT false`).catch(() => {})
_db.execute(_sql`ALTER TABLE organization_profile ADD COLUMN IF NOT EXISTS require_ordering_otp boolean NOT NULL DEFAULT false`).catch(() => {})
_db.execute(_sql`ALTER TABLE organization_profile ADD COLUMN IF NOT EXISTS require_session_approval boolean NOT NULL DEFAULT false`).catch(() => {})
_db.execute(_sql`ALTER TABLE restaurant_table ADD COLUMN IF NOT EXISTS session_approved boolean NOT NULL DEFAULT true`).catch(() => {})
_db.execute(_sql`ALTER TABLE restaurant_table ADD COLUMN IF NOT EXISTS customer_name text`).catch(() => {})
_db.execute(_sql`ALTER TABLE restaurant_table ADD COLUMN IF NOT EXISTS party_size integer`).catch(() => {})
_db.execute(_sql`ALTER TABLE restaurant_table ADD COLUMN IF NOT EXISTS session_otp text`).catch(() => {})
_db.execute(_sql`ALTER TABLE restaurant_table ADD COLUMN IF NOT EXISTS session_otp_expiry timestamptz`).catch(() => {})
_db.execute(_sql`ALTER TABLE restaurant_table ADD COLUMN IF NOT EXISTS session_started_at timestamptz`).catch(() => {})

export default {
  port: env.PORT,
  fetch: app.fetch,
  // idleTimeout: 0 disables Bun's 10-second idle-connection killer.
  // Without this, keep-alive connections that pause briefly (e.g. DB queries,
  // better-auth session lookups) get silently dropped, producing "socket hang up"
  // errors in the Vite proxy.
  idleTimeout: 0,
}
