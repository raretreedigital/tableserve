import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and, inArray, ne, desc } from 'drizzle-orm'
import { db } from '../db'
import {
  waiterAssignment,
  restaurantTable,
  order,
  orderItem,
  menuItem,
  organization,
  organizationProfile,
  user,
} from '../db/schema'
import { auth } from '../lib/auth'
import { updateOrderStatusSchema, editOrderSchema, updateWaiterDutyStatusSchema } from '../lib/validators'
import { log } from '../lib/logger'

type WaiterVars = {
  waiterUser: any
  waiterAssignment: typeof waiterAssignment.$inferSelect
}

const waiterRouter = new Hono<{ Variables: WaiterVars }>()

// ─── Middleware: require active waiter ────────────────────────────────────────

async function requireWaiter(c: any, next: () => Promise<void>) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) return c.json({ error: 'Unauthorized.' }, 401)

  const u = session.user as any
  if (u.role !== 'waiter') return c.json({ error: 'Forbidden. Waiter access only.' }, 403)

  const [assignment] = await db
    .select()
    .from(waiterAssignment)
    .where(and(
      eq(waiterAssignment.userId, u.id),
      eq(waiterAssignment.isActive, true),
    ))
    .limit(1)

  if (!assignment) return c.json({ error: 'No active waiter assignment found.' }, 403)

  c.set('waiterUser', u)
  c.set('waiterAssignment', assignment)
  await next()
}

// ─── Helper: compute effective table IDs ──────────────────────────────────────
// Returns the waiter's own tables PLUS tables belonging to on_leave colleagues.
// This is the auto-cover mechanic — going on leave automatically redistributes
// your tables to all on_duty waiters in the same org.

async function effectiveTableIds(assignment: typeof waiterAssignment.$inferSelect): Promise<string[]> {
  const myTableIds: string[] = JSON.parse(assignment.tableIds || '[]')

  // Only on_duty waiters cover others
  if ((assignment as any).dutyStatus !== 'on_duty') return myTableIds

  const onLeaveAssignments = await db
    .select({ tableIds: waiterAssignment.tableIds })
    .from(waiterAssignment)
    .where(and(
      eq(waiterAssignment.organizationId, assignment.organizationId),
      eq(waiterAssignment.isActive, true),
      eq(waiterAssignment.dutyStatus as any, 'on_leave'),
      ne(waiterAssignment.userId, assignment.userId),
    ))

  const coveredIds: string[] = onLeaveAssignments.flatMap(a =>
    JSON.parse(a.tableIds || '[]') as string[]
  )

  return [...new Set([...myTableIds, ...coveredIds])]
}

// ─── GET /waiter/me ───────────────────────────────────────────────────────────

waiterRouter.get('/me', requireWaiter, async (c) => {
  const u = c.get('waiterUser') as typeof user.$inferSelect & { role: string }
  const assignment = c.get('waiterAssignment') as typeof waiterAssignment.$inferSelect

  const myTableIds: string[] = JSON.parse(assignment.tableIds || '[]')
  const allTableIds = await effectiveTableIds(assignment)

  const [tables, org] = await Promise.all([
    myTableIds.length > 0
      ? db.select().from(restaurantTable).where(inArray(restaurantTable.id, myTableIds))
      : Promise.resolve([] as (typeof restaurantTable.$inferSelect)[]),
    db
      .select({ id: organization.id, name: organization.name })
      .from(organization)
      .where(eq(organization.id, assignment.organizationId))
      .limit(1),
  ])

  const coveredTableIds = allTableIds.filter(id => !myTableIds.includes(id))
  const coveredTables = coveredTableIds.length > 0
    ? await db.select().from(restaurantTable).where(inArray(restaurantTable.id, coveredTableIds))
    : []

  return c.json({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    assignment: {
      id: assignment.id,
      organizationId: assignment.organizationId,
      organizationName: org[0]?.name ?? null,
      tableIds: myTableIds,
      isActive: assignment.isActive,
      dutyStatus: (assignment as any).dutyStatus ?? 'on_duty',
    },
    assignedTables: tables,
    coveredTables, // tables from on-leave colleagues currently being auto-covered
  })
})

