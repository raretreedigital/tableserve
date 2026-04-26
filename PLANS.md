# Table Serve — Subscription Plans

## Overview

Table Serve offers three tiers to suit restaurants of any size.

| Feature | Free | Basic | Premium |
|---|:---:|:---:|:---:|
| **Tables** | 1 | 10 | Unlimited |
| **Menu Items** | 20 | 100 | Unlimited |
| **Categories** | 3 | 20 | Unlimited |
| **Orders / month** | 200 | 5,000 | Unlimited |
| **Branding** (colors, fonts, welcome message, footer) | ✗ | ✓ | ✓ |
| **Logo URL** | ✗ | ✓ | ✓ |
| **Banner image** | ✗ | ✓ | ✓ |
| **Custom font family** | ✗ | ✓ | ✓ |
| **Order edit window** (configurable 0–60 min) | ✗ | ✓ | ✓ |
| **Custom tax & service charge rates** | ✗ | ✓ | ✓ |
| **Allergen / calorie / spice level display** | ✗ | ✓ | ✓ |
| **Preparation time display** | ✗ | ✓ | ✓ |
| **Social links** (Instagram, Facebook, Twitter) | ✗ | ✗ | ✓ |
| **Analytics retention** | 7 days | 30 days | 90 days |
| **CSV export** | ✗ | ✗ | ✓ |
| **Priority support** | ✗ | ✗ | ✓ |
| **Custom domain** *(future)* | ✗ | ✗ | ✓ |

---

## Feature Details

### Free Plan
- Good for small single-table pop-ups or evaluating the platform.
- Menu is fully functional with NFC scanning.
- No branding customisation — all colours/fonts are default.
- Orders are **final** once placed (edit window disabled).
- Analytics limited to the last 7 days of order history.

### Basic Plan
- Designed for cafés, food trucks, and small restaurants.
- Full branding suite: primary/accent colours, font, logo, banner, welcome message, footer text.
- Configurable **order edit window** (0–60 minutes after placing; default 5 min). When set to `0` editing is disabled.
- Custom tax and service charge rates per organisation.
- Display enhancements: allergens, calories, spice levels, preparation times.
- Analytics retain 30 days of data.

### Premium Plan
- For multi-location restaurants and high-volume venues.
- Everything in Basic, plus:
  - **Social links** shown in the menu footer (Instagram, Facebook, Twitter / X).
  - 90-day analytics with **CSV export**.
  - Priority email support with 4-hour SLA.
  - Custom domain support *(roadmap)*.

---

## Plan Enforcement

Plan gating is enforced **server-side** in `table-serve-backend/src/routes/admin.ts`:

```
PATCH /admin/profile
  - Branding fields (colors, logo, banner, font, welcome, footer) → Basic+
  - orderEditWindowMinutes                                         → Basic+
  - socialLinks                                                    → Premium
```

The frontend (`/admin/settings`) shows **"Basic+ only"** or **"Premium only"** badges next to locked fields and disables saving changes that would be rejected by the server on Free accounts.

---

## Upgrading

Subscriptions are managed by a SuperAdmin via `/superadmin/organizations/:id` — set `subscriptionPlan` to `free`, `basic`, or `premium` and update `subscriptionExpiry` as required. There is no self-serve billing UI in v1.
