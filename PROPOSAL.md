# Table Serve — Partner Proposal

> **Confidential** · Prepared for potential technology & distribution partners

---

## 1. Executive Summary

**Table Serve** is a cloud-based restaurant ordering SaaS that eliminates paper menus, reduces order errors, and accelerates table turnover through NFC-powered self-ordering. Customers tap a table tag with any smartphone and place their order directly — no app download, no account required. Staff receive orders in real time via a native waiter app and a web-based admin dashboard.

We are seeking partners in the areas of:
- **Hardware distribution** (NFC tags & sticker printing)
- **Payment gateway integration** (Stripe, Razorpay, Square, etc.)
- **POS / kitchen display system (KDS) integration**
- **Restaurant group licensing & white-labelling**

---

## 2. Product Overview

### How It Works

```
Customer Journey
─────────────────────────────────────────────────────────────────────────
 [Table NFC tag] → tap → [Browser opens menu] → browse → add to cart
                                              → confirm order → kitchen notified

Waiter Journey
─────────────────────────────────────────────────────────────────────────
 [New order notification] → review order → update status
 (pending → confirmed → preparing → ready → served)

Admin Journey
─────────────────────────────────────────────────────────────────────────
 [Dashboard] → manage menu / tables / staff → view analytics
             → create waiter accounts → assign tables
```

### Architecture

| Layer | Technology |
|---|---|
| **Backend API** | Bun runtime + Hono v4 (TypeScript) |
| **Database** | PostgreSQL + Drizzle ORM |
| **Authentication** | better-auth (session + admin plugin) |
| **Frontend (Admin)** | SvelteKit 5 + Tailwind CSS v4 |
| **Waiter Mobile App** | Flutter 3.22+ (iOS & Android) |
| **Observability** | Loki + Grafana (structured JSON logs) |
| **Infra** | Docker Compose — portable, self-hostable |

---

## 3. Feature Breakdown by Plan

### 🆓 Free Plan
| Feature | Detail |
|---|---|
| Menu management | Up to 20 items, 5 categories |
| NFC ordering | Unlimited customer scans |
| Order management | Basic status flow |
| Tables | Up to 5 tables |
| Analytics | 7-day summary only |

### ⭐ Basic Plan — ₹999 / $12 per month
| Feature | Detail |
|---|---|
| Everything in Free | — |
| Menu items | Up to 100 items, 20 categories |
| Tables | Up to 20 tables |
| Analytics | 30-day history + revenue charts |
| Order editing | Waiters can edit pending orders |
| Custom logo | Shown on customer menu page |
| Email support | — |

### 💎 Premium Plan — ₹2,499 / $30 per month
| Feature | Detail |
|---|---|
| Everything in Basic | — |
| Menu items | Unlimited |
| Tables | Unlimited |
| **Waiter mobile app** | iOS & Android — real-time orders |
| **Staff management** | Create / assign / deactivate waiters from admin UI |
| **Auto-credential generation** | Admin generates login credentials; waiter uses them |
| **Duty status & auto-cover** | Waiter marks on-leave → tables auto-assigned to on-duty staff |
| Analytics | 1-year history, export CSV |
| Priority support | Chat + email |

---

## 4. Waiter App — Premium Exclusive

The Table Serve Waiter app is a Flutter application for iOS and Android providing:

| Feature | Detail |
|---|---|
| **Real-time order feed** | Polls every 15 seconds; push notifications on new orders |
| **Order status flow** | One-tap status updates: pending → confirmed → preparing → ready |
| **Order editing** | Add/remove items, update quantities, adjust notes |
| **Table view** | See all assigned tables, active order count, pending alerts |
| **Auto-cover indicator** | "Covering" badge on tables belonging to on-leave colleagues |
| **Duty status toggle** | Set On Duty / On Leave / Off Shift from the Profile page |
| **Auto-assignment badge** | "Auto" badge on orders from covered tables |
| **Credential-only login** | Admin issues credentials; waiters cannot change name or email |

### Duty Status & Auto-Cover Logic

```
Waiter A  →  sets status: On Leave
                 ↓
         Tables A1, A2, A3 become visible to all on-duty waiters
                 ↓
Waiter B  →  sees A1, A2, A3 in their table list (marked "Covering")
Waiter C  →  sees A1, A2, A3 in their table list (marked "Covering")
                 ↓
Waiter A  →  sets status: On Duty → tables return to Waiter A only
```

No manual reassignment needed. Duty changes take effect immediately.

---

## 5. Admin Dashboard Features

- **Menu management** — categories + items with images, prices, availability toggle
- **Table management** — NFC token generation, QR/NFC sticker print view
- **Waiter management** (Premium) — create, assign tables, deactivate, regenerate credentials
- **Order management** — full order history, status filters, real-time feed
- **Analytics** — revenue by day/week/month, top items, average order value, table utilisation
- **Organisation profile** — logo URL, tax rate, service charge rate

---

## 6. What Is Currently Live

The following is fully built and working as of April 2026.

### Customer Ordering
- NFC table tap → mobile browser opens branded menu (no app install)
- Browse menu by category, add items to cart, place order
- Customer name capture at checkout
- Real-time order confirmation

