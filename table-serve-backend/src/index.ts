import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './lib/auth'
import { env } from './lib/env'
import { log, requestLogger } from './lib/logger'
import { superAdminRouter } from './routes/superadmin'
import { adminRouter } from './routes/admin'
import { customerRouter } from './routes/customer'
import { waiterRouter } from './routes/waiter'

const app = new Hono()

// ─── Global Middleware ────────────────────────

app.use(
  '*',
  cors({
    origin: [env.FRONTEND_URL, '*'], // * allows the Flutter app
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

export default {
  port: env.PORT,
  fetch: app.fetch,
}
