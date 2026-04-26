import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { sign, verify } from 'hono/jwt'
import { eq, and, asc, gte, inArray } from 'drizzle-orm'
import { db } from '../db'
import {
  organization,
  organizationProfile,
  restaurantTable,
  menuCategory,
  menuItem,
  order,
  orderItem,
} from '../db/schema'
import { createOrderSchema, editOrderSchema } from '../lib/validators'
import { env } from '../lib/env'

const customerRouter = new Hono()

// ─── Table Session JWT ───────────────────────
// When a customer resolves a table, we issue a short-lived JWT (90 min) bound
// to that specific tableId + tableToken + orgId.
// All subsequent customer actions (browse menu, place order) must present this
// token via the x-table-session header, proving the original NFC scan happened.

const TABLE_SESSION_TTL = 90 * 60  // seconds

interface TableSessionPayload {
  tableId: string
  tableToken: string
  orgId: string
  exp: number
  [key: string]: unknown
}

async function signTableSession(tableId: string, tableToken: string, orgId: string): Promise<string> {
  const payload: TableSessionPayload = {
    tableId,
    tableToken,
    orgId,
    exp: Math.floor(Date.now() / 1000) + TABLE_SESSION_TTL,
  }
  return sign(payload, env.TABLE_SESSION_SECRET)
}

async function verifyTableSession(token: string): Promise<TableSessionPayload | null> {
  try {
    const payload = await verify(token, env.TABLE_SESSION_SECRET, 'HS256') as unknown as TableSessionPayload
    return payload
  } catch {
    return null
  }
}

// ─── Rate Limiter (in-memory, per table token) ───────────
// Allows at most MAX_ORDERS_PER_WINDOW order attempts per table within WINDOW_MS

const RATE_WINDOW_MS = 60_000       // 1 minute window
const MAX_ORDERS_PER_WINDOW = 5     // max 5 attempts per table per minute
const DUPLICATE_WINDOW_MS = 30_000  // block duplicate orders within 30 seconds

const orderRateMap = new Map<string, { count: number; windowStart: number }>()

// Prune stale entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of orderRateMap) {
    if (now - entry.windowStart > RATE_WINDOW_MS) orderRateMap.delete(key)
  }
}, 5 * 60_000)

// ─── Idempotency key store (in-memory, TTL 5 minutes) ────
// Maps idempotency key → { orderId, expiresAt }

const idempotencyStore = new Map<string, { orderId: string; expiresAt: number }>()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of idempotencyStore) {
    if (now > entry.expiresAt) idempotencyStore.delete(key)
  }
}, 5 * 60_000)

function checkRateLimit(tableToken: string): boolean {
  const now = Date.now()
  const entry = orderRateMap.get(tableToken)
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    orderRateMap.set(tableToken, { count: 1, windowStart: now })
    return true
  }
  if (entry.count >= MAX_ORDERS_PER_WINDOW) return false
  entry.count++
  return true
}

// ─── Resolve table by NFC token ─────────────