### Admin Dashboard (Web)
- Account registration and organisation setup
- Menu management — categories, items, prices, availability toggle, custom logo
- Table management — create tables, generate NFC tokens, print-ready sticker view
- Order management — live order feed, status filters, full order history
- Waiter management — create accounts, assign tables, deactivate staff, regenerate credentials
- Waiter visibility — view each waiter's duty status and all orders from their tables
- Analytics — revenue by day/week/month, top-selling items, average order value
- Organisation profile — tax rate, service charge rate, logo
- Plan-based feature gating enforced server-side (Free / Basic / Premium)

### Waiter Mobile App (Flutter — iOS & Android)
- Login with admin-issued credentials
- Live order feed with 15-second refresh and push notifications
- One-tap order status updates (pending → confirmed → preparing → ready)
- Order editing — change items, quantities, and notes
- Tables view — assigned tables, active order count, urgent-order alerts
- Duty status toggle — On Duty / On Leave / Off Shift
- Auto-cover — going on leave instantly redistributes your tables to on-duty colleagues; no manual action needed
- "Covering" badge on tables and "Auto" badge on orders from covered tables

### Infrastructure
- Fully containerised via Docker Compose — runs on any Linux server
- Structured JSON logging → Grafana/Loki observability stack (included in the Compose setup)
- Self-hostable with zero third-party lock-in

### Hosting Cost Estimate

| Option | Monthly Cost | Suitable for |
|---|---|---|
| Budget VPS (Hetzner CX22 / DigitalOcean Basic) | ~$6–10 | Single restaurant / pilot |
| VPS + managed PostgreSQL (Neon / Supabase) | ~$15–25 | Up to ~20 concurrent restaurants |
| AWS / GCP (t3.small + RDS t3.micro) | ~$35–55 | Production with SLA guarantees |
| Dedicated server (bare metal) | ~$40–80 | High-volume multi-tenant |

These figures cover infrastructure only. Domain registration (~$10–15/yr) and SSL (free via Let's Encrypt) are additional minor items. Storage for menu images is negligible at this scale (< $2/month on any object store).

---

## 7. Integration & Partnership Opportunities

### 7.1 Hardware Partners — NFC Tag Suppliers
We generate unique NFC tokens per table. We are looking for partners who can:
- Supply pre-programmed NFC stickers with Table Serve URLs
- Offer a co-branded table stand / coaster product
- Bundle hardware + SaaS subscription as a package

**Revenue model:** Per-unit hardware commission + co-marketed subscription upsell.

### 7.2 Payment Gateway Partners
Current flow: orders are placed and paid at the counter / on delivery. Integration roadmap includes:
- In-app payment at time of ordering (Stripe / Razorpay)
- Split-bill and digital receipt delivery
- Loyalty point schemes via gateway SDKs

**Revenue model:** Revenue share on processed transaction volume.

### 7.3 POS / KDS Integration Partners
Restaurants running existing POS systems want order data to flow directly to their kitchen display. We can offer:
- Webhook push on every new/updated order
- REST API for polling (already live)
- Custom integration development for major POS vendors (NCR, Oracle MICROS, Lightspeed)

**Revenue model:** Integration licence fee + monthly API access fee.

### 7.4 White-Label / Restaurant Group Licensing
For chains or aggregators wanting their own branded ordering platform:
- Custom domain + branding
- Dedicated PostgreSQL tenant
- Custom feature development on retainer

**Revenue model:** Per-location monthly fee (volume discount for 10+ locations).

---

## 8. Technical Differentiators

| Aspect | Detail |
|---|---|
| **Zero app install for customers** | NFC → browser → order. Works on all modern smartphones. |
| **Self-hostable** | Docker Compose deployment — on-premise option for data-sensitive operators. |
| **Real-time without WebSockets** | Efficient 15-second polling with diff detection and local notifications. |
| **Plan-based feature gating** | Server-enforced; switching plans takes effect immediately. |
| **Structured observability** | All events logged as JSON → Loki → Grafana dashboards from day one. |
| **Auto-cover mechanic** | Duty-based table redistribution — unique to Table Serve; no competitor offers this. |

---

## 9. Pricing Summary

| Plan | Monthly (INR) | Monthly (USD) | Annual discount |
|---|---|---|---|
| Free | ₹0 | $0 | — |
| Basic | ₹999 | $12 | 2 months free |
| Premium | ₹2,499 | $30 | 2 months free |
| White-Label (per location) | ₹4,999 | $60 | Custom |

Partnership / reseller margin: **20–30%** on referred subscriptions, negotiable for volume.

---

## 10. Roadmap

| Quarter | Milestone |
|---|---|
| **Q3 2025** | In-app payment (Stripe/Razorpay), kitchen display mode |
| **Q3 2025** | Multi-language menu (i18n) |
| **Q4 2025** | Inventory depletion tracking |
| **Q4 2025** | Customer loyalty programme |
| **Q1 2026** | POS integration (Oracle MICROS, Lightspeed) |
| **Q1 2026** | Offline-capable waiter app (SQLite local cache) |
| **Q2 2026** | AI-powered menu recommendations + upsell prompts |

---

## 11. Next Steps

We welcome a short discovery call to explore fit. Please reach out with:

- Your current product / distribution footprint
- Integration areas of interest
- Preferred commercial model (revenue share, licence fee, white-label)

**Contact:** [your-email@tableserve.io]  
**Demo environment:** Available on request  
**GitHub / Technical docs:** Available under NDA  

---

*This document is confidential and intended solely for the named recipient.*  
*© 2025 Table Serve. All rights reserved.*
