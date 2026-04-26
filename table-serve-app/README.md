# Table Serve — Waiter App

Flutter mobile app for restaurant waiters. Available on **Premium plan** only.

## Features

| Feature | Description |
|---|---|
| 🔐 Login | Email/password auth via the same backend as the admin panel |
| 📋 Orders | Real-time order list for assigned tables, filtered by status |
| 🔔 Notifications | Local push notification on every new order (polling every 15 s) |
| 🔄 Status updates | Confirm → Preparing → Ready → Served in one tap |
| ✏️ Edit orders | Modify item quantities/notes before preparing starts |
| 🍽️ Tables view | See all assigned tables with live order summaries |
| 👤 Profile | Account info, logout |

---

## Prerequisites

- Flutter **3.22+** (`flutter --version`)
- Running `table-serve-backend` (locally or deployed)
- A waiter account created via the Admin dashboard → **Waiters** section
  (requires Premium plan on the organisation)

---

## Setup

```bash
# 1. Install dependencies
cd table-serve-app
flutter pub get

# 2. Configure the backend URL
#    Edit lib/core/constants.dart → baseUrl
#    OR pass at build time:
flutter run --dart-define=API_BASE_URL=http://YOUR_SERVER:3000/api

# 3. Run (Android emulator — 10.0.2.2 maps to localhost)
flutter run

# 4. Run (physical device — use your machine's LAN IP)
flutter run --dart-define=API_BASE_URL=http://192.168.x.x:3000/api
```

---

## Project Structure

```
lib/
├── main.dart                        Entry point (ProviderScope)
├── core/
│   ├── constants.dart               API base URL, storage keys, poll interval
│   ├── theme.dart                   Material 3 theme (light + dark)
│   └── router.dart                  go_router config + bottom-nav shell
├── models/
│   ├── order_model.dart             Order + OrderItem
│   ├── table_model.dart             RestaurantTable
│   └── waiter_model.dart            WaiterUser + WaiterAssignment
├── services/
│   ├── api_service.dart             Dio HTTP client (auto-attaches session token)
│   ├── storage_service.dart         SharedPreferences wrapper
│   └── notification_service.dart    flutter_local_notifications setup + helpers
├── providers/
│   ├── auth_provider.dart           Login / logout / auto-restore session
│   ├── orders_provider.dart         Orders state + polling + optimistic updates
│   └── tables_provider.dart         Assigned tables
└── features/
    ├── auth/login_page.dart         Login screen
    ├── home/home_page.dart          Dashboard (stats + urgent orders)
    ├── orders/
    │   ├── orders_page.dart         Filterable order list
    │   ├── order_detail_page.dart   Full order view + status actions + edit button
    │   ├── edit_order_page.dart     Edit item quantities/notes
    │   └── widgets/
    │       ├── order_card.dart      Compact order card
    │       └── status_chip.dart     Coloured status badge
    ├── tables/tables_page.dart      Table grid with live order summaries
    └── profile/profile_page.dart    Account info + sign out
```

---

## Backend API used

All routes require `Authorization: Bearer <session-token>` (obtained at login).

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/sign-in/email` | Login |
| `GET` | `/api/waiter/me` | Waiter profile + assigned tables |
| `GET` | `/api/waiter/orders` | Active orders for assigned tables |
| `GET` | `/api/waiter/orders/:id` | Single order detail |
| `PATCH` | `/api/waiter/orders/:id/status` | Update order status |
| `PATCH` | `/api/waiter/orders/:id` | Edit order items |
| `GET` | `/api/waiter/tables` | Assigned tables |

---

## Admin: Creating a Waiter

1. Log in as an admin with a **Premium** subscription.
2. Go to **Settings → Waiters → Add Waiter**.
3. Fill in name, email, password, and assign tables.
4. The waiter can now log in on this mobile app with those credentials.

---

## Logging

The backend ships structured JSON logs to **Grafana Loki** (self-hosted via Docker Compose, free).  
Access Grafana at `http://localhost:3200` (default credentials: `admin` / `admin`).

The Loki datasource is pre-provisioned — just open Grafana → Explore → select **Loki** → run:

```logql
{app="table-serve-backend"}
{app="table-serve-backend", level="error"}
{app="table-serve-backend"} | json | method="PATCH"
```

---

## Building for Production

```bash
# Android APK
flutter build apk --release --dart-define=API_BASE_URL=https://api.yourdomain.com/api

# Android App Bundle (Play Store)
flutter build appbundle --release --dart-define=API_BASE_URL=https://api.yourdomain.com/api

# iOS
flutter build ios --release --dart-define=API_BASE_URL=https://api.yourdomain.com/api
```
