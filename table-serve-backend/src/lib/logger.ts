// ─────────────────────────────────────────────────────────────────────────────
// Structured logger with async Grafana Loki HTTP push
// Set LOKI_URL in env (default: http://loki:3100)
// Set LOKI_ENABLED=false to disable remote push (logs still go to stdout)
// ─────────────────────────────────────────────────────────────────────────────

const LOKI_URL = process.env.LOKI_URL ?? 'http://loki:3100'
const APP = process.env.APP_NAME ?? 'table-serve-backend'
const ENV = process.env.NODE_ENV ?? 'development'
const LOKI_ENABLED = process.env.LOKI_ENABLED !== 'false'

type Level = 'debug' | 'info' | 'warn' | 'error'

function write(level: Level, msg: string, extra?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, msg, env: ENV, ...extra }
  const line = JSON.stringify(entry)

  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)

  if (!LOKI_ENABLED) return

  // Fire-and-forget — never block the request path
  const nanoseconds = String(BigInt(Date.now()) * 1_000_000n)
  const body = JSON.stringify({
    streams: [{
      stream: { app: APP, level, env: ENV },
      values: [[nanoseconds, line]],
    }],
  })

  fetch(`${LOKI_URL}/loki/api/v1/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => { /* Loki unavailable — fail silently */ })
}

export const log = {
  debug: (msg: string, extra?: Record<string, unknown>) => write('debug', msg, extra),
  info:  (msg: string, extra?: Record<string, unknown>) => write('info',  msg, extra),
  warn:  (msg: string, extra?: Record<string, unknown>) => write('warn',  msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => write('error', msg, extra),
}

/** Hono middleware — logs every request with method, path, status, latency */
export function requestLogger() {
  return async (c: any, next: () => Promise<void>) => {
    const start = Date.now()
    await next()
    log.info('http', {
      method: c.req.method,
      path:   c.req.path,
      status: c.res?.status ?? 0,
      ms:     Date.now() - start,
    })
  }
}