// ─── PATCH /waiter/me/duty-status ─────────────────────────────────────────────
// Waiter toggles own availability from the mobile app.
// on_leave  → tables automatically appear for all other on_duty waiters.
// on_duty   → tables return to normal assignment.
// off_shift → treated same as on_leave for coverage purposes.
//
// This is the ONLY self-service mutation allowed — waiters cannot change their
// name, email, or password from the app.

waiterRouter.patch(
  '/me/duty-status',
  requireWaiter,
  zValidator('json', updateWaiterDutyStatusSchema),
  async (c) => {
    const assignment = c.get('waiterAssignment') as typeof waiterAssignment.$inferSelect
    const u = c.get('waiterUser') as any
    const { dutyStatus } = c.req.valid('json')

    await db
      .update(waiterAssignment)
      .set({ dutyStatus: dutyStatus as any, updatedAt: new Date() })
      .where(eq(waiterAssignment.id, assignment.id))

    log.info('waiter:duty-status', { waiterId: u.id, dutyStatus })

    return c.json({
      message: `Duty status updated to ${dutyStatus}.`,
      dutyStatus,
      autoAssignActive: dutyStatus !== 'on_duty',
    })
  },
)

// ─── GET /waiter/tables ───────────────────────────────────────────────────────

waiterRouter.get('/tables', requireWaiter, async (c) => {
  const assignment = c.get('waiterAssignment') as typeof waiterAssignment.$inferSelect
  const tableIds = await effectiveTableIds(assignment)
  const myTableIds: string[] = JSON.parse(assignment.tableIds || '[]')

  if (tableIds.length === 0) return c.json([])

  const tables = await db
    .select()
    .from(restaurantTable)
    .where(and(
      inArray(restaurantTable.id, tableIds),
      eq(restaurantTable.isActive, true),
    ))
    .orderBy(restaurantTable.name)

  return c.json(tables.map(t => ({
    ...t,
    isCovered: !myTableIds.includes(t.id), // true = covering a colleague's table
  })))
})

// ─── GET /waiter/orders ───────────────────────────────────────────────────────

waiterRouter.get('/orders', requireWaiter, async (c) => {
  const assignment = c.get('waiterAssignment') as typeof waiterAssignment.$inferSelect
  const tableIds = await effectiveTableIds(assignment)
  const myTableIds: string[] = JSON.parse(assignment.tableIds || '[]')

  const statusParam = c.req.query('status')
  const statuses = (statusParam
    ? statusParam.split(',')
    : ['pending', 'confirmed', 'preparing', 'ready']) as any[]

  const conditions = [
    eq(order.organizationId, assignment.organizationId),
    inArray(order.status, statuses),
    ...(tableIds.length > 0 ? [inArray(order.tableId as any, tableIds)] : []),
  ]

  const orders = await db
    .select()
    .from(order)
    .where(and(...conditions as [any, ...any[]]))
    .orderBy(desc(order.createdAt))
    .limit(200)

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
    isAutoAssigned: o.tableId ? !myTableIds.includes(o.tableId) : false,
  })))
})

// ─── GET /waiter/orders/:id ───────────────────────────────────────────────────

waiterRouter.get('/orders/:id', requireWaiter, async (c) => {
  const assignment = c.get('waiterAssignment') as typeof waiterAssignment.$inferSelect
  const orderId = c.req.param('id')

  const [o] = await db
    .select()
    .from(order)
    .where(and(
      eq(order.id, orderId),
      eq(order.organizationId, assignment.organizationId),
    ))
    .limit(1)

  if (!o) return c.json({ error: 'Order not found.' }, 404)

  const [items, table] = await Promise.all([
    db.select().from(orderItem).where(eq(orderItem.orderId, orderId)),
    o.tableId
      ? db.select().from(restaurantTable).where(eq(restaurantTable.id, o.tableId)).limit(1)
      : Promise.resolve([] as (typeof restaurantTable.$inferSelect)[]),
  ])

  return c.json({ ...o, items, table: table[0] ?? null })
})

// ─── PATCH /waiter/orders/:id/status ─────────────────────────────────────────

