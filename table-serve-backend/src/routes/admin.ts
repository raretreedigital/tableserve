import { Hono } from 'hono'
import { zv, zvq } from '../lib/zv'
import { eq, and, desc, asc, gte, lte, sql, sum, count, avg, inArray } from 'drizzle-orm'
import { db } from '../db'
import {
  organization,
  organizationProfile,
  member,
  menuCategory,
  menuItem,
  restaurantTable,
  order,
  orderItem,
  user,
  waiterAssignment,
} from '../db/schema'
import { requireOrgAdmin, requireActiveSubscription } from '../middleware/auth-middleware'
import { auth } from '../lib/auth'
import { log } from '../lib/logger'
import { env } from '../lib/env'
import { sendWelcomeEmail, sendNewOrganizationNotification } from '../lib/email'
import {
  registerAdminSchema,
  updateOrganizationProfileSchema,
  createMenuCategorySchema,
  updateMenuCategorySchema,
  createMenuItemSchema,
  updateMenuItemSchema,
  createRestaurantTableSchema,
  updateRestaurantTableSchema,
  updateOrderStatusSchema,
  analyticsQuerySchema,
  createWaiterSchema,
  updateWaiterSchema,
  tableSessionSettingsSchema,
} from '../lib/validators'

const adminRouter = new Hono<{ Variables: { user: any } }>()

// ─── Register admin + org ────────────────────

adminRouter.post('/register', zv(registerAdminSchema), async (c) => {
  const { name, email, password, organizationName, organizationSlug } = c.req.valid('json')

  const existing = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, organizationSlug))
    .limit(1)
  if (existing.length > 0) {
    return c.json({ error: 'Organization slug is already taken.' }, 409)
  }

  try {
    const result = await auth.api.signUpEmail({
      body: { name, email, password },
      headers: c.req.raw.headers,
    })

    if (!result?.user) return c.json({ error: 'Registration failed.' }, 400)

    const orgId = crypto.randomUUID()
    await db.insert(organization).values({
      id: orgId,
      name: organizationName,
      slug: organizationSlug,
      createdAt: new Date(),
    })

    await db.insert(organizationProfile).values({
      id: crypto.randomUUID(),
      organizationId: orgId,
      status: 'trial',
      subscriptionPlan: 'free',
    })

    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: orgId,
      userId: result.user.id,
      role: 'owner',
      createdAt: new Date(),
    })

    // Send welcome email (fire-and-forget)
    sendWelcomeEmail({
      adminName: name,
      adminEmail: email,
      organizationName,
      loginUrl: `${env.FRONTEND_URLS[0]}/admin/login`,
    }).catch(() => {})

    // Notify internal team of new registration (fire-and-forget)
    sendNewOrganizationNotification({
      organizationName,
      adminName: name,
      adminEmail: email,
    }).catch(() => {})

    return c.json(
      { message: 'Account and organization created. Please verify your email before signing in.', organizationId: orgId },
      201
    )
  } catch (err: any) {
    return c.json({ error: err.message ?? 'Registration failed.' }, 400)
  }
})

// ─── My Org (no org header required) ────────
// Returns the org ID for the currently authenticated user
adminRouter.get('/my-org', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'Authentication required.' }, 401)

  const rows = await db
    .select({ organizationId: member.organizationId, role: member.role })
    .from(member)
    .where(eq(member.userId, session.user.id))
    .limit(1)

  if (!rows.length) return c.json({ error: 'No organization found.' }, 404)
  return c.json({ organizationId: rows[0].organizationId })
})

// All routes below require auth + org membership
adminRouter.use('*', requireOrgAdmin)

// ─── Helper: resolve org id ──────────────────

function getOrgId(c: any): string {
  return c.get('organizationId') ?? (c.get('session') as any)?.activeOrganizationId
}

async function verifyOrgAccess(userId: string, orgId: string) {
  const m = await db
    .select()
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, orgId)))
    .limit(1)
  return m.length > 0 ? m[0] : null
}

// ─── Subscription status ────────────────────

adminRouter.get('/subscription', async (c) => {
  const orgId = getOrgId(c)
  const currentUser = c.get('user') as any

  if (currentUser.role !== 'superadmin') {
    const access = await verifyOrgAccess(currentUser.id, orgId)
    if (!access) return c.json({ error: 'Access denied.' }, 403)
  }

  const [profile] = await db
    .select({
      status: organizationProfile.status,
      plan: organizationProfile.subscriptionPlan,
      expiry: organizationProfile.subscriptionExpiry,
    })
    .from(organizationProfile)
    .where(eq(organizationProfile.organizationId, orgId))
    .limit(1)

  if (!profile) return c.json({ error: 'Organization not found.' }, 404)

  const isActive = profile.status === 'active'
  const isSuspended = profile.status === 'suspended'

  return c.json({
    status: profile.status,
    plan: profile.plan,
    expiry: profile.expiry,
    isActive,
    isSuspended,
    // Feature flags based on subscription
    features: {
      analytics: !isSuspended,
      waiterManagement: isActive,
      unlimitedMenuItems: isActive,
      unlimitedTables: isActive,
    },
    limits: isActive ? null : {
      menuItems: 10,
      tables: 3,
    },
  })
})

// ─── KDS Token ───────────────────────────────

adminRouter.get('/kds-token', requireOrgAdmin, async (c) => {
  const orgId = getOrgId(c)
  const [profile] = await db
    .select({ kdsToken: organizationProfile.kdsToken })
    .from(organizationProfile)
    .where(eq(organizationProfile.organizationId, orgId))
    .limit(1)
  if (!profile) return c.json({ error: 'Organization not found.' }, 404)

  // Auto-generate if not set
  let token = profile.kdsToken
  if (!token) {
    token = crypto.randomUUID() + '-' + crypto.randomUUID()
    await db.update(organizationProfile).set({ kdsToken: token, updatedAt: new Date() }).where(eq(organizationProfile.organizationId, orgId))
  }

  return c.json({ kdsToken: token, kdsUrl: `/kds/${token}` })
})

adminRouter.post('/kds-token/regenerate', requireOrgAdmin, async (c) => {
  const orgId = getOrgId(c)
  const token = crypto.randomUUID() + '-' + crypto.randomUUID()
  await db.update(organizationProfile).set({ kdsToken: token, updatedAt: new Date() }).where(eq(organizationProfile.organizationId, orgId))
  return c.json({ kdsToken: token, kdsUrl: `/kds/${token}` })
})

// ─── Table Session Security Settings ─────────