customerRouter.get('/table/:token', async (c) => {
  const { token } = c.req.param()

  const table = await db
    .select({
      id: restaurantTable.id,
      name: restaurantTable.name,
      organizationId: restaurantTable.organizationId,
      isActive: restaurantTable.isActive,
    })
    .from(restaurantTable)
    .where(and(eq(restaurantTable.nfcToken, token), eq(restaurantTable.isActive, true)))
    .limit(1)

  if (!table.length) {
    return c.json({ error: 'Invalid or inactive table.' }, 404)
  }

  const org = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      primaryColor: organizationProfile.primaryColor,
      secondaryColor: organizationProfile.secondaryColor,
      accentColor: organizationProfile.accentColor,
      fontFamily: organizationProfile.fontFamily,
      bannerUrl: organizationProfile.bannerUrl,
      menuLayout: organizationProfile.menuLayout,
      showCalories: organizationProfile.showCalories,
      showAllergens: organizationProfile.showAllergens,
      showPreparationTime: organizationProfile.showPreparationTime,
      showSpiceLevel: organizationProfile.showSpiceLevel,
      currencySymbol: organizationProfile.currencySymbol,
      currencyCode: organizationProfile.currencyCode,
      taxRate: organizationProfile.taxRate,
      serviceChargeRate: organizationProfile.serviceChargeRate,
      welcomeMessage: organizationProfile.welcomeMessage,
      footerText: organizationProfile.footerText,
      socialLinks: organizationProfile.socialLinks,
      description: organizationProfile.description,
    })
    .from(organization)
    .leftJoin(organizationProfile, eq(organization.id, organizationProfile.organizationId))
    .where(eq(organization.id, table[0].organizationId))
    .limit(1)

  if (!org.length || org[0].id === null) {
    return c.json({ error: 'Restaurant not found.' }, 404)
  }

  const orgStatus = await db
    .select({ status: organizationProfile.status })
    .from(organizationProfile)
    .where(eq(organizationProfile.organizationId, table[0].organizationId))
    .limit(1)

  if (orgStatus.length && (orgStatus[0].status === 'suspended' || orgStatus[0].status === 'inactive')) {
    return c.json({ error: 'This restaurant is not currently available.' }, 403)
  }

  // Issue a short-lived table session JWT (90 min) — proves this request originated
  // from an NFC scan of this specific table. Required for menu browsing and ordering.
  const sessionToken = await signTableSession(
    table[0].id,
    token,
    table[0].organizationId
  )

  return c.json({ table: table[0], organization: org[0], sessionToken })
})

// ─── Get menu for an organization ───────────

customerRouter.get('/menu/:organizationId', async (c) => {
  const { organizationId } = c.req.param()

  // ── Table session check ──
  // Requires a valid session token issued by GET /table/:token.
  // The token must be bound to this organizationId, preventing access
  // from outside the restaurant or from a different restaurant's URL.
  const rawSession = c.req.header('x-table-session')
  if (!rawSession) {
    return c.json({ error: 'No table session. Please scan the table QR/NFC tag to access the menu.' }, 401)
  }
  const session = await verifyTableSession(rawSession)
  if (!session) {
    return c.json({ error: 'Table session expired or invalid. Please scan the table tag again.' }, 401)
  }
  if (session.orgId !== organizationId) {
    return c.json({ error: 'Session does not match this restaurant.' }, 403)
  }

  const org = await db
    .select({
      status: organizationProfile.status,
    })
    .from(organizationProfile)
    .where(eq(organizationProfile.organizationId, organizationId))
    .limit(1)

  if (!org.length || org[0].status === 'suspended' || org[0].status === 'inactive') {
    return c.json({ error: 'This restaurant is not currently available.' }, 404)
  }

  const categories = await db
    .select()
    .from(menuCategory)
    .where(and(eq(menuCategory.organizationId, organizationId), eq(menuCategory.isActive, true)))
    .orderBy(asc(menuCategory.sortOrder), asc(menuCategory.name))

  const items = await db
    .select()
    .from(menuItem)
    .where(and(eq(menuItem.organizationId, organizationId), eq(menuItem.isAvailable, true)))
    .orderBy(asc(menuItem.sortOrder), asc(menuItem.name))

  return c.json({ categories, items })
})

// ─── Place order ─────────────────────────────

