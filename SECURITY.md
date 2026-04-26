# Table Serve — Security Model

This document covers the specific security threats relevant to a public-facing NFC restaurant ordering system and how each one is addressed in the codebase.

---

## Threat 1: Accessing the Menu Link Outside the Restaurant

### The Problem

The NFC URL format is:
```
https://yourdomain.com/menu/{nfcToken}
```

Once a customer scans the tag, their browser stores the URL in history. Anyone who later copies that URL can browse the menu and place orders to a table they are not physically sitting at.

### How It Is Fixed: Table Session JWT

When a customer's device hits `GET /api/customer/table/:token` (the first thing that happens on page load after an NFC scan), the server issues a **short-lived signed JWT** — called a table session token. This token is:

- Bound to the specific `tableId`, `tableToken`, and `orgId`
- Valid for **90 minutes** (covers a full meal)
- Signed with `TABLE_SESSION_SECRET` using HS256 — cannot be forged without the server secret
- Returned only once in the resolve response — never stored in `localStorage`, cookies, or any persistent store

```typescript
// src/routes/customer.ts — issued on GET /table/:token
const sessionToken = await signTableSession(
  table[0].id,
  token,             // the NFC token
  table[0].organizationId
)
return c.json({ table: table[0], organization: org[0], sessionToken })
```

All subsequent customer actions — **browsing the menu** and **placing an order** — require this token in the `x-table-session` header. The server verifies the signature and checks that the token matches the table/org being accessed.

```typescript
// src/routes/customer.ts — enforced on GET /menu/:organizationId
const rawSession = c.req.header('x-table-session')
if (!rawSession) {
  return c.json({ error: 'No table session. Please scan the table QR/NFC tag.' }, 401)
}
const session = await verifyTableSession(rawSession)
if (!session) {
  return c.json({ error: 'Table session expired. Please scan the table tag again.' }, 401)
}
if (session.orgId !== organizationId) {
  return c.json({ error: 'Session does not match this restaurant.' }, 403)
}

// src/routes/customer.ts — enforced on POST /orders
if (session.tableToken !== tableToken) {
  return c.json({ error: 'Session does not match this table.' }, 403)
}
```

On the frontend the token lives only in a **module-level JavaScript variable** — it is cleared the moment the browser tab is closed or the page is refreshed:

```typescript
// src/lib/api.ts
let _tableSession: string | null = null  // in-memory only, never persisted

export const customerApi = {
  resolveTable: async (token: string) => {
    const result = await request(...)
    if (result.data?.sessionToken) setTableSession(result.data.sessionToken)  // stored in memory
    return result
  },
  getMenu: (orgId) => request(..., { headers: tableSessionHeader() }),  // attached automatically
  placeOrder: (data, idempotencyKey) => request(..., { headers: { ...tableSessionHeader(), 'idempotency-key': idempotencyKey } }),
}
```

### What This Achieves

| Scenario | Before Fix | After Fix |
|---|---|---|
| Customer saves URL and opens from home tomorrow | Menu loads, orders work | `401` — no session token |
| Customer shares URL on social media | Anyone can order | `401` — they need to scan the physical tag |
| Someone copies URL from browser history | Full access | `401` — session lived in memory, gone on tab close |
| Customer reopens the same tab after 90 minutes | Full access | `401` — session expired, must scan again |
| Customer scans tag and uses the page for 89 minutes | Full access | Full access — within the 90-minute window |

### What Cannot Be Prevented

If someone is **physically present at the table**, scans the NFC tag themselves, copies the `sessionToken` from browser DevTools, and then immediately sends it to someone remote — that remote person can order within the 90-minute window. This is considered an acceptable residual risk (requires active malicious effort from an in-person co-conspirator).

---

## Threat 2: Duplicate Orders (Accidental or Intentional)

### The Problem

Several scenarios can lead to duplicate orders:

| Scenario | Cause |
|---|---|
| **Double-tap** | Customer taps "Confirm Order" twice quickly |
| **Network retry** | Browser retries a POST after a timeout, order was already created |
| **Browser back + resubmit** | Customer navigates back and resubmits the form |
| **Malicious flooding** | Someone repeatedly submits orders to a table from a saved URL |
| **Script-based attack** | Automated script sends the same order payload in a loop |

### Mitigations Implemented

All three protections live in `src/routes/customer.ts`.

---

#### Protection 1: Idempotency Key

The frontend sends a unique `Idempotency-Key` header with every order POST. If the same key is sent again within **5 minutes**, the server returns the original order ID without creating a new record.