adminRouter.get('/table-session-settings', async (c) => {
  const orgId = getOrgId(c)
  const currentUser = c.get('user') as any
  if (currentUser.role !== 'superadmin') {
    const access = await verifyOrgAccess(currentUser.id, orgId)
    if (!access) return c.json({ error: 'Access denied.' }, 403)
  }

  const [profile] = await db
    .select({
      collectCustomerDetails: organizationProfile.collectCustomerDetails,
      requireOrderingOtp: organizationProfile.requireOrderingOtp,
      requireSessionApproval: organizationProfile.requireSessionApproval,
    })
    .from(organizationProfile)
    .where(eq(organizationProfile.organizationId, orgId))
    .limit(1)

  return c.json(profile ?? { collectCustomerDetails: false, requireOrderingOtp: false, requireSessionApproval: false })
})

adminRouter.patch('/table-session-settings', zv(tableSessionSettingsSchema), async (c) => {
  const orgId = getOrgId(c)
  const currentUser = c.get('user') as any
  if (currentUser.role !== 'superadmin') {
    const access = await verifyOrgAccess(currentUser.id, orgId)
    if (!access) return c.json({ error: 'Access denied.' }, 403)
  }

  const data = c.req.valid('json')
  await db
    .update(organizationProfile)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(organizationProfile.organizationId, orgId))

  return c.json({ message: 'Security settings updated.' })
})

// ─── Dashboard ───────────────────────────────

adminRouter.get('/dashboard', async (c) => {
  const orgId = getOrgId(c)
  const currentUser = c.get('user') as any

  if (currentUser.role !== 'superadmin') {
    const access = await verifyOrgAccess(currentUser.id, orgId)
    if (!access) return c.json({ error: 'Access denied.' }, 403)
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [todayOrders] = await db
    .select({ count: count(), revenue: sum(order.totalAmount) })
    .from(order)
    .where(and(eq(order.organizationId, orgId), gte(order.createdAt, todayStart)))

  const [monthOrders] = await db
    .select({ count: count(), revenue: sum(order.totalAmount) })
    .from(order)
    .where(and(eq(order.organizationId, orgId), gte(order.createdAt, monthStart)))

  const [totalItems] = await db
    .select({ count: count() })
    .from(menuItem)
    .where(eq(menuItem.organizationId, orgId))

  const [totalTables] = await db
    .select({ count: count() })
    .from(restaurantTable)
    .where(eq(restaurantTable.organizationId, orgId))

  const pendingOrders = await db
    .select()
    .from(order)
    .where(and(eq(order.organizationId, orgId), eq(order.status, 'pending')))
    .orderBy(desc(order.createdAt))
    .limit(10)

  return c.json({
    today: {
      orders: todayOrders.count,
      revenue: todayOrders.revenue ?? '0',
    },
    thisMonth: {
      orders: monthOrders.count,
      revenue: monthOrders.revenue ?? '0',
    },
    totalMenuItems: totalItems.count,
    totalTables: totalTables.count,
    pendingOrders,
  })
})

// ─── Organization Profile ────────────────────

// Update organization name
adminRouter.patch('/organization-name', async (c) => {
  const orgId = getOrgId(c)
  const currentUser = c.get('user') as any

  if (currentUser.role !== 'superadmin') {
    const access = await verifyOrgAccess(currentUser.id, orgId)
    if (!access || (access.role !== 'owner' && access.role !== 'admin')) {
      return c.json({ error: 'Insufficient permissions.' }, 403)
    }
  }

  const { name } = await c.req.json()
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return c.json({ error: 'Organization name must be at least 2 characters.' }, 400)
  }

  await db.update(organization).set({ name: name.trim() }).where(eq(organization.id, orgId))
  return c.json({ message: 'Organization name updated.' })
})

adminRouter.get('/profile', async (c) => {
  const orgId = getOrgId(c)
  const currentUser = c.get('user') as any

  if (currentUser.role !== 'superadmin') {
    const access = await verifyOrgAccess(currentUser.id, orgId)
    if (!access) return c.json({ error: 'Access denied.' }, 403)
  }

  const result = await db
    .select()
    .from(organization)
    .leftJoin(organizationProfile, eq(organization.id, organizationProfile.organizationId))
    .where(eq(organization.id, orgId))
    .limit(1)

  if (!result.length) return c.json({ error: 'Organization not found.' }, 404)

  return c.json(result[0])
})

adminRouter.patch(
  '/profile',
  zv(updateOrganizationProfileSchema),
  async (c) => {
    const orgId = getOrgId(c)
    const currentUser = c.get('user') as any

    if (currentUser.role !== 'superadmin') {
      const access = await verifyOrgAccess(currentUser.id, orgId)
      if (!access || (access.role !== 'owner' && access.role !== 'admin')) {
        return c.json({ error: 'Insufficient permissions.' }, 403)
      }
    }

    const data = c.req.valid('json')

    // ── Plan-based feature gating ──
    // Fetch current plan before applying changes
    const currentProfile = await db
      .select({ subscriptionPlan: organizationProfile.subscriptionPlan })
      .from(organizationProfile)
      .where(eq(organizationProfile.organizationId, orgId))
      .limit(1)

    const plan = currentProfile[0]?.subscriptionPlan ?? 'free'
    const isPaidPlan = plan === 'basic' || plan === 'premium'
    const isPremium = plan === 'premium'

    // Branding fields are Basic+ only
    const brandingFields = ['primaryColor', 'secondaryColor', 'accentColor', 'fontFamily', 'bannerUrl', 'logoUrl', 'supportName', 'welcomeMessage', 'footerText']
    for (const field of brandingFields) {
      if ((data as any)[field] !== undefined && !isPaidPlan) {
        return c.json({ error: `Branding customization requires the Basic plan or higher. You are on the ${plan} plan.` }, 403)
      }
    }

    // orderEditWindowMinutes is Basic+ only
    if (data.orderEditWindowMinutes !== undefined && !isPaidPlan) {
      return c.json({ error: `Order edit window configuration requires the Basic plan or higher.` }, 403)
    }

    // Social links are Premium only
    if (data.socialLinks !== undefined && !isPremium) {
      return c.json({ error: `Social links require the Premium plan.` }, 403)
    }

    await db
      .update(organizationProfile)
      .set({
        ...data,
        taxRate: data.taxRate !== undefined ? String(data.taxRate) : undefined,
        serviceChargeRate: data.serviceChargeRate !== undefined ? String(data.serviceChargeRate) : undefined,
        supportName: data.supportName,
        updatedAt: new Date(),
      })
      .where(eq(organizationProfile.organizationId, orgId))

    return c.json({ message: 'Profile updated.' })
  }
)

