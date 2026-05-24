import { Hono } from 'hono'
import { zv, zvq } from '../lib/zv'
import { eq, and, desc, gte, lte, sql, sum, count } from 'drizzle-orm'
import { db } from '../db'
import {
  organization,
  organizationProfile,
  member,
  user,
  order,
  orderItem,
  menuItem,
  restaurantTable,
} from '../db/schema'
import { requireSuperAdmin } from '../middleware/auth-middleware'
import { auth } from '../lib/auth'
import { env } from '../lib/env'
import {
  sendActivationEmail,
  sendSuspensionEmail,
  sendSubscriptionChangeEmail,
} from '../lib/email'
import {
  registerSuperAdminSchema,
  createOrganizationSchema,
  suspendOrganizationSchema,
  updateSubscriptionSchema,
  analyticsQuerySchema,
} from '../lib/validators'

const superAdminRouter = new Hono()

// ─── Helper: get org owner (member with role 'owner') ────────────────────────

async function getOrgOwner(orgId: string): Promise<{ name: string; email: string } | null> {
  const rows = await db
    .select({ name: user.name, email: user.email })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(eq(member.organizationId, orgId), eq(member.role, 'owner')))
    .limit(1)
  return rows[0] ?? null
}

// ─── Register superadmin (master password protected) ───

superAdminRouter.post('/register', zv(registerSuperAdminSchema), async (c) => {
  const { name, email, password, masterPassword } = c.req.valid('json')

  if (masterPassword !== env.MASTER_PASSWORD) {
    return c.json({ error: 'Invalid master password.' }, 403)
  }

  try {
    const result = await auth.api.signUpEmail({
      body: { name, email, password },
      headers: c.req.raw.headers,
    })

    if (!result || !result.user) {
      return c.json({ error: 'Registration failed.' }, 400)
    }

    // Elevate to superadmin
    await db.update(user).set({ role: 'superadmin' }).where(eq(user.id, result.user.id))

    return c.json({ message: 'Super admin registered successfully.', userId: result.user.id }, 201)
  } catch (err: any) {
    return c.json({ error: err.message ?? 'Registration failed.' }, 400)
  }
})

// All routes below require superadmin
superAdminRouter.use('*', requireSuperAdmin)

// ─── Dashboard stats ────────────────────────

superAdminRouter.get('/stats', async (c) => {
  const [orgCount] = await db.select({ count: count() }).from(organization)
  const [userCount] = await db.select({ count: count() }).from(user)
  const [orderCount] = await db.select({ count: count() }).from(order)
  const [revenue] = await db.select({ total: sum(order.totalAmount) }).from(order)

  const activeOrgs = await db
    .select({ count: count() })
    .from(organizationProfile)
    .where(eq(organizationProfile.status, 'active'))

  const suspendedOrgs = await db
    .select({ count: count() })
    .from(organizationProfile)
    .where(eq(organizationProfile.status, 'suspended'))

  return c.json({
    organizations: orgCount.count,
    activeOrganizations: activeOrgs[0].count,
    suspendedOrganizations: suspendedOrgs[0].count,
    users: userCount.count,
    orders: orderCount.count,
    totalRevenue: revenue.total ?? '0',
  })
})

// ─── Organizations ───────────────────────────

superAdminRouter.get('/organizations', async (c) => {
  const orgs = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      createdAt: organization.createdAt,
      status: organizationProfile.status,
      subscriptionPlan: organizationProfile.subscriptionPlan,
      subscriptionExpiry: organizationProfile.subscriptionExpiry,
      email: organizationProfile.email,
      phone: organizationProfile.phone,
    })
    .from(organization)
    .leftJoin(organizationProfile, eq(organization.id, organizationProfile.organizationId))
    .orderBy(desc(organization.createdAt))

  return c.json({ organizations: orgs })
})

superAdminRouter.post(
  '/organizations',
  zv(createOrganizationSchema),
  async (c) => {
    const { name, slug, ownerEmail, ownerName, ownerPassword } = c.req.valid('json')

    // Check slug uniqueness
    const existing = await db.select().from(organization).where(eq(organization.slug, slug)).limit(1)
    if (existing.length > 0) {
      return c.json({ error: 'Organization slug is already taken.' }, 409)
    }

    try {
      // Create owner user
      const ownerResult = await auth.api.signUpEmail({
        body: { name: ownerName, email: ownerEmail, password: ownerPassword },
        headers: c.req.raw.headers,
      })

      if (!ownerResult?.user) {
        return c.json({ error: 'Failed to create owner account.' }, 400)
      }

      // Create organization
      const orgId = crypto.randomUUID()
      await db.insert(organization).values({
        id: orgId,
        name,
        slug,
        createdAt: new Date(),
      })

      // Create profile
      const profileId = crypto.randomUUID()
      await db.insert(organizationProfile).values({
        id: profileId,
        organizationId: orgId,
        status: 'trial',
        subscriptionPlan: 'free',
      })

      // Add owner as member
      await db.insert(member).values({
        id: crypto.randomUUID(),
        organizationId: orgId,
        userId: ownerResult.user.id,
        role: 'owner',
        createdAt: new Date(),
      })

      return c.json({ message: 'Organization created.', organizationId: orgId }, 201)
    } catch (err: any) {
      return c.json({ error: err.message ?? 'Failed to create organization.' }, 400)
    }
  }
)

