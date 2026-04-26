import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and, desc, asc, gte, lte, sql, sum, count, avg } from 'drizzle-orm'
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
} from '../db/schema'
import { requireOrgAdmin } from '../middleware/auth-middleware'
import { auth } from '../lib/auth'
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
} from '../lib/validators'

const adminRouter = new Hono()

// ─── Register admin + org ────────────────────

adminRouter.post('/register', zValidator('json', registerAdminSchema), async (c) => {
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

    return c.json(
      { message: 'Account and organization created.', organizationId: orgId },
      201
    )
  } catch (err: any) {
    return c.json({ error: err.message ?? 'Registration failed.' }, 400)
  }
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
  zValidator('json', updateOrganizationProfileSchema),
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

    await db
      .update(organizationProfile)
      .set({ ...data, updatedAt: new Date() })
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
  zValidator('json', createMenuCategorySchema),
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
  zValidator('json', updateMenuCategorySchema),
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

adminRouter.post('/menu', zValidator('json', createMenuItemSchema), async (c) => {
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
  await db.insert(menuItem).values({
    id,
    organizationId: orgId,
    price: String(data.price),
    ...data,
  })

  const created = await db.select().from(menuItem).where(eq(menuItem.id, id)).limit(1)

  return c.json({ item: created[0] }, 201)
})

adminRouter.patch('/menu/:id', zValidator('json', updateMenuItemSchema), async (c) => {
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

adminRouter.post('/tables', zValidator('json', createRestaurantTableSchema), async (c) => {
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

adminRouter.patch('/tables/:id', zValidator('json', updateRestaurantTableSchema), async (c) => {
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

// ─── Orders ──────────────────────────────────

adminRouter.get('/orders', async (c) => {
  const orgId = getOrgId(c)
  const status = c.req.query('status')

  const conditions = [eq(order.organizationId, orgId)]
  if (status) {
    conditions.push(eq(order.status, status as any))
  }

  const orders = await db
    .select()
    .from(order)
    .where(and(...conditions))
    .orderBy(desc(order.createdAt))
    .limit(100)

  return c.json({ orders })
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
  zValidator('json', updateOrderStatusSchema),
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

adminRouter.get('/analytics', zValidator('query', analyticsQuerySchema), async (c) => {
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

  const [summary] = await db
    .select({
      totalOrders: count(),
      totalRevenue: sum(order.totalAmount),
      avgOrderValue: avg(order.totalAmount),
    })
    .from(order)
    .where(and(...baseConditions))

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
      hour: sql<number>`EXTRACT(HOUR FROM ${order.createdAt})`,
      orders: count(),
    })
    .from(order)
    .where(and(...baseConditions))
    .groupBy(sql`EXTRACT(HOUR FROM ${order.createdAt})`)
    .orderBy(sql`EXTRACT(HOUR FROM ${order.createdAt})`)

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

export { adminRouter }