// ─── Menu Categories ─────────────────────────

adminRouter.get('/categories', async (c) => {
  const orgId = getOrgId(c)

  const categories = await db
    .select()
    .from(menuCategory)
    .where(eq(menuCategory.organizationId, orgId))
    .orderBy(asc(menuCategory.sortOrder), asc(menuCategory.name))

  return c.json({ categories })
})

adminRouter.post(
  '/categories',
  zv(createMenuCategorySchema),
  async (c) => {
    const orgId = getOrgId(c)
    const data = c.req.valid('json')

    const id = crypto.randomUUID()
    await db.insert(menuCategory).values({
      id,
      organizationId: orgId,
      ...data,
    })

    const created = await db
      .select()
      .from(menuCategory)
      .where(eq(menuCategory.id, id))
      .limit(1)

    return c.json({ category: created[0] }, 201)
  }
)

adminRouter.patch(
  '/categories/:id',
  zv(updateMenuCategorySchema),
  async (c) => {
    const orgId = getOrgId(c)
    const { id } = c.req.param()
    const data = c.req.valid('json')

    const existing = await db
      .select()
      .from(menuCategory)
      .where(and(eq(menuCategory.id, id), eq(menuCategory.organizationId, orgId)))
      .limit(1)

    if (!existing.length) return c.json({ error: 'Category not found.' }, 404)

    await db
      .update(menuCategory)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(menuCategory.id, id))

    return c.json({ message: 'Category updated.' })
  }
)

adminRouter.delete('/categories/:id', async (c) => {
  const orgId = getOrgId(c)
  const { id } = c.req.param()

  const existing = await db
    .select()
    .from(menuCategory)
    .where(and(eq(menuCategory.id, id), eq(menuCategory.organizationId, orgId)))
    .limit(1)

  if (!existing.length) return c.json({ error: 'Category not found.' }, 404)

  // Unlink items from category
  await db
    .update(menuItem)
    .set({ categoryId: null })
    .where(and(eq(menuItem.categoryId, id), eq(menuItem.organizationId, orgId)))

  await db.delete(menuCategory).where(eq(menuCategory.id, id))

  return c.json({ message: 'Category deleted.' })
})

// ─── Menu Items ──────────────────────────────

adminRouter.get('/menu', async (c) => {
  const orgId = getOrgId(c)

  const items = await db
    .select({
      item: menuItem,
      categoryName: menuCategory.name,
    })
    .from(menuItem)
    .leftJoin(menuCategory, eq(menuItem.categoryId, menuCategory.id))
    .where(eq(menuItem.organizationId, orgId))
    .orderBy(asc(menuItem.sortOrder), asc(menuItem.name))

  return c.json({ items })
})

adminRouter.post('/menu', zv(createMenuItemSchema), async (c) => {
  const orgId = getOrgId(c)
  const data = c.req.valid('json')

  // Check subscription limits
  const [itemCount] = await db
    .select({ count: count() })
    .from(menuItem)
    .where(eq(menuItem.organizationId, orgId))

  const [profile] = await db
    .select()
    .from(organizationProfile)
    .where(eq(organizationProfile.organizationId, orgId))
    .limit(1)

  const limits: Record<string, number> = { free: 20, basic: 100, premium: Infinity }
  const plan = profile?.subscriptionPlan ?? 'free'
  if (itemCount.count >= limits[plan]) {
    return c.json(
      { error: `Menu item limit reached for ${plan} plan. Please upgrade.` },
      403
    )
  }

  const id = crypto.randomUUID()
  const { price, ...rest } = data
  await db.insert(menuItem).values({
    id,
    organizationId: orgId,
    price: String(price),
    ...rest,
  })

  const created = await db.select().from(menuItem).where(eq(menuItem.id, id)).limit(1)

  return c.json({ item: created[0] }, 201)
})

adminRouter.patch('/menu/:id', zv(updateMenuItemSchema), async (c) => {
  const orgId = getOrgId(c)
  const { id } = c.req.param()
  const data = c.req.valid('json')

  const existing = await db
    .select()
    .from(menuItem)
    .where(and(eq(menuItem.id, id), eq(menuItem.organizationId, orgId)))
    .limit(1)

  if (!existing.length) return c.json({ error: 'Menu item not found.' }, 404)

  const updateData: any = { ...data, updatedAt: new Date() }
  if (data.price !== undefined) updateData.price = String(data.price)

  await db.update(menuItem).set(updateData).where(eq(menuItem.id, id))

  return c.json({ message: 'Menu item updated.' })
})

adminRouter.delete('/menu/:id', async (c) => {
  const orgId = getOrgId(c)
  const { id } = c.req.param()

  const existing = await db
    .select()
    .from(menuItem)
    .where(and(eq(menuItem.id, id), eq(menuItem.organizationId, orgId)))
    .limit(1)

  if (!existing.length) return c.json({ error: 'Menu item not found.' }, 404)

  await db.update(menuItem).set({ isAvailable: false }).where(eq(menuItem.id, id))

  return c.json({ message: 'Menu item deactivated.' })
})

// ─── Tables ──────────────────────────────────

adminRouter.get('/tables', async (c) => {
  const orgId = getOrgId(c)

  const tables = await db
    .select()
    .from(restaurantTable)
    .where(eq(restaurantTable.organizationId, orgId))
    .orderBy(asc(restaurantTable.name))

  return c.json({ tables })
})

adminRouter.post('/tables', zv(createRestaurantTableSchema), async (c) => {
  const orgId = getOrgId(c)
  const data = c.req.valid('json')

  const [tableCount] = await db
    .select({ count: count() })
    .from(restaurantTable)
    .where(eq(restaurantTable.organizationId, orgId))

  const [profile] = await db
    .select()
    .from(organizationProfile)
    .where(eq(organizationProfile.organizationId, orgId))
    .limit(1)

  const limits: Record<string, number> = { free: 1, basic: 10, premium: Infinity }
  const plan = profile?.subscriptionPlan ?? 'free'
  if (tableCount.count >= limits[plan]) {
    return c.json(
      { error: `Table limit reached for ${plan} plan. Please upgrade.` },
      403
    )
  }

  const id = crypto.randomUUID()
  const nfcToken = crypto.randomUUID()

  await db.insert(restaurantTable).values({
    id,
    organizationId: orgId,
    nfcToken,
    ...data,
  })

  const created = await db
    .select()
    .from(restaurantTable)
    .where(eq(restaurantTable.id, id))
    .limit(1)

  return c.json({ table: created[0] }, 201)
})