superAdminRouter.get('/organizations/:id', async (c) => {
  const { id } = c.req.param()

  const org = await db
    .select()
    .from(organization)
    .leftJoin(organizationProfile, eq(organization.id, organizationProfile.organizationId))
    .where(eq(organization.id, id))
    .limit(1)

  if (!org.length) return c.json({ error: 'Organization not found.' }, 404)

  const members = await db
    .select({
      id: member.id,
      role: member.role,
      createdAt: member.createdAt,
      userId: user.id,
      name: user.name,
      email: user.email,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, id))

  return c.json({ organization: org[0], members })
})

superAdminRouter.patch(
  '/organizations/:id/suspend',
  zv(suspendOrganizationSchema),
  async (c) => {
    const { id } = c.req.param()
    const { reason } = c.req.valid('json')

    const existing = await db
      .select()
      .from(organizationProfile)
      .where(eq(organizationProfile.organizationId, id))
      .limit(1)

    if (!existing.length) return c.json({ error: 'Organization not found.' }, 404)

    await db
      .update(organizationProfile)
      .set({ status: 'suspended', updatedAt: new Date() })
      .where(eq(organizationProfile.organizationId, id))

    // Send suspension email to owner
    const [org] = await db.select({ name: organization.name }).from(organization).where(eq(organization.id, id)).limit(1)
    const owner = await getOrgOwner(id)
    if (org && owner) {
      sendSuspensionEmail({
        adminName: owner.name,
        adminEmail: owner.email,
        organizationName: org.name,
        reason,
      }).catch(() => {})
    }

    return c.json({ message: 'Organization suspended.', reason })
  }
)

superAdminRouter.patch('/organizations/:id/activate', async (c) => {
  const { id } = c.req.param()

  const existing = await db
    .select()
    .from(organizationProfile)
    .where(eq(organizationProfile.organizationId, id))
    .limit(1)

  if (!existing.length) return c.json({ error: 'Organization not found.' }, 404)

  await db
    .update(organizationProfile)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(organizationProfile.organizationId, id))

  // Send activation email to owner
  const [org] = await db.select({ name: organization.name }).from(organization).where(eq(organization.id, id)).limit(1)
  const owner = await getOrgOwner(id)
  if (org && owner) {
    sendActivationEmail({
      adminName: owner.name,
      adminEmail: owner.email,
      organizationName: org.name,
      plan: existing[0].subscriptionPlan ?? 'basic',
      loginUrl: `${env.FRONTEND_URLS[0]}/admin/login`,
    }).catch(() => {})
  }

  return c.json({ message: 'Organization activated.' })
})

superAdminRouter.patch(
  '/organizations/:id/subscription',
  zv(updateSubscriptionSchema),
  async (c) => {
    const { id } = c.req.param()
    const { plan, expiryDays } = c.req.valid('json')

    const expiry = expiryDays
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
      : undefined

    await db
      .update(organizationProfile)
      .set({
        subscriptionPlan: plan,
        status: 'active',
        ...(expiry ? { subscriptionExpiry: expiry } : {}),
        updatedAt: new Date(),
      })
      .where(eq(organizationProfile.organizationId, id))

    // Send subscription change email to owner
    const [org] = await db.select({ name: organization.name }).from(organization).where(eq(organization.id, id)).limit(1)
    const owner = await getOrgOwner(id)
    if (org && owner) {
      sendSubscriptionChangeEmail({
        adminName: owner.name,
        adminEmail: owner.email,
        organizationName: org.name,
        plan,
        expiry: expiry ?? null,
        loginUrl: `${env.FRONTEND_URLS[0]}/admin/login`,
      }).catch(() => {})
    }

    return c.json({ message: 'Subscription updated.' })
  }
)

superAdminRouter.delete('/organizations/:id', async (c) => {
  const { id } = c.req.param()

  await db.delete(organization).where(eq(organization.id, id))

  return c.json({ message: 'Organization deleted.' })
})

// ─── Global Analytics ────────────────────────

