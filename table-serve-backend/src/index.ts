import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { auth } from './lib/auth'
import { env } from './lib/env'
import { superAdminRouter } from './routes/superadmin'
import { adminRouter } from './routes/admin'
import { customerRouter } from './routes/customer'

const app = new Hono()

// ─── Global Middleware ────────────────────────

app.use(
  '*',
  cors({
    origin: [env.FRONTEND_URL],
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization', 'x-organization-id', 'x-table-session', 'idempotency-key'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })
)

app.use('*', logger())

// ─── better-auth handler ──────────────────────

app.on(['GET', 'POST'], '/api/auth/**', (c) => {
  return auth.handler(c.req.raw)
})

// ─── API Routes ───────────────────────────────

app.route('/api/superadmin', superAdminRouter)
app.route('/api/admin', adminRouter)
app.route('/api/customer', customerRouter)

// ─── Health check ─────────────────────────────

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// ─── 404 handler ──────────────────────────────

app.notFound((c) => c.json({ error: 'Route not found.' }, 404))

app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error.' }, 500)
})

console.log(`Table Serve API running on port ${env.PORT}`)

export default {
  port: env.PORT,
  fetch: app.fetch,
}