adminRouter.patch('/tables/:id', zv(updateRestaurantTableSchema), async (c) => {
  const orgId = getOrgId(c)
  const { id } = c.req.param()
  const data = c.req.valid('json')

  const existing = await db
    .select()
    .from(restaurantTable)
    .where(and(eq(restaurantTable.id, id), eq(restaurantTable.organizationId, orgId)))
    .limit(1)

  if (!existing.length) return c.json({ error: 'Table not found.' }, 404)

  await db
    .update(restaurantTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(restaurantTable.id, id))

  return c.json({ message: 'Table updated.' })
})

adminRouter.delete('/tables/:id', async (c) => {
  const orgId = getOrgId(c)
  const { id } = c.req.param()

  const existing = await db
    .select()
    .from(restaurantTable)
    .where(and(eq(restaurantTable.id, id), eq(restaurantTable.organizationId, orgId)))
    .limit(1)

  if (!existing.length) return c.json({ error: 'Table not found.' }, 404)

  await db.delete(restaurantTable).where(eq(restaurantTable.id, id))

  return c.json({ message: 'Table deleted.' })
})

// ─── End table session ───────────────────────

adminRouter.post('/tables/:id/end-session', async (c) => {
  const orgId = getOrgId(c)
  const { id } = c.req.param()

  const existing = await db
    .select()
    .from(restaurantTable)
    .where(and(eq(restaurantTable.id, id), eq(restaurantTable.organizationId, orgId)))
    .limit(1)

  if (!existing.length) return c.json({ error: 'Table not found.' }, 404)

  // Mark all active orders on this table as served
  await db
    .update(order)
    .set({ status: 'served', updatedAt: new Date() })
    .where(and(
      eq(order.tableId, id),
      inArray(order.status, ['pending', 'confirmed', 'preparing', 'ready'] as any[])
    ))

  // Clear bill requested flag and session timestamp — this immediately hides
  // previous orders on the customer's My Orders panel even if their JWT is still valid.
  await db
    .update(restaurantTable)
    .set({
      billRequested: false,
      sessionStartedAt: null,
      sessionApproved: true,
      customerName: null,
      partySize: null,
      sessionOtp: null,
      sessionOtpExpiry: null,
      updatedAt: new Date(),
    })
    .where(eq(restaurantTable.id, id))

  return c.json({ message: 'Table session ended. All active orders marked as served.' })
})

// ─── Generate OTP for a table ─────────────────

adminRouter.post('/tables/:id/generate-otp', async (c) => {
  const orgId = getOrgId(c)
  const { id } = c.req.param()

  const [existing] = await db
    .select()
    .from(restaurantTable)
    .where(and(eq(restaurantTable.id, id), eq(restaurantTable.organizationId, orgId)))
    .limit(1)

  if (!existing) return c.json({ error: 'Table not found.' }, 404)

  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  await db
    .update(restaurantTable)
    .set({ sessionOtp: otp, sessionOtpExpiry: expiresAt, updatedAt: new Date() })
    .where(eq(restaurantTable.id, id))

  return c.json({ otp, expiresAt: expiresAt.toISOString() })
})

// ─── Approve pending table session ────────────

adminRouter.post('/tables/:id/approve-session', async (c) => {
  const orgId = getOrgId(c)
  const { id } = c.req.param()

  const [existing] = await db
    .select()
    .from(restaurantTable)
    .where(and(eq(restaurantTable.id, id), eq(restaurantTable.organizationId, orgId)))
    .limit(1)

  if (!existing) return c.json({ error: 'Table not found.' }, 404)

  await db
    .update(restaurantTable)
    .set({ sessionApproved: true, updatedAt: new Date() })
    .where(eq(restaurantTable.id, id))

  return c.json({ message: 'Session approved.' })
})

// ─── Get current session orders for a table ───

adminRouter.get('/tables/:id/orders', async (c) => {
  const orgId = getOrgId(c)
  const { id } = c.req.param()

  const [tableRow] = await db
    .select({ sessionStartedAt: restaurantTable.sessionStartedAt })
    .from(restaurantTable)
    .where(and(eq(restaurantTable.id, id), eq(restaurantTable.organizationId, orgId)))
    .limit(1)

  if (!tableRow) return c.json({ error: 'Table not found.' }, 404)

  const whereClause = tableRow.sessionStartedAt
    ? and(eq(order.tableId, id), gte(order.createdAt, tableRow.sessionStartedAt))
    : eq(order.tableId, id)

  const orders = await db
    .select()
    .from(order)
    .where(whereClause)
    .orderBy(asc(order.createdAt))

  if (!orders.length) return c.json({ orders: [], items: [] })

  const orderIds = orders.map((o) => o.id)
  const items = await db.select().from(orderItem).where(inArray(orderItem.orderId, orderIds))

  return c.json({ orders, items })
})

// ─── Orders ──────────────────────────────────

adminRouter.get('/orders', async (c) => {
  const orgId = getOrgId(c)
  const status = c.req.query('status')
  const includeItems = c.req.query('include') === 'items'

  const conditions = [eq(order.organizationId, orgId)]
  if (status) {
    conditions.push(eq(order.status, status as any))
  }

  const orders = await db
    .select({
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      tableId: order.tableId,
      tableName: restaurantTable.name,
    })
    .from(order)
    .leftJoin(restaurantTable, eq(order.tableId, restaurantTable.id))
    .where(and(...conditions))
    .orderBy(desc(order.createdAt))
    .limit(100)

  if (!includeItems) return c.json({ orders })

  const orderIds = orders.map(o => o.id)
  const items = orderIds.length
    ? await db.select().from(orderItem).where(inArray(orderItem.orderId, orderIds))
    : []

  const itemsByOrder = items.reduce((acc, item) => {
    ;(acc[item.orderId] ??= []).push(item)
    return acc
  }, {} as Record<string, typeof items>)

  return c.json({ orders: orders.map(o => ({ ...o, items: itemsByOrder[o.id] ?? [] })) })
})

adminRouter.get('/orders/:id', async (c) => {
  const orgId = getOrgId(c)
  const { id } = c.req.param()

  const orders = await db
    .select()
    .from(order)
    .where(and(eq(order.id, id), eq(order.organizationId, orgId)))
    .limit(1)

  if (!orders.length) return c.json({ error: 'Order not found.' }, 404)

  const items = await db
    .select()
    .from(orderItem)
    .where(eq(orderItem.orderId, id))

  return c.json({ order: orders[0], items })
})

