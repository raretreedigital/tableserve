# Table Serve — API Endpoints & Security

## Base URL

```
http://localhost:3000
```

All frontend API calls are proxied through Vite (`/api → http://localhost:3000/api`).

---

## Authentication & Security Model

### Session-Based Auth (better-auth)

All authentication is managed by [better-auth](https://better-auth.dev) via the `/api/auth/**` routes.

- Sessions use **HTTP-only cookies** (set by better-auth automatically)
- All protected routes call `sessionMiddleware` which reads the cookie and attaches the session user to the Hono context
- Credentials are sent with every request via `credentials: "include"` in the fetch client

### Security Layers

| Layer | Middleware | Description |
|---|---|---|
| Session | `sessionMiddleware` | Reads better-auth session from cookie, attaches user to context |
| Authenticated | `requireAuth` | Returns `401` if no valid session |
| SuperAdmin | `requireSuperAdmin` | Returns `403` if user role is not `superadmin` |
| Org Admin | `requireOrgAdmin` | Returns `403` if user has no `owner` membership in the target org |

### Organization Context

Admin routes require the `x-organization-id` request header. This is set by the frontend from `localStorage` (`adminOrgId`) on every admin API call.

```
x-organization-id: <uuid>
```

### Master Password (SuperAdmin Registration)

SuperAdmin registration requires a `masterPassword` field matching the `MASTER_PASSWORD` environment variable. This prevents unauthorized platform admin creation.

---

## Authentication Endpoints (better-auth)

Managed automatically by better-auth. Base path: `/api/auth`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/sign-up/email` | Register (used internally by superadmin/admin register routes) |
| `POST` | `/api/auth/sign-in/email` | Login with email + password |
| `POST` | `/api/auth/sign-out` | Invalidate session |
| `GET`  | `/api/auth/get-session` | Get current session + user |

---

## SuperAdmin Endpoints

**Base path:** `/api/superadmin`

**Security:** All routes require `requireAuth` + `requireSuperAdmin`

### Registration

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/superadmin/register` | Public | Register a superadmin account |

**Body:**
```json
{
  "name": "string",
  "email": "string",
  "password": "string (min 8)",
  "masterPassword": "string"
}
```

**Security note:** `masterPassword` must match `MASTER_PASSWORD` env var. Returns `403` on mismatch.

---

### Platform Stats

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/superadmin/stats` | SuperAdmin | Platform-wide totals |

**Response:**
```json
{
  "totalOrganizations": 0,
  "activeOrganizations": 0,
  "totalUsers": 0,
  "totalOrders": 0,
  "totalRevenue": "0.00",
  "activeTables": 0
}
```

---

### Organization Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/superadmin/organizations` | SuperAdmin | List all organizations (paginated, filterable) |
| `POST` | `/api/superadmin/organizations` | SuperAdmin | Create a new organization |
| `GET` | `/api/superadmin/organizations/:id` | SuperAdmin | Get org details with members |
| `PATCH` | `/api/superadmin/organizations/:id/suspend` | SuperAdmin | Suspend an org |
| `PATCH` | `/api/superadmin/organizations/:id/activate` | SuperAdmin | Reactivate a suspended org |
| `PATCH` | `/api/superadmin/organizations/:id/subscription` | SuperAdmin | Change subscription plan |
| `DELETE` | `/api/superadmin/organizations/:id` | SuperAdmin | Hard delete org and all data |

**GET /organizations query params:**
- `page` (default: 1)
- `limit` (default: 20)
- `search` (name/slug search)
- `status` (`active` | `suspended` | `all`)
- `plan` (`free` | `basic` | `premium` | `all`)

**PATCH subscription body:**
```json
{ "plan": "free" | "basic" | "premium" }
```

---

### Platform Analytics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/superadmin/analytics` | SuperAdmin | Platform-wide analytics |

**Query params:**
- `period`: `today` | `7d` | `30d` | `90d` (default: `30d`)

**Response:**
```json
{
  "summary": { "totalRevenue": "0.00", "totalOrders": 0, "avgOrderValue": "0.00" },
  "dailyRevenue": [{ "date": "2026-04-01", "revenue": "0.00", "orders": 0 }],
  "topItems": [{ "name": "string", "count": 0, "revenue": "0.00" }],
  "topOrganizations": [{ "name": "string", "orders": 0, "revenue": "0.00" }]
}
```

---

### User Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/superadmin/users` | SuperAdmin | List all users (paginated) |
| `PATCH` | `/api/superadmin/users/:id/ban` | SuperAdmin | Ban a user |
| `PATCH` | `/api/superadmin/users/:id/unban` | SuperAdmin | Unban a user |

**PATCH ban body:**
```json
{
  "reason": "string",
  "expiresAt": "ISO8601 date (optional)"
}
```

---

## Admin Endpoints

**Base path:** `/api/admin`

**Security:** All routes (except `/register`) require `requireAuth` + `requireOrgAdmin`

The `requireOrgAdmin` middleware reads `x-organization-id` from the request header and verifies the authenticated user has a `owner` membership in that organization.

### Registration

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/admin/register` | Public | Create admin user + organization |

**Body:**
```json
{
  "name": "string",
  "email": "string",
  "password": "string (min 8)",
  "organizationName": "string",
  "organizationSlug": "string (optional)"
}
```

Creates: user → organization → organizationProfile (defaults) → member (owner role).

---

### Dashboard & Profile

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/dashboard` | Org Admin | Today + monthly stats, recent pending orders |
| `GET` | `/api/admin/profile` | Org Admin | Get org + full profile/settings |
| `PATCH` | `/api/admin/profile` | Org Admin | Update org profile settings |

**PATCH profile body** (all fields optional):
```json
{
  "primaryColor": "#hex",
  "accentColor": "#hex",
  "fontFamily": "string",
  "bannerUrl": "url",
  "logoUrl": "url",
  "welcomeMessage": "string",
  "footerText": "string",
  "menuLayout": "grid" | "list",
  "showCalories": true,
  "showAllergens": true,
  "showPreparationTime": true,
  "showSpiceLevel": true,
  "currencySymbol": "string",
  "taxRate": "0.00",
  "serviceChargeRate": "0.00",
  "website": "url",
  "instagram": "url",
  "facebook": "url",
  "tripadvisor": "url"
}
```

---

### Menu Categories

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/categories` | Org Admin | List all categories |
| `POST` | `/api/admin/categories` | Org Admin | Create a category |
| `PATCH` | `/api/admin/categories/:id` | Org Admin | Update category |
| `DELETE` | `/api/admin/categories/:id` | Org Admin | Delete category |

**POST / PATCH body:**
```json
{
  "name": "string",
  "description": "string (optional)",
  "sortOrder": 0
}
```

---

### Menu Items

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/menu` | Org Admin | List items (filterable) |
| `POST` | `/api/admin/menu` | Org Admin | Create item |
| `PATCH` | `/api/admin/menu/:id` | Org Admin | Update item |
| `DELETE` | `/api/admin/menu/:id` | Org Admin | Soft-delete (sets isAvailable = false) |

**Subscription limits enforced on POST:**
- Free: max 20 items
- Basic: max 100 items
- Premium: unlimited

**POST / PATCH body:**
```json
{
  "name": "string",
  "description": "string (optional)",
  "price": "0.00",
  "categoryId": "uuid (optional)",
  "imageUrl": "url (optional)",
  "isAvailable": true,
  "isVegetarian": false,
  "isVegan": false,
  "isGlutenFree": false,
  "isChefSpecial": false,
  "spiceLevel": "none" | "mild" | "medium" | "hot",
  "allergens": ["string"],
  "calories": 0,
  "preparationTime": 0,
  "tags": ["string"]
}
```

**GET /menu query params:**
- `categoryId` (filter by category)
- `available` (`true` | `false`)
- `chefSpecial` (`true`)

---

### Tables

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/tables` | Org Admin | List all tables |
| `POST` | `/api/admin/tables` | Org Admin | Create table (auto-generates nfcToken UUID) |
| `PATCH` | `/api/admin/tables/:id` | Org Admin | Update table |
| `DELETE` | `/api/admin/tables/:id` | Org Admin | Delete table |

**Subscription limits enforced on POST:**
- Free: max 1 table
- Basic: max 10 tables
- Premium: unlimited

**POST / PATCH body:**
```json
{
  "name": "string",
  "capacity": 4,
  "location": "string (optional)"
}
```

**Response includes `nfcToken`** — the UUID to program into the physical NFC tag.

---

### Orders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/orders` | Org Admin | List orders (filterable by status) |
| `GET` | `/api/admin/orders/:id` | Org Admin | Get order details + items |
| `PATCH` | `/api/admin/orders/:id/status` | Org Admin | Update order status |

**GET /orders query params:**
- `status`: `pending` | `confirmed` | `preparing` | `ready` | `served` | `cancelled`
- `page`, `limit`

**PATCH status body:**
```json
{ "status": "confirmed" | "preparing" | "ready" | "served" | "cancelled" }
```

---

### Admin Analytics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/analytics` | Org Admin | Full restaurant analytics |

**Query params:**
- `period`: `today` | `7d` | `30d` | `90d`

**Response:**
```json
{
  "summary": {
    "totalRevenue": "0.00",
    "totalOrders": 0,
    "avgOrderValue": "0.00",
    "totalItemsSold": 0
  },
  "byStatus": [{ "status": "string", "count": 0 }],
  "topItems": [{ "name": "string", "count": 0, "revenue": "0.00" }],
  "slowItems": [{ "name": "string", "count": 0 }],
  "dailyRevenue": [{ "date": "string", "revenue": "0.00", "orders": 0 }],
  "hourlyDistribution": [{ "hour": 0, "orders": 0 }],
  "revenueByCategory": [{ "category": "string", "revenue": "0.00" }]
}
```

---

### Members

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/members` | Org Admin | List all members of the organization |

---

## Customer Endpoints

**Base path:** `/api/customer`

**Security:** All routes are **public** (no authentication required). Protection is by:
- NFC token being an unguessable UUID
- Organization status check (suspended orgs return 403)
- Item availability check on order placement

### Resolve NFC Table

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/customer/table/:token` | Public | Resolve NFC token → org + table |

**Response:**
```json
{
  "table": { "id": "uuid", "name": "string", "organizationId": "uuid" },
  "organization": {
    "id": "uuid",
    "name": "string",
    "primaryColor": "#hex",
    "accentColor": "#hex",
    "fontFamily": "string",
    "welcomeMessage": "string",
    "footerText": "string",
    "menuLayout": "grid" | "list",
    "showCalories": true,
    "showAllergens": true,
    "showPreparationTime": true,
    "showSpiceLevel": true,
    "currencySymbol": "$",
    "taxRate": "0.00",
    "serviceChargeRate": "0.00",
    "bannerUrl": "url | null"
  }
}
```

**Errors:**
- `404` — token not found
- `403` — organization is suspended

---

### Get Menu

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/customer/menu/:organizationId` | Public | Get all available menu items + categories |

**Response:**
```json
{
  "categories": [{ "id": "uuid", "name": "string", "sortOrder": 0 }],
  "items": [{
    "id": "uuid",
    "name": "string",
    "description": "string",
    "price": "0.00",
    "categoryId": "uuid",
    "imageUrl": "url",
    "isVegetarian": false,
    "isVegan": false,
    "isGlutenFree": false,
    "isChefSpecial": false,
    "spiceLevel": "none",
    "allergens": [],
    "calories": null,
    "preparationTime": null,
    "tags": []
  }]
}
```

Only returns items where `isAvailable = true`.

---

### Place Order

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/customer/orders` | Public | Place a new order |

**Body:**
```json
{
  "tableToken": "uuid",
  "customerName": "string (optional)",
  "customerPhone": "string (optional)",
  "notes": "string (optional)",
  "items": [
    {
      "menuItemId": "uuid",
      "quantity": 1,
      "notes": "string (optional)"
    }
  ]
}
```

**Server-side validations:**
1. `tableToken` resolves to an existing table
2. Organization is `active` (not suspended)
3. All `menuItemId` values belong to the same organization
4. All items have `isAvailable = true`
5. `quantity` ≥ 1 for all items

**Totals calculation:**
```
subtotal = sum(item.price × item.quantity)
taxAmount = subtotal × (org.taxRate / 100)
serviceChargeAmount = subtotal × (org.serviceChargeRate / 100)
totalAmount = subtotal + taxAmount + serviceChargeAmount
```

**Response:**
```json
{
  "orderId": "uuid",
  "status": "pending",
  "totalAmount": "0.00"
}
```

**Errors:**
- `404` — table or item not found
- `403` — organization is suspended
- `400` — item unavailable or quantity invalid

---

### Get Order Status

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/customer/orders/:id` | Public | Poll order status + items |

**Response:**
```json
{
  "id": "uuid",
  "status": "pending" | "confirmed" | "preparing" | "ready" | "served" | "cancelled",
  "totalAmount": "0.00",
  "taxAmount": "0.00",
  "serviceChargeAmount": "0.00",
  "notes": "string",
  "customerName": "string",
  "createdAt": "ISO8601",
  "items": [{
    "id": "uuid",
    "quantity": 1,
    "unitPrice": "0.00",
    "notes": "string",
    "menuItem": { "id": "uuid", "name": "string" }
  }],
  "table": { "name": "string" },
  "organization": { "name": "string" }
}
```

---

## Health Check

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | Public | Service liveness check |

**Response:**
```json
{ "status": "ok", "timestamp": "ISO8601" }
```

---

## Error Response Format

All errors follow a consistent shape:

```json
{
  "error": "Human-readable error message"
}
```

| HTTP Status | Meaning |
|-------------|---------|
| `400` | Bad Request — validation failed or invalid input |
| `401` | Unauthorized — no valid session |
| `403` | Forbidden — insufficient role, wrong org, or org suspended |
| `404` | Not Found — resource does not exist |
| `409` | Conflict — duplicate (e.g., email already registered) |
| `500` | Internal Server Error — unexpected failure |

---

## CORS Configuration

```
Origin: FRONTEND_URL (env var)
Methods: GET, POST, PATCH, DELETE, OPTIONS
Headers: Content-Type, Authorization, x-organization-id
Credentials: true (required for cookie-based sessions)
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | Secret for signing sessions (min 32 chars) |
| `BETTER_AUTH_URL` | Yes | Backend base URL (e.g., `http://localhost:3000`) |
| `FRONTEND_URL` | Yes | Frontend base URL for CORS (e.g., `http://localhost:5173`) |
| `MASTER_PASSWORD` | Yes | Password required to register a SuperAdmin account |
| `PORT` | No | Server port (default: 3000) |