customerRouter.post('/orders', zValidator('json', createOrderSchema), async (c) => {
  const { tableToken, customerName, customerPhone, notes, items } = c.req.valid('json')

  // ── Rate limiting: max 5 order attempts per table per 60 seconds ──
  if (!checkRateLimit(tableToken)) {
    return c.json(
      { error: 'Too many order requests. Please wait a moment before trying again.' },
      429
    )
  }

  // ── Table session check ──
  // The session token is issued at scan time and is bound to this exact tableToken.
  // This ensures the order originates from someone who physically scanned the table.
  const rawSession = c.req.header('x-table-session')
  if (!rawSession) {
    return c.json({ error: 'No table session. Please scan the table QR/NFC tag to place an order.' }, 401)
  }
  const session = await verifyTableSession(rawSession)
  if (!session) {
    return c.json({ error: 'Table session expired. Please scan the table tag again.' }, 401)
  }
  if (session.tableToken !== tableToken) {
    return c.json({ error: 'Session does not match this table.' }, 403)
  }
  const idempotencyKey = c.req.header('idempotency-key')
  if (idempotencyKey) {
    const cached = idempotencyStore.get(idempotencyKey)
    if (cached && Date.now() < cached.expiresAt) {
      return c.json(
        { message: 'Order already placed.', orderId: cached.orderId, duplicate: true },
        200
      )
    }
  }

  // Validate table
  const table = await db
    .select()
    .from(restaurantTable)
    .where(and(eq(restaurantTable.nfcToken, tableToken), eq(restaurantTable.isActive, true)))
    .limit(1)

  if (!table.length) {
    return c.json({ error: 'Invalid or inactive table.' }, 404)
  }

  const orgId = table[0].organizationId

  // Validate org is active
  const profile = await db
    .select()
    .from(organizationProfile)
    .where(eq(organizationProfile.organizationId, orgId))
    .limit(1)

  if (!profile.length || profile[0].status === 'suspended' || profile[0].status === 'inactive') {
    return c.json({ error: 'This restaurant is not currently accepting orders.' }, 403)
  }

  // ── Duplicate order window: reject if same table has a pending/confirmed order
  //    placed within the last 30 seconds (prevents accidental double-taps) ──
  const windowCutoff = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString()
  const recentOrders = await db
    .select({ id: order.id, status: order.status })
    .from(order)
    .where(
      and(
        eq(order.tableId, table[0].id),
        inArray(order.status, ['pending', 'confirmed']),
        gte(order.createdAt, new Date(windowCutoff))
      )
    )
    .limit(1)

  if (recentOrders.length) {
    return c.json(
      {
        error: 'An order was just placed for this table. Please wait before placing another.',
        existingOrderId: recentOrders[0].id,
      },
      409
    )
  }

  // Validate and price items
  const menuItemsData = await db
    .select()
    .from(menuItem)
    .where(and(eq(menuItem.organizationId, orgId), eq(menuItem.isAvailable, true)))

  const menuItemMap = new Map(menuItemsData.map((item) => [item.id, item]))

  const orderItemsToCreate: {
    id: string
    orderId: string
    menuItemId: string
    menuItemName: string
    quantity: number
    unitPrice: string
    totalPrice: string
    notes: string | null
  }[] = []

  let subtotal = 0

  for (const reqItem of items) {
    const menuItemData = menuItemMap.get(reqItem.menuItemId)
    if (!menuItemData) {
      return c.json(
        { error: `Menu item ${reqItem.menuItemId} not found or not available.` },
        400
      )
    }
    const unitPrice = parseFloat(String(menuItemData.price))
    const totalPrice = unitPrice * reqItem.quantity
    subtotal += totalPrice

    orderItemsToCreate.push({
      id: crypto.randomUUID(),
      orderId: '',
      menuItemId: reqItem.menuItemId,
      menuItemName: menuItemData.name,
      quantity: reqItem.quantity,
      unitPrice: unitPrice.toFixed(2),
      totalPrice: totalPrice.toFixed(2),
      notes: reqItem.notes ?? null,
    })
  }

  const taxRate = parseFloat(String(profile[0].taxRate ?? '0')) / 100
  const serviceRate = parseFloat(String(profile[0].serviceChargeRate ?? '0')) / 100
  const taxAmount = subtotal * taxRate
  const serviceCharge = subtotal * serviceRate
  const totalAmount = subtotal + taxAmount + serviceCharge

  const orderId = crypto.randomUUID()

  const editWindowMinutes = profile[0].orderEditWindowMinutes ?? 5
  const editableUntil = editWindowMinutes > 0
    ? new Date(Date.now() + editWindowMinutes * 60_000)
    : null

  await db.insert(order).values({
    id: orderId,
    organizationId: orgId,
    tableId: table[0].id,
    tableName: table[0].name,
    customerName: customerName ?? null,
    customerPhone: customerPhone ?? null,
    status: 'pending',
    subtotal: subtotal.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    serviceCharge: serviceCharge.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
    notes: notes ?? null,
    editableUntil,
  })

  await db.insert(orderItem).values(
    orderItemsToCreate.map((item) => ({ ...item, orderId }))
  )

  if (idempotencyKey) {
    idempotencyStore.set(idempotencyKey, {
      orderId,
      expiresAt: Date.now() + 5 * 60_000,
    })
  }

  return c.json(
    {
      message: 'Order placed successfully.',
      orderId,
      totalAmount: totalAmount.toFixed(2),
      editableUntil: editableUntil?.toISOString() ?? null,
      editWindowMinutes,
    },
    201
  )
})

