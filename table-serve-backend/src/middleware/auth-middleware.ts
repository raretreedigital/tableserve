import type { Context, Next } from 'hono'
import { auth } from '../lib/auth'
import { db } from '../db'
import { organizationProfile } from '../db/schema'
import { eq } from 'drizzle-orm'

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

// Require active subscription (non-trial, non-suspended)
// Use AFTER requireOrgAdmin so organizationId is already on context
export const requireActiveSubscription = async (c: Context, next: Next) => {
  const currentUser = c.get('user') as any
  // Superadmins bypass subscription checks
  if (currentUser?.role === 'superadmin') return next()

  const orgId = c.get('organizationId') as string
  if (!orgId) return c.json({ error: 'Organization context required.' }, 400)

  const [profile] = await db
    .select({ status: organizationProfile.status, plan: organizationProfile.subscriptionPlan })
    .from(organizationProfile)
    .where(eq(organizationProfile.organizationId, orgId))
    .limit(1)

  if (!profile) return c.json({ error: 'Organization not found.' }, 404)

  if (profile.status === 'suspended') {
    return c.json({ error: 'Your account has been suspended. Contact support.', code: 'SUSPENDED' }, 403)
  }

  if (profile.status !== 'active') {
    return c.json({
      error: 'This feature requires an active subscription. Contact support to activate your account.',
      code: 'SUBSCRIPTION_REQUIRED',
      status: profile.status,
      plan: profile.plan,
    }, 402)
  }

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