superAdminRouter.get('/analytics', zvq(analyticsQuerySchema), async (c) => {
  const { period } = c.req.valid('query')

  const now = new Date()
  let from: Date = new Date(now.getFullYear(), now.getMonth(), 1)
  let to: Date = now

  switch (period) {
    case 'today':
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case 'week':
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case 'month':
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'quarter':
      from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case 'year':
      from = new Date(now.getFullYear(), 0, 1)
      break
  }

  try {
    const [totalRevenueRow] = await db
      .select({ total: sum(order.totalAmount), count: count() })
      .from(order)
      .where(and(gte(order.createdAt, from), lte(order.createdAt, to)))

    const totalOrders = Number(totalRevenueRow?.count ?? 0)
    const totalRevAmt = parseFloat(totalRevenueRow?.total ?? '0')

    const topItems = await db
      .select({
        menuItemId: orderItem.menuItemId,
        name: orderItem.menuItemName,
        totalQuantity: sum(orderItem.quantity),
        totalRevenue: sum(orderItem.totalPrice),
      })
      .from(orderItem)
      .innerJoin(order, eq(orderItem.orderId, order.id))
      .where(and(gte(order.createdAt, from), lte(order.createdAt, to)))
      .groupBy(orderItem.menuItemId, orderItem.menuItemName)
      .orderBy(desc(sum(orderItem.quantity)))
      .limit(10)

    const orgRevenue = await db
      .select({
        organizationId: order.organizationId,
        name: organization.name,
        totalRevenue: sum(order.totalAmount),
        orderCount: count(),
      })
      .from(order)
      .innerJoin(organization, eq(order.organizationId, organization.id))
      .where(and(gte(order.createdAt, from), lte(order.createdAt, to)))
      .groupBy(order.organizationId, organization.name)
      .orderBy(desc(sum(order.totalAmount)))
      .limit(10)

    const dailyRevenue = await db
      .select({
        date: sql<string>`DATE(${order.createdAt})`,
        revenue: sum(order.totalAmount),
        orders: count(),
      })
      .from(order)
      .where(and(gte(order.createdAt, from), lte(order.createdAt, to)))
      .groupBy(sql`DATE(${order.createdAt})`)
      .orderBy(sql`DATE(${order.createdAt})`)

    const byHour = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${order.createdAt})::int`,
        orders: count(),
        revenue: sum(order.totalAmount),
      })
      .from(order)
      .where(and(gte(order.createdAt, from), lte(order.createdAt, to)))
      .groupBy(sql`EXTRACT(HOUR FROM ${order.createdAt})::int`)
      .orderBy(sql`EXTRACT(HOUR FROM ${order.createdAt})::int`)

    const byDow = await db
      .select({
        dow: sql<number>`EXTRACT(DOW FROM ${order.createdAt})::int`,
        orders: count(),
        revenue: sum(order.totalAmount),
      })
      .from(order)
      .where(and(gte(order.createdAt, from), lte(order.createdAt, to)))
      .groupBy(sql`EXTRACT(DOW FROM ${order.createdAt})::int`)
      .orderBy(sql`EXTRACT(DOW FROM ${order.createdAt})::int`)

    const orgGrowth = await db
      .select({
        date: sql<string>`DATE(${organization.createdAt})`,
        newOrgs: count(),
      })
      .from(organization)
      .where(and(gte(organization.createdAt, from), lte(organization.createdAt, to)))
      .groupBy(sql`DATE(${organization.createdAt})`)
      .orderBy(sql`DATE(${organization.createdAt})`)

    const statusBreakdown = await db
      .select({
        status: order.status,
        count: count(),
      })
      .from(order)
      .where(and(gte(order.createdAt, from), lte(order.createdAt, to)))
      .groupBy(order.status)

    const planDistribution = await db
      .select({
        plan: organizationProfile.subscriptionPlan,
        count: count(),
      })
      .from(organizationProfile)
      .groupBy(organizationProfile.subscriptionPlan)

    const statusDistribution = await db
      .select({
        status: organizationProfile.status,
        count: count(),
      })
      .from(organizationProfile)
      .groupBy(organizationProfile.status)

    const [tableCountRow] = await db.select({ count: count() }).from(restaurantTable)

    return c.json({
      period: { from, to },
      summary: {
        totalRevenue: totalRevAmt.toFixed(2),
        totalOrders,
        avgOrderValue: totalOrders > 0 ? (totalRevAmt / totalOrders).toFixed(2) : '0',
        totalTables: Number(tableCountRow?.count ?? 0),
      },
      topItems,
      topOrganizations: orgRevenue,
      dailyRevenue,
      byHour,
      byDow,
      orgGrowth,
      statusBreakdown,
      planDistribution,
      statusDistribution,
    })
  } catch (err: any) {
    console.error('[superadmin/analytics] error:', err)
    return c.json({ error: 'Failed to load analytics.' }, 500)
  }
})

// ─── Users ───────────────────────────────────

superAdminRouter.get('/users', async (c) => {
  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      banned: user.banned,
      banReason: user.banReason,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(desc(user.createdAt))

  return c.json({ users })
})

superAdminRouter.patch('/users/:id/ban', async (c) => {
  const { id } = c.req.param()
  const { reason } = await c.req.json()

  await db
    .update(user)
    .set({ banned: true, banReason: reason ?? null })
    .where(eq(user.id, id))

  return c.json({ message: 'User banned.' })
})

superAdminRouter.patch('/users/:id/unban', async (c) => {
  const { id } = c.req.param()

  await db.update(user).set({ banned: false, banReason: null }).where(eq(user.id, id))

  return c.json({ message: 'User unbanned.' })
})

export { superAdminRouter }