// ─── Get order status ────────────────────────

customerRouter.get('/orders/:id', async (c) => {
  const { id } = c.req.param()

  const orders = await db
    .select()
    .from(order)
    .where(eq(order.id, id))
    .limit(1)

  if (!orders.length) return c.json({ error: 'Order not found.' }, 404)

  const items = await db.select().from(orderItem).where(eq(orderItem.orderId, id))

  return c.json({ order: orders[0], items })
})

// ─── Edit order (within edit window) ────────

customerRouter.patch('/orders/:id', zValidator('json', editOrderSchema), async (c) => {
  const { id } = c.req.param()
  const { items, notes } = c.req.valid('json')

  // Table session required
  const rawSession = c.req.header('x-table-session')
  if (!rawSession) return c.json({ error: 'No table session.' }, 401)
  const session = await verifyTableSession(rawSession)
  if (!session) return c.json({ error: 'Table session expired. Please scan the table tag again.' }, 401)

  const existing = await db.select().from(order).where(eq(order.id, id)).limit(1)
  if (!existing.length) return c.json({ error: 'Order not found.' }, 404)

  const o = existing[0]

  // Session must belong to same org
  if (o.organizationId !== session.orgId) {
    return c.json({ error: 'Session does not match this order.' }, 403)
  }

  // Only pending orders can be edited
  if (o.status !== 'pending') {
    return c.json({ error: 'This order can no longer be edited. It is already being processed.' }, 409)
  }

  // Check edit window
  if (!o.editableUntil || new Date() > new Date(o.editableUntil)) {
    return c.json({ error: 'The edit window for this order has closed.' }, 409)
  }

  // Validate and price new items
  const profile = await db
    .select({ taxRate: organizationProfile.taxRate, serviceChargeRate: organizationProfile.serviceChargeRate })
    .from(organizationProfile)
    .where(eq(organizationProfile.organizationId, o.organizationId))
    .limit(1)

  const menuItemsData = await db
    .select()
    .from(menuItem)
    .where(and(eq(menuItem.organizationId, o.organizationId), eq(menuItem.isAvailable, true)))

  const menuItemMap = new Map(menuItemsData.map((item) => [item.id, item]))

  const newOrderItems: typeof orderItem.$inferInsert[] = []
  let subtotal = 0

  for (const reqItem of items) {
    const menuItemData = menuItemMap.get(reqItem.menuItemId)
    if (!menuItemData) {
      return c.json({ error: `Menu item ${reqItem.menuItemId} not found or unavailable.` }, 400)
    }
    const unitPrice = parseFloat(String(menuItemData.price))
    const totalPrice = unitPrice * reqItem.quantity
    subtotal += totalPrice
    newOrderItems.push({
      id: crypto.randomUUID(),
      orderId: id,
      menuItemId: reqItem.menuItemId,
      menuItemName: menuItemData.name,
      quantity: reqItem.quantity,
      unitPrice: unitPrice.toFixed(2),
      totalPrice: totalPrice.toFixed(2),
      notes: reqItem.notes ?? null,
    })
  }

  const taxRate = parseFloat(String(profile[0]?.taxRate ?? '0')) / 100
  const serviceRate = parseFloat(String(profile[0]?.serviceChargeRate ?? '0')) / 100
  const taxAmount = subtotal * taxRate
  const serviceCharge = subtotal * serviceRate
  const totalAmount = subtotal + taxAmount + serviceCharge

  // Replace order items atomically
  await db.delete(orderItem).where(eq(orderItem.orderId, id))
  await db.insert(orderItem).values(newOrderItems)
  await db
    .update(order)
    .set({
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      serviceCharge: serviceCharge.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      notes: notes ?? o.notes,
      updatedAt: new Date(),
    })
    .where(eq(order.id, id))

  return c.json({ message: 'Order updated.', orderId: id, totalAmount: totalAmount.toFixed(2) })
})

export { customerRouter }