adminRouter.patch(
  '/orders/:id/status',
  zv(updateOrderStatusSchema),
  async (c) => {
    const orgId = getOrgId(c)
    const { id } = c.req.param()
    const { status } = c.req.valid('json')

    const existing = await db
      .select()
      .from(order)
      .where(and(eq(order.id, id), eq(order.organizationId, orgId)))
      .limit(1)

    if (!existing.length) return c.json({ error: 'Order not found.' }, 404)

    await db
      .update(order)
      .set({ status, updatedAt: new Date() })
      .where(eq(order.id, id))

    return c.json({ message: 'Order status updated.' })
  }
)

// ─── Analytics ───────────────────────────────

adminRouter.get('/analytics', zvq(analyticsQuerySchema), async (c) => {
  const orgId = getOrgId(c)
  const { period } = c.req.valid('query')

  const now = new Date()
  let from: Date = new Date(now.getFullYear(), now.getMonth(), 1)
  const to: Date = now

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

  const baseConditions = [
    eq(order.organizationId, orgId),
    gte(order.createdAt, from),
    lte(order.createdAt, to),
  ]

  try {
    const [summaryRow] = await db
      .select({
        totalOrders: count(),
        totalRevenue: sum(order.totalAmount),
        avgOrderValue: avg(order.totalAmount),
      })
      .from(order)
      .where(and(...baseConditions))

    const summary = {
      totalOrders: Number(summaryRow?.totalOrders ?? 0),
      totalRevenue: summaryRow?.totalRevenue ?? '0',
      avgOrderValue: summaryRow?.avgOrderValue ?? '0',
    }

    const byStatus = await db
      .select({ status: order.status, count: count() })
      .from(order)
      .where(and(...baseConditions))
      .groupBy(order.status)

    const topItems = await db
      .select({
        menuItemId: orderItem.menuItemId,
        name: orderItem.menuItemName,
        totalQuantity: sum(orderItem.quantity),
        totalRevenue: sum(orderItem.totalPrice),
        orderCount: count(),
      })
      .from(orderItem)
      .innerJoin(order, eq(orderItem.orderId, order.id))
      .where(and(...baseConditions))
      .groupBy(orderItem.menuItemId, orderItem.menuItemName)
      .orderBy(desc(sum(orderItem.quantity)))
      .limit(10)

    const slowItems = await db
      .select({
        menuItemId: orderItem.menuItemId,
        name: orderItem.menuItemName,
        totalQuantity: sum(orderItem.quantity),
      })
      .from(orderItem)
      .innerJoin(order, eq(orderItem.orderId, order.id))
      .where(and(...baseConditions))
      .groupBy(orderItem.menuItemId, orderItem.menuItemName)
      .orderBy(asc(sum(orderItem.quantity)))
      .limit(5)

    const dailyRevenue = await db
      .select({
        date: sql<string>`DATE(${order.createdAt})`,
        revenue: sum(order.totalAmount),
        orders: count(),
      })
      .from(order)
      .where(and(...baseConditions))
      .groupBy(sql`DATE(${order.createdAt})`)
      .orderBy(sql`DATE(${order.createdAt})`)

    const hourlyDistribution = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${order.createdAt})::int`,
        orders: count(),
      })
      .from(order)
      .where(and(...baseConditions))
      .groupBy(sql`EXTRACT(HOUR FROM ${order.createdAt})::int`)
      .orderBy(sql`EXTRACT(HOUR FROM ${order.createdAt})::int`)

    const revenueByCategory = await db
      .select({
        categoryId: menuItem.categoryId,
        categoryName: menuCategory.name,
        totalRevenue: sum(orderItem.totalPrice),
        totalQuantity: sum(orderItem.quantity),
      })
      .from(orderItem)
      .innerJoin(order, eq(orderItem.orderId, order.id))
      .innerJoin(menuItem, eq(orderItem.menuItemId, menuItem.id))
      .leftJoin(menuCategory, eq(menuItem.categoryId, menuCategory.id))
      .where(and(...baseConditions))
      .groupBy(menuItem.categoryId, menuCategory.name)
      .orderBy(desc(sum(orderItem.totalPrice)))

    return c.json({
      period: { from, to },
      summary,
      byStatus,
      topItems,
      slowItems,
      dailyRevenue,
      hourlyDistribution,
      revenueByCategory,
    })
  } catch (err: any) {
    console.error('[admin/analytics] error:', err)
    return c.json({ error: 'Failed to load analytics.' }, 500)
  }
})

// ─── Reports ─────────────────────────────────

adminRouter.get('/reports', zvq(analyticsQuerySchema), async (c) => {
  const orgId = getOrgId(c)
  const { period } = c.req.valid('query')

  const now = new Date()
  let from: Date = new Date(now.getFullYear(), now.getMonth(), 1)
  const to: Date = now

  switch (period) {
    case 'today': from = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break
    case 'week':  from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break
    case 'month': from = new Date(now.getFullYear(), now.getMonth(), 1); break
    case 'quarter': from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break
    case 'year': from = new Date(now.getFullYear(), 0, 1); break
  }

  try {
    const conditions = [eq(order.organizationId, orgId), gte(order.createdAt, from), lte(order.createdAt, to)]

    const byTable = await db
      .select({
        tableId: order.tableId,
        tableName: restaurantTable.name,
        orders: count(),
        revenue: sum(order.totalAmount),
      })
      .from(order)
      .leftJoin(restaurantTable, eq(order.tableId, restaurantTable.id))
      .where(and(...conditions))
      .groupBy(order.tableId, restaurantTable.name)
      .orderBy(desc(sum(order.totalAmount)))
      .limit(20)

    const byHour = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${order.createdAt})::int`,
        orders: count(),
        revenue: sum(order.totalAmount),
      })
      .from(order)
      .where(and(...conditions))
      .groupBy(sql`EXTRACT(HOUR FROM ${order.createdAt})::int`)
      .orderBy(sql`EXTRACT(HOUR FROM ${order.createdAt})::int`)

    const byDow = await db
      .select({
        dow: sql<number>`EXTRACT(DOW FROM ${order.createdAt})::int`,
        orders: count(),
        revenue: sum(order.totalAmount),
      })
      .from(order)
      .where(and(...conditions))
      .groupBy(sql`EXTRACT(DOW FROM ${order.createdAt})::int`)
      .orderBy(sql`EXTRACT(DOW FROM ${order.createdAt})::int`)

    const funnel = await db
      .select({ status: order.status, count: count() })
      .from(order)
      .where(and(...conditions))
      .groupBy(order.status)

    const avgFulfillment = await db
      .select({
        avg: sql<string>`AVG(EXTRACT(EPOCH FROM (${order.updatedAt} - ${order.createdAt})) / 60)`,
      })
      .from(order)
      .where(and(...conditions, eq(order.status, 'served')))

    const dailyTrend = await db
      .select({
        date: sql<string>`DATE(${order.createdAt})`,
        revenue: sum(order.totalAmount),
        orders: count(),
      })
      .from(order)
      .where(and(...conditions))
      .groupBy(sql`DATE(${order.createdAt})`)
      .orderBy(sql`DATE(${order.createdAt})`)

    return c.json({
      period: { from, to },
      byTable,
      byHour,
      byDow,
      funnel,
      avgFulfillmentMinutes: parseFloat(avgFulfillment[0]?.avg ?? '0'),
      dailyTrend,
    })
  } catch (err: any) {
    console.error('[admin/reports] error:', err)
    return c.json({ error: 'Failed to load reports.' }, 500)
  }
})