waiterRouter.patch(
  '/orders/:id/status',
  requireWaiter,
  zValidator('json', updateOrderStatusSchema),
  async (c) => {
    const assignment = c.get('waiterAssignment') as typeof waiterAssignment.$inferSelect
    const u = c.get('waiterUser') as any
    const orderId = c.req.param('id')
    const { status } = c.req.valid('json')

    const [o] = await db
      .select()
      .from(order)
      .where(and(
        eq(order.id, orderId),
        eq(order.organizationId, assignment.organizationId),
      ))
      .limit(1)

    if (!o) return c.json({ error: 'Order not found.' }, 404)
    if (o.status === 'cancelled') return c.json({ error: 'Cannot update a cancelled order.' }, 400)

    const [updated] = await db
      .update(order)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(order.id, orderId))
      .returning()

    log.info('waiter:status-update', { orderId, from: o.status, to: status, waiterId: u.id })

    return c.json({ message: 'Status updated.', order: updated })
  },
)

// ─── PATCH /waiter/orders/:id ─────────────────────────────────────────────────

waiterRouter.patch(
  '/orders/:id',
  requireWaiter,
  zValidator('json', editOrderSchema),
  async (c) => {
    const assignment = c.get('waiterAssignment') as typeof waiterAssignment.$inferSelect
    const u = c.get('waiterUser') as any
    const orderId = c.req.param('id')
    const data = c.req.valid('json')

    const [o] = await db
      .select()
      .from(order)
      .where(and(
        eq(order.id, orderId),
        eq(order.organizationId, assignment.organizationId),
      ))
      .limit(1)

    if (!o) return c.json({ error: 'Order not found.' }, 404)
    if (!['pending', 'confirmed'].includes(o.status))
      return c.json({ error: 'Order cannot be edited once preparing has started.' }, 400)

    const menuItemIds = data.items.map((i: any) => i.menuItemId)
    const menuItems = await db
      .select()
      .from(menuItem)
      .where(and(
        inArray(menuItem.id, menuItemIds),
        eq(menuItem.organizationId, assignment.organizationId),
        eq(menuItem.isAvailable, true),
      ))

    if (menuItems.length !== menuItemIds.length)
      return c.json({ error: 'One or more menu items are unavailable.' }, 400)

    const menuItemMap = Object.fromEntries(menuItems.map(m => [m.id, m]))

    const [profile] = await db
      .select({ taxRate: organizationProfile.taxRate, serviceChargeRate: organizationProfile.serviceChargeRate })
      .from(organizationProfile)
      .where(eq(organizationProfile.organizationId, assignment.organizationId))
      .limit(1)

    const taxRate = parseFloat(profile?.taxRate ?? '0') / 100
    const serviceRate = parseFloat(profile?.serviceChargeRate ?? '0') / 100
    const subtotal = data.items.reduce((s: number, i: any) =>
      s + parseFloat(menuItemMap[i.menuItemId].price) * i.quantity, 0)
    const taxAmount = subtotal * taxRate
    const serviceCharge = subtotal * serviceRate
    const totalAmount = subtotal + taxAmount + serviceCharge

    await db.delete(orderItem).where(eq(orderItem.orderId, orderId))
    await db.insert(orderItem).values(
      data.items.map((i: any) => ({
        id: crypto.randomUUID(),
        orderId,
        menuItemId: i.menuItemId,
        menuItemName: menuItemMap[i.menuItemId].name,
        quantity: i.quantity,
        unitPrice: String(parseFloat(menuItemMap[i.menuItemId].price)),
        totalPrice: String(parseFloat(menuItemMap[i.menuItemId].price) * i.quantity),
        notes: i.notes ?? null,
      })),
    )

    const [updated] = await db
      .update(order)
      .set({
        subtotal: String(subtotal),
        taxAmount: String(taxAmount),
        serviceCharge: String(serviceCharge),
        totalAmount: String(totalAmount),
        notes: data.notes ?? o.notes,
        updatedAt: new Date(),
      })
      .where(eq(order.id, orderId))
      .returning()

    log.info('waiter:order-edit', { orderId, waiterId: u.id })

    return c.json({ message: 'Order updated.', orderId: updated.id, totalAmount: updated.totalAmount })
  },
)

export { waiterRouter }

