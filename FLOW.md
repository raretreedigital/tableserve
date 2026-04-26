# Table Serve — Application Flow

## Overview

Table Serve is a multi-tenant NFC-based restaurant ordering SaaS with three distinct user tiers: **SuperAdmin** (platform operator), **Admin** (restaurant owner), and **Customer** (diner using an NFC tag).

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     SvelteKit Frontend                  │
│  /superadmin/**   /admin/**   /menu/[token]/**          │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP (proxied via Vite → :3000)
┌────────────────────────▼────────────────────────────────┐
│                      Hono Backend (Bun)                 │
│  /api/auth/**   /api/superadmin/**   /api/admin/**      │
│  /api/customer/**                                       │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│               PostgreSQL + Drizzle ORM                  │
└─────────────────────────────────────────────────────────┘
```

---

## User Flows

### 1. SuperAdmin Flow

SuperAdmins are the platform company operators. Only one registration path exists, protected by a master password.

```
SuperAdmin registers
  └── POST /api/superadmin/register
        ├── Validates master password from MASTER_PASSWORD env var
        ├── Creates better-auth user
        └── Sets role = "superadmin"

SuperAdmin logs in
  └── POST /api/auth/sign-in/email (better-auth)
        └── Session created with role checked on protected routes

SuperAdmin Dashboard
  ├── View platform stats (total orgs, users, revenue, active tables)
  ├── Manage Organizations
  │     ├── Create organization (assigns to an admin user)
  │     ├── View org details + members
  │     ├── Suspend / Activate org
  │     └── Update subscription plan (free / basic / premium)
  ├── View platform-wide analytics
  │     ├── Daily revenue chart
  │     ├── Top-selling items across all orgs
  │     └── Top-performing restaurants
  └── Manage Users
        ├── List all users
        ├── Ban user (with reason + optional expiry)
        └── Unban user
```

---

### 2. Admin (Restaurant Owner) Flow

Admins register independently, creating both their user account and their organization in one step.

```
Admin registers
  └── POST /api/admin/register
        ├── Creates better-auth user
        ├── Creates Organization record
        ├── Creates OrganizationProfile (branding/settings)
        └── Creates Member record (role = owner)

Admin logs in
  └── POST /api/auth/sign-in/email (better-auth)
        └── activeOrgId stored in localStorage → sent as x-organization-id header

Admin Dashboard
  ├── Dashboard overview
  │     ├── Today's revenue, order count, avg order value
  │     ├── Monthly totals
  │     └── Pending/confirmed orders list
  │
  ├── Menu Management (/admin/menu)
  │     ├── Create item (name, price, description, image, category, tags, allergens,
  │     │               spice level, calories, prep time, chef's special flag)
  │     ├── Edit item
  │     ├── Toggle availability (soft delete keeps history)
  │     └── Filter by category / availability / chef's special
  │
  ├── Category Management (/admin/categories)
  │     ├── Create / edit / delete categories
  │     └── Set sort order for menu display
  │
  ├── Table Management (/admin/tables)
  │     ├── Create table (generates a UUID nfcToken automatically)
  │     ├── Edit table name/capacity/location
  │     ├── View the NFC URL: /menu/{nfcToken}
  │     ├── Copy NFC URL (to program into NFC tag)
  │     └── Delete table
  │
  ├── Order Management (/admin/orders)
  │     ├── View orders filtered by status tab
  │     ├── View full order detail (items, quantities, notes, totals)
  │     └── Update order status: pending → confirmed → preparing → ready → served
  │
  ├── Analytics (/admin/analytics)
  │     ├── Period filter (today / 7d / 30d / 90d)
  │     ├── Summary cards (revenue, orders, avg order, items sold)
  │     ├── Orders by status breakdown
  │     ├── Top 10 selling items
  │     ├── Slowest-moving items
  │     ├── Revenue by category
  │     └── Daily revenue bar chart
  │
  └── Settings (/admin/settings)
        ├── Restaurant info (name, description, contact, address)
        ├── Branding (primary color, accent color, font family, banner URL, logo URL)
        ├── Customer content (welcome message, footer text)
        ├── Pricing (tax rate %, service charge %)
        ├── Display options (show calories, show allergens, show prep time, show spice level)
        ├── Menu layout (grid / list)
        ├── Currency symbol
        ├── Social links (website, Instagram, Facebook, TripAdvisor)
        └── Subscription plan display (read-only, managed by SuperAdmin)
```

---

### 3. Customer (Diner) Flow

Customers never register. They access the menu by scanning an NFC tag attached to their table.

```
Customer scans NFC tag on table
  └── Browser opens: /menu/{nfcToken}

SvelteKit page loads
  ├── GET /api/customer/table/{nfcToken}
  │     ├── Resolves nfcToken → RestaurantTable record
  │     ├── Validates: table exists, organization is active
  │     └── Returns: table info + full organization branding/settings
  │
  └── GET /api/customer/menu/{organizationId}
        └── Returns: all active categories + available menu items

Customer browses menu
  ├── Search items by name
  ├── Filter by category (tab strip)
  ├── Filter by Chef's Special or Vegetarian/Vegan
  ├── View item detail modal (allergens, calories, spice, prep time, description)
  └── Add items to cart (with optional per-item notes)

Customer places order
  ├── Taps "Cart" → reviews items, sees subtotal + tax + service charge
  ├── Taps "Proceed to Order" → fills in optional name/phone/notes
  └── POST /api/customer/orders
        ├── Validates table token and org status
        ├── Validates all items belong to the org and are available
        ├── Calculates totals (tax rate + service charge from org profile)
        ├── Creates Order + OrderItems in DB
        └── Returns orderId

Customer tracks order
  └── Redirected to /menu/{nfcToken}/order-status/{orderId}
        └── GET /api/customer/orders/{orderId} (polls every 30 seconds)
              └── Displays animated status timeline:
                    pending → confirmed → preparing → ready → served
```

---

## NFC Token Lifecycle

```
Admin creates table in dashboard
  └── Backend generates UUID → stored as nfcToken on RestaurantTable

Admin copies NFC URL from tables page
  └── URL format: https://yourdomain.com/menu/{nfcToken}

Admin programs NFC tag
  └── Using any NFC writing app, writes the URL to a physical NFC tag
  └── Tag is placed on the physical restaurant table

Customer scans tag
  └── Phone opens browser at /menu/{nfcToken}
  └── Full branded menu loads — no app install required
```

---

## Subscription Plan Limits

Limits are enforced server-side on every create operation.

| Plan    | Tables | Menu Items |
|---------|--------|------------|
| Free    | 1      | 20         |
| Basic   | 10     | 100        |
| Premium | ∞      | ∞          |

When a limit is reached, the API returns `403 Forbidden` with a descriptive message. The admin settings page displays the current plan and limits.

---

## Organization Status Lifecycle

```
active   ──── SuperAdmin suspends ────►  suspended
suspended ──── SuperAdmin activates ───►  active
active   ──── SuperAdmin deletes ──────►  (hard delete, cascades to all data)
```

Suspended organizations:
- Cannot accept new orders (customer API returns 403)
- Admin can still log in and view data but cannot modify
- All existing order history is preserved

---

## Theme System

- Theme preference stored in `localStorage` key `theme` (`"dark"` or `"light"`)
- Anti-FOUC script in `app.html` applies `.dark` class to `<html>` before page renders
- Tailwind v4 `@custom-variant dark (&:where(.dark, .dark *))` drives all dark mode styles
- ThemeToggle component available in every layout header

---

## Data Flow: Order to Kitchen

```
Customer places order (POST /api/customer/orders)
  └── Order created with status = "pending"

Admin opens /admin/orders
  └── Sees new order in "Pending" tab
  └── Reviews items, confirms
  └── PATCH /api/admin/orders/{id}/status → status = "confirmed"

Kitchen prepares food
  └── Admin updates: status = "preparing"

Food is ready
  └── Admin updates: status = "ready"
  └── Customer's order status page shows pulsing "Your order is ready!" banner

Staff delivers to table
  └── Admin updates: status = "served"
  └── Customer's polling stops, timeline shows complete
```
