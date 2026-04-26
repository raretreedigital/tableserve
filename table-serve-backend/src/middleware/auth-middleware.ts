import type { Context, Next } from 'hono'
import { auth } from '../lib/auth'

// Attach session to context
export const sessionMiddleware = async (c: Context, next: Next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (session) {
    c.set('user', session.user)
    c.set('session', session.session)
  }
  await next()
}

// Require any authenticated user
export const requireAuth = async (c: Context, next: Next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) {
    return c.json({ error: 'Authentication required.' }, 401)
  }
  if (session.user.banned) {
    return c.json({ error: 'Your account has been suspended.' }, 403)
  }
  c.set('user', session.user)
  c.set('session', session.session)
  await next()
}

// Require superadmin role
export const requireSuperAdmin = async (c: Context, next: Next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) {
    return c.json({ error: 'Authentication required.' }, 401)
  }
  if (session.user.role !== 'superadmin') {
    return c.json({ error: 'Super admin access required.' }, 403)
  }
  c.set('user', session.user)
  c.set('session', session.session)
  await next()
}

// Require org admin/owner role
export const requireOrgAdmin = async (c: Context, next: Next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) {
    return c.json({ error: 'Authentication required.' }, 401)
  }
  if (session.user.banned) {
    return c.json({ error: 'Your account has been suspended.' }, 403)
  }
  if (session.user.role !== 'superadmin') {
    const orgId = c.req.header('x-organization-id') ?? (session.session as any).activeOrganizationId
    if (!orgId) {
      return c.json({ error: 'Organization context required.' }, 400)
    }
    c.set('organizationId', orgId)
  }
  c.set('user', session.user)
  c.set('session', session.session)
  await next()
}