// ─── Export Orders CSV ───────────────────────

adminRouter.get('/export/orders', zvq(analyticsQuerySchema), async (c) => {
  const orgId = getOrgId(c)
  const { period } = c.req.valid('query')

  const now = new Date()
  let from: Date = new Date(now.getFullYear(), now.getMonth(), 1)
  const to: Date = now

  switch (period) {
    case 'today': from = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break
    case 'week':  from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break
    case 'month': from = new Date(now.getFullYear(), now.getMonth(), 1); break
    case 'quarter': from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break
    case 'year': from = new Date(now.getFullYear(), 0, 1); break
  }

  const orders = await db
    .select({
      id: order.id,
      createdAt: order.createdAt,
      status: order.status,
      totalAmount: order.totalAmount,
      tableId: order.tableId,
      customerName: order.customerName,
      notes: order.notes,
    })
    .from(order)
    .where(and(eq(order.organizationId, orgId), gte(order.createdAt, from), lte(order.createdAt, to)))
    .orderBy(desc(order.createdAt))

  if (!orders.length) {
    c.header('Content-Type', 'text/csv')
    c.header('Content-Disposition', `attachment; filename="orders-${period ?? 'month'}.csv"`)
    return c.body('Order ID,Date,Time,Status,Customer,Table,Notes,Total\n')
  }

  const orderIds = orders.map((o) => o.id)
  const items = await db.select().from(orderItem).where(inArray(orderItem.orderId, orderIds))

  // Fetch table names
  const tableIds = [...new Set(orders.map((o) => o.tableId).filter(Boolean) as string[])]
  const tables = tableIds.length
    ? await db.select({ id: restaurantTable.id, name: restaurantTable.name }).from(restaurantTable).where(inArray(restaurantTable.id, tableIds))
    : []
  const tableMap = Object.fromEntries(tables.map((t) => [t.id, t.name]))

  const itemsByOrder = items.reduce<Record<string, typeof items>>((acc, item) => {
    ;(acc[item.orderId] ??= []).push(item)
    return acc
  }, {})

  const escape = (s: string | null | undefined) => `"${(s ?? '').replace(/"/g, '""')}"`

  const rows = orders.map((o) => {
    const date = new Date(o.createdAt)
    const itemsStr = (itemsByOrder[o.id] ?? []).map((i) => `${i.quantity}x ${i.menuItemName}`).join('; ')
    return [
      escape(o.id.slice(0, 8)),
      escape(date.toLocaleDateString()),
      escape(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
      escape(o.status),
      escape(o.customerName),
      escape(o.tableId ? tableMap[o.tableId] : ''),
      escape(itemsStr),
      escape(o.notes),
      o.totalAmount ?? '0',
    ].join(',')
  })

  const csv = ['Order ID,Date,Time,Status,Customer,Table,Items,Notes,Total', ...rows].join('\n')

  c.header('Content-Type', 'text/csv; charset=utf-8')
  c.header('Content-Disposition', `attachment; filename="orders-${period ?? 'month'}.csv"`)
  return c.body(csv)
})

// ─── Members ─────────────────────────────────

adminRouter.get('/members', async (c) => {
  const orgId = getOrgId(c)

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
    .where(eq(member.organizationId, orgId))

  return c.json({ members })
})

// Add a new staff member (create account + add to org)
adminRouter.post('/members', async (c) => {
  const orgId = getOrgId(c)
  const currentUser = c.get('user') as any
  const access = await verifyOrgAccess(currentUser.id, orgId)
  if (!access || (access.role !== 'owner' && access.role !== 'admin')) {
    return c.json({ error: 'Only owners and admins can add members.' }, 403)
  }

  const { name, email, role = 'member' } = await c.req.json()
  if (!name || !email) return c.json({ error: 'Name and email are required.' }, 400)
  if (!['admin', 'member'].includes(role)) return c.json({ error: 'Role must be admin or member.' }, 400)

  // Check if user already exists
  const [existing] = await db.select().from(user).where(eq(user.email, email)).limit(1)

  let userId: string
  let generatedPassword: string | undefined

  if (existing) {
    // Check if already in this org
    const [alreadyMember] = await db.select().from(member)
      .where(and(eq(member.userId, existing.id), eq(member.organizationId, orgId))).limit(1)
    if (alreadyMember) return c.json({ error: 'This user is already a member of your organization.' }, 409)
    userId = existing.id
  } else {
    // Create account with auto-generated password
    generatedPassword = crypto.randomUUID().slice(0, 8).toUpperCase() + crypto.randomUUID().slice(0, 4) + '!1'
    const created = await auth.api.signUpEmail({
      body: { name, email, password: generatedPassword },
      headers: c.req.raw.headers,
    })
    if (!created?.user) return c.json({ error: 'Failed to create user account.' }, 400)
    userId = created.user.id
    // Mark email as verified so they can log in immediately
    await db.update(user).set({ emailVerified: true }).where(eq(user.id, userId))
  }

  await db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId: orgId,
    userId,
    role,
    createdAt: new Date(),
  })

  return c.json({
    message: generatedPassword
      ? 'Staff member created. Share these credentials once — they cannot be recovered.'
      : 'Existing user added to your organization.',
    ...(generatedPassword ? { credentials: { email, password: generatedPassword } } : {}),
  }, 201)
})