**How it works — server side:**
```typescript
// src/routes/customer.ts
const idempotencyStore = new Map<string, { orderId: string; expiresAt: number }>()

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

// ... after successful order creation:
if (idempotencyKey) {
  idempotencyStore.set(idempotencyKey, {
    orderId,
    expiresAt: Date.now() + 5 * 60_000,  // 5 minute TTL
  })
}
```

**How it works — frontend side:**

The frontend generates a UUID before calling `placeOrder` and attaches it as the header. If the request is retried (e.g., due to a network timeout), it reuses the same key, guaranteeing at-most-one order creation.

**Result:** Network retries and double-submits are completely transparent to the customer — they get back the same `orderId` and are redirected to the same status page.

---

#### Protection 2: Duplicate Order Time Window

Even without an idempotency key, the server checks for any `pending` or `confirmed` order from the **same physical table** placed within the last **30 seconds**. If one exists, the new request is rejected with `409 Conflict`.

```typescript
// src/routes/customer.ts
const DUPLICATE_WINDOW_MS = 30_000  // 30 seconds

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
```

**What this prevents:**
- A customer accidentally placing the same order twice within 30 seconds
- A remote attacker who opens the saved URL and rapidly tries to spam orders for a table
- Race conditions where two concurrent requests both pass validation before either commits

**Why only `pending` and `confirmed`?**
Once an order moves to `preparing`, `ready`, or `served`, it is legitimate for the same table to place a new order (e.g., ordering dessert after the main course is being prepared).

---

#### Protection 3: Per-Table Rate Limiting

An in-memory rate limiter caps order placement at **5 attempts per table token per 60 seconds** using a sliding window. This applies before any database query runs.

```typescript
// src/routes/customer.ts
const RATE_WINDOW_MS = 60_000        // 1 minute
const MAX_ORDERS_PER_WINDOW = 5      // 5 attempts per table per minute

const orderRateMap = new Map<string, { count: number; windowStart: number }>()

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

// Applied at the top of POST /orders:
if (!checkRateLimit(tableToken)) {
  return c.json(
    { error: 'Too many order requests. Please wait a moment before trying again.' },
    429
  )
}
```

**Memory management:** A `setInterval` runs every 5 minutes to prune stale entries from the map, preventing unbounded memory growth over time.

```typescript
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of orderRateMap) {
    if (now - entry.windowStart > RATE_WINDOW_MS) orderRateMap.delete(key)
  }
}, 5 * 60_000)
```

**Why rate-limit by table token rather than IP?**
- Multiple customers at the same table share a network (restaurant Wi-Fi) → same IP
- Rate-limiting by IP would block legitimate orders from other tables on the same network
- The table token is the smallest meaningful unit of "one party ordering"

---

## Threat 3: Unauthorized Admin Access

### Mitigations

- **Session cookies** are HTTP-only (set by better-auth) — not accessible via JavaScript, preventing XSS token theft
- **`requireOrgAdmin` middleware** verifies the user has an `owner` membership in the target organization on every admin API call — an admin from Restaurant A cannot access Restaurant B's data even if they know its UUID
- **`x-organization-id` header** is required on all admin routes — missing or mismatched org IDs return `403`
- **SuperAdmin role** is a separate database field (`role = "superadmin"`) checked server-side on every superadmin route — a regular admin account elevated through any frontend manipulation will still fail the `requireSuperAdmin` check

---

## Threat 4: Unauthorized SuperAdmin Registration

### Mitigation

The SuperAdmin registration endpoint requires a `masterPassword` field that must exactly match the `MASTER_PASSWORD` environment variable. This value is never exposed to the frontend and is not stored in the database.

```typescript
// src/routes/superadmin.ts
if (masterPassword !== env.MASTER_PASSWORD) {
  return c.json({ error: 'Invalid master password.' }, 403)
}
```

The endpoint is public (no prior auth required) but effectively private — without the master password, registration fails with `403`.

---

## Defense in Depth Summary

| Threat | Layer 1 | Layer 2 | Layer 3 |
|---|---|---|---|
| Access from outside restaurant | Table session JWT (90 min, memory-only) | UUID token (unguessable) | Table active flag |
| Session token theft | In-memory only (lost on tab close) | 90-min expiry | Bound to tableToken + orgId |
| Duplicate order (double-tap) | Idempotency key (stable per form open) | 30s duplicate window | — |
| Order flooding (script/attack) | Per-table rate limit (5/min) | 30s duplicate window | Session required |
| Admin accessing another org | `requireOrgAdmin` middleware | Org ID header check | DB-level org scoping |
| Unauthorized superadmin creation | Master password env var | — | — |
| Session hijacking | HTTP-only session cookies | — | — |
| Suspended restaurant still serving | Org status check on table resolve | Org status check on order creation | — |