// Remove a member from the org
adminRouter.delete('/members/:id', async (c) => {
  const orgId = getOrgId(c)
  const currentUser = c.get('user') as any
  const { id } = c.req.param()

  const access = await verifyOrgAccess(currentUser.id, orgId)
  if (!access || (access.role !== 'owner' && access.role !== 'admin')) {
    return c.json({ error: 'Only owners and admins can remove members.' }, 403)
  }

  const [m] = await db.select().from(member)
    .where(and(eq(member.id, id), eq(member.organizationId, orgId))).limit(1)
  if (!m) return c.json({ error: 'Member not found.' }, 404)
  if (m.role === 'owner') return c.json({ error: 'Cannot remove the organization owner.' }, 403)
  if (m.userId === currentUser.id) return c.json({ error: 'Cannot remove yourself.' }, 403)

  await db.delete(member).where(eq(member.id, id))
  return c.json({ message: 'Member removed.' })
})

// ─── Waiter Management (Active subscription only) ───────────────────────────

adminRouter.get('/waiters', requireOrgAdmin, requireActiveSubscription, async (c) => {
  const orgId = getOrgId(c)

  const [profile] = await db.select().from(organizationProfile)
    .where(eq(organizationProfile.organizationId, orgId)).limit(1)
  if (profile?.subscriptionPlan !== 'premium')
    return c.json({ error: 'Waiter management requires the Premium plan.' }, 403)

  const rows = await db
    .select({
      id: waiterAssignment.id,
      userId: waiterAssignment.userId,
      tableIds: waiterAssignment.tableIds,
      isActive: waiterAssignment.isActive,
      dutyStatus: waiterAssignment.dutyStatus,
      createdAt: waiterAssignment.createdAt,
      name: user.name,
      email: user.email,
    })
    .from(waiterAssignment)
    .innerJoin(user, eq(waiterAssignment.userId, user.id))
    .where(eq(waiterAssignment.organizationId, orgId))
    .orderBy(desc(waiterAssignment.createdAt))

  return c.json(rows.map(r => ({ ...r, tableIds: JSON.parse(r.tableIds || '[]') })))
})

adminRouter.post('/waiters', requireOrgAdmin, requireActiveSubscription, zv(createWaiterSchema), async (c) => {
  const orgId = getOrgId(c)

  const { name, email, tableIds } = c.req.valid('json')

  // Auto-generate a temporary password — admin shows it once in the UI
  const generatedPassword = crypto.randomUUID().slice(0, 8).toUpperCase() +
    crypto.randomUUID().slice(0, 4) + '!1'

  // Check for existing user with that email
  const [existing] = await db.select().from(user).where(eq(user.email, email)).limit(1)
  if (existing) return c.json({ error: 'A user with that email already exists.' }, 409)

  // Create better-auth user
  const created = await auth.api.signUpEmail({
    body: { name, email, password: generatedPassword },
    headers: c.req.raw.headers,
  })
  if (!created?.user) return c.json({ error: 'Failed to create waiter account.' }, 400)

  // Set role to waiter
  await db.update(user).set({ role: 'waiter' }).where(eq(user.id, created.user.id))

  // Create assignment
  const [assignment] = await db
    .insert(waiterAssignment)
    .values({
      organizationId: orgId,
      userId: created.user.id,
      tableIds: JSON.stringify(tableIds),
      isActive: true,
    })
    .returning()

  log.info('admin:waiter-created', { waiterId: created.user.id, orgId })

  return c.json({
    message: 'Waiter created. Share these credentials once — they cannot be recovered.',
    waiterId: created.user.id,
    assignmentId: assignment.id,
    credentials: { email, password: generatedPassword },
  }, 201)
})

// ─── POST /admin/waiters/:id/regenerate-credentials ─────────────────────────
// Generates a new password for a waiter and returns it once. Use when a
// waiter forgets their password — they must change it after first login.

adminRouter.post('/waiters/:id/regenerate-credentials', requireOrgAdmin, requireActiveSubscription, async (c) => {
  const orgId = getOrgId(c)

  const assignmentId = c.req.param('id') as string

  const [assignment] = await db.select().from(waiterAssignment)
    .where(and(eq(waiterAssignment.id, assignmentId), eq(waiterAssignment.organizationId, orgId)))
    .limit(1)
  if (!assignment) return c.json({ error: 'Waiter assignment not found.' }, 404)

  const [waiterUser] = await db.select().from(user).where(eq(user.id, assignment.userId)).limit(1)
  if (!waiterUser) return c.json({ error: 'Waiter user not found.' }, 404)

  const newPassword = crypto.randomUUID().slice(0, 8).toUpperCase() +
    crypto.randomUUID().slice(0, 4) + '!1'

  // Use better-auth admin plugin to set password
  await auth.api.setPassword({
    body: { newPassword, userId: waiterUser.id },
    headers: c.req.raw.headers,
  } as any)

  log.info('admin:waiter-credentials-regenerated', { waiterId: waiterUser.id, orgId })

  return c.json({
    message: 'New credentials generated. Share these once — they cannot be recovered.',
    credentials: { email: waiterUser.email, password: newPassword },
  })
})

adminRouter.patch('/waiters/:id', requireOrgAdmin, requireActiveSubscription, zv(updateWaiterSchema), async (c) => {
  const orgId = getOrgId(c)

  const assignmentId = c.req.param('id') as string
  const data = c.req.valid('json')

  const [assignment] = await db.select().from(waiterAssignment)
    .where(and(eq(waiterAssignment.id, assignmentId), eq(waiterAssignment.organizationId, orgId)))
    .limit(1)
  if (!assignment) return c.json({ error: 'Waiter assignment not found.' }, 404)

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (data.tableIds !== undefined) updates.tableIds = JSON.stringify(data.tableIds)
  if (data.isActive !== undefined) updates.isActive = data.isActive

  if (data.name !== undefined)
    await db.update(user).set({ name: data.name }).where(eq(user.id, assignment.userId))

  const [updated] = await db
    .update(waiterAssignment)
    .set(updates)
    .where(eq(waiterAssignment.id, assignmentId))
    .returning()

  return c.json({ message: 'Waiter updated.', assignment: updated })
})

adminRouter.delete('/waiters/:id', requireOrgAdmin, requireActiveSubscription, async (c) => {
  const orgId = getOrgId(c)

  const assignmentId = c.req.param('id') as string

  const [assignment] = await db.select().from(waiterAssignment)
    .where(and(eq(waiterAssignment.id, assignmentId), eq(waiterAssignment.organizationId, orgId)))
    .limit(1)
  if (!assignment) return c.json({ error: 'Waiter assignment not found.' }, 404)

  await db.update(waiterAssignment)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(waiterAssignment.id, assignmentId))

  return c.json({ message: 'Waiter deactivated.' })
})

// ─── GET /admin/waiters/:id ───────────────────────────────────────────────────
// Full waiter profile: duty status, assigned tables (with names), covered tables
// and a live order count broken down by status.

adminRouter.get('/waiters/:id', requireOrgAdmin, async (c) => {
  const orgId = getOrgId(c)

  const [profile] = await db.select().from(organizationProfile)
    .where(eq(organizationProfile.organizationId, orgId)).limit(1)
  if (profile?.subscriptionPlan !== 'premium')
    return c.json({ error: 'Waiter management requires the Premium plan.' }, 403)

  const assignmentId = c.req.param('id') as string

  const [row] = await db
    .select({
      id: waiterAssignment.id,
      userId: waiterAssignment.userId,
      tableIds: waiterAssignment.tableIds,
      isActive: waiterAssignment.isActive,
      dutyStatus: waiterAssignment.dutyStatus,
      createdAt: waiterAssignment.createdAt,
      updatedAt: waiterAssignment.updatedAt,
      name: user.name,
      email: user.email,
    })
    .from(waiterAssignment)
    .innerJoin(user, eq(waiterAssignment.userId, user.id))
    .where(and(
      eq(waiterAssignment.id, assignmentId),
      eq(waiterAssignment.organizationId, orgId),
    ))
    .limit(1)

  if (!row) return c.json({ error: 'Waiter not found.' }, 404)

  const tableIds: string[] = JSON.parse(row.tableIds || '[]')

  // Fetch assigned table details
  const tables = tableIds.length > 0
    ? await db
        .select({ id: restaurantTable.id, name: restaurantTable.name, capacity: restaurantTable.capacity, location: restaurantTable.location, isActive: restaurantTable.isActive })
        .from(restaurantTable)
        .where(and(eq(restaurantTable.organizationId, orgId), inArray(restaurantTable.id, tableIds)))
    : []

  // Live order counts per status for this waiter's tables
  const orderCounts = tableIds.length > 0
    ? await db
        .select({ status: order.status, count: count() })
        .from(order)
        .where(and(
          eq(order.organizationId, orgId),
          inArray(order.tableId as any, tableIds),
        ))
        .groupBy(order.status)
    : []

  const orderCountMap = Object.fromEntries(orderCounts.map(r => [r.status, Number(r.count)]))

  return c.json({
    ...row,
    tableIds,
    assignedTables: tables,
    liveOrderCounts: {
      pending:    orderCountMap['pending']    ?? 0,
      confirmed:  orderCountMap['confirmed']  ?? 0,
      preparing:  orderCountMap['preparing']  ?? 0,
      ready:      orderCountMap['ready']      ?? 0,
      served:     orderCountMap['served']     ?? 0,
      cancelled:  orderCountMap['cancelled']  ?? 0,
    },
  })
})

// ─── GET /admin/waiters/:id/orders ────────────────────────────────────────────
// All orders that belong to the waiter's assigned tables.
// Query params:
//   status  — comma-separated filter (default: all)
//   from    — ISO date string, e.g. 2025-01-01
//   to      — ISO date string
//   limit   — max rows, default 100

adminRouter.get('/waiters/:id/orders', requireOrgAdmin, async (c) => {
  const orgId = getOrgId(c)

  const [profile] = await db.select().from(organizationProfile)
    .where(eq(organizationProfile.organizationId, orgId)).limit(1)
  if (profile?.subscriptionPlan !== 'premium')
    return c.json({ error: 'Waiter management requires the Premium plan.' }, 403)

  const assignmentId = c.req.param('id') as string

  const [assignment] = await db.select().from(waiterAssignment)
    .where(and(eq(waiterAssignment.id, assignmentId), eq(waiterAssignment.organizationId, orgId)))
    .limit(1)
  if (!assignment) return c.json({ error: 'Waiter not found.' }, 404)

  const tableIds: string[] = JSON.parse(assignment.tableIds || '[]')
  if (tableIds.length === 0) return c.json([])

  // Parse query params
  const statusParam  = c.req.query('status')
  const fromParam    = c.req.query('from')
  const toParam      = c.req.query('to')
  const limitParam   = parseInt(c.req.query('limit') ?? '100', 10)

  const conditions: any[] = [
    eq(order.organizationId, orgId),
    inArray(order.tableId as any, tableIds),
  ]

  if (statusParam)
    conditions.push(inArray(order.status, statusParam.split(',') as any[]))
  if (fromParam)
    conditions.push(gte(order.createdAt, new Date(fromParam)))
  if (toParam)
    conditions.push(lte(order.createdAt, new Date(toParam)))

  const orders = await db
    .select()
    .from(order)
    .where(and(...conditions as [any, ...any[]]))
    .orderBy(desc(order.createdAt))
    .limit(Math.min(limitParam, 500))

  if (orders.length === 0) return c.json([])

  const orderIds = orders.map(o => o.id)
  const items = await db
    .select()
    .from(orderItem)
    .where(inArray(orderItem.orderId, orderIds))

  const itemsByOrder = items.reduce((acc, item) => {
    ;(acc[item.orderId] ??= []).push(item)
    return acc
  }, {} as Record<string, typeof items>)

  return c.json(orders.map(o => ({
    ...o,
    items: itemsByOrder[o.id] ?? [],
  })))
})

// ─── Security ────────────────────────────────

// Change password
adminRouter.post('/security/change-password', async (c) => {
  const { currentPassword, newPassword } = await c.req.json()

  if (!currentPassword || !newPassword) {
    return c.json({ error: 'Current and new password are required.' }, 400)
  }
  if (newPassword.length < 8) {
    return c.json({ error: 'New password must be at least 8 characters.' }, 400)
  }
  if (currentPassword === newPassword) {
    return c.json({ error: 'New password must be different from current password.' }, 400)
  }

  try {
    await auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: false },
      headers: c.req.raw.headers,
    })
    return c.json({ message: 'Password changed successfully.' })
  } catch (err: any) {
    return c.json({ error: err.message ?? 'Failed to change password. Check your current password.' }, 400)
  }
})

// List active sessions
adminRouter.get('/security/sessions', async (c) => {
  const sessions = await auth.api.listSessions({ headers: c.req.raw.headers })
  return c.json({ sessions: sessions ?? [] })
})

// Revoke a specific session by token
adminRouter.delete('/security/sessions/:token', async (c) => {
  const { token } = c.req.param()
  await auth.api.revokeSession({ body: { token }, headers: c.req.raw.headers })
  return c.json({ message: 'Session revoked.' })
})

// Revoke all other sessions (keep current)
adminRouter.delete('/security/sessions', async (c) => {
  await auth.api.revokeOtherSessions({ headers: c.req.raw.headers })
  return c.json({ message: 'All other sessions revoked.' })
})

export { adminRouter }
