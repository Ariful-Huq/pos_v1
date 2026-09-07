# POS Project (pos_v1) — Single Source of Truth

**Project root:** `C:\Users\Huawei Matebook\pos\pos_v1`
**Stack:** Django + PostgreSQL 17 (backend) · React/Vite + Tailwind v4 (web frontend) · React Native/TypeScript (mobile, not started) · GCP VM + Docker (deployment, not started)
**Local machine:** Windows 11, PowerShell 7.6.5 / Git Bash, pgAdmin 4

> This document supersedes the original step-by-step setup guide. Sections 1–3 are condensed history (how the environment was originally built); sections 4 onward describe the system **as it exists today** and should be kept current as the single reference for design and implementation.

---

## 1. Local environment (already set up)

- PostgreSQL 17 running locally, database `pos_dev`, user `pos_admin`, managed via pgAdmin 4.
- Backend: Python venv at `backend\venv`, dependencies frozen in `backend\requirements.txt`.
- Frontend: Node/npm project at `frontend`, dependencies in `package.json`/`package-lock.json`.
- Monorepo: single GitHub repo, single Docker Hub account planned for all images (not yet built).
- `.env` (backend, gitignored): `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `DATABASE_URL`.
- `.env` (frontend, gitignored): `VITE_API_BASE_URL`.

**Operational rule:** run exactly **one** `python manage.py runserver` process at a time. Multiple stale instances silently serving old code caused real debugging detours more than once. Django's own 404 page (lists every registered URL pattern) is a fast way to confirm a `urls.py` change actually took effect.

---

## 2. Monorepo layout

```
pos_v1/
├── .vscode/
├── backend/         Django project (see §5)
├── frontend/        React web app (see §7)
├── mobile/          empty — React Native app, not started
├── docker/          empty subfolders (backend/, frontend/) — not built yet
├── .gitignore
└── README.md
```

---

## 3. Backend app layering (the core architectural rule)

**Strict upward-only dependency rule**: a lower layer must never import from a higher layer. Enforced throughout — e.g. expense→accounting posting is a Django **signal living inside `accounting`**, not an import from `expenses`, specifically to preserve this rule.

| Layer | App(s)                           | Purpose                                                                         |
| ----- | -------------------------------- | ------------------------------------------------------------------------------- |
| 0     | `core`                           | Shared `BaseModel` (UUID pk + timestamps), pagination, response envelope mixins |
| 1     | `authz`                          | Roles, features/permissions, menus                                              |
| 2     | `tenants`                        | Organization → Branch → Terminal                                                |
| 3     | `staff`, `notifications`         | Staff profiles; SMS/notification abstraction                                    |
| 4     | `catalog`, `inventory`           | Product definitions; the stock ledger                                           |
| 5     | `sales`, `purchases`, `expenses` | Transactional records; write to the inventory ledger                            |
| 6     | `accounting`                     | Chart of accounts, double-entry journal, fed by layer 5                         |
| 7     | `reports`                        | Pure read-side aggregation over everything below                                |

### The core principle: immutable ledgers, never mutable balances

- **Inventory**: `StockMovement` is an append-only ledger (signed quantity + movement type). `StockLevel` is a _cache_ derived from it, never written to directly. Every stock-affecting action goes through `apps.inventory.services.record_movement()`, which is **idempotent** via an `idempotency_key` — a duplicate key returns the existing movement instead of double-applying it.
- **Accounting**: `JournalEntry`/`JournalEntryLine` form a real double-entry ledger. `post_journal_entry()` rejects any entry where debits ≠ credits. Account balances are always _computed_ on read, never stored.

---

## 4. Actual backend file structure

```
backend/
├── manage.py
├── requirements.txt
├── .env
├── venv/
├── config/
│   ├── settings.py, urls.py, wsgi.py, asgi.py
└── apps/
    ├── core/            models.py, pagination.py, responses.py, admin.py, views.py
    ├── authz/           models.py, services.py, permissions.py, admin.py, urls.py, views.py
    │   └── management/commands/seed_authz.py
    ├── tenants/         models.py, serializers.py, admin.py, urls.py, views.py
    ├── staff/           models.py, serializers.py, admin.py, urls.py, views.py
    ├── notifications/   models.py, providers.py, services.py, admin.py, views.py
    ├── catalog/         models.py, serializers.py, defaults.py, admin.py, urls.py, views.py
    ├── inventory/       models.py, serializers.py, services.py, admin.py, urls.py, views.py
    ├── sales/           models.py, serializers.py, services.py, admin.py, urls.py, views.py
    ├── purchases/       models.py, serializers.py, services.py, admin.py, urls.py, views.py
    ├── expenses/        models.py, serializers.py, admin.py, urls.py, views.py
    ├── accounting/      models.py, serializers.py, services.py, signals.py, admin.py, urls.py, views.py
    │   └── management/commands/seed_accounting.py
    └── reports/         views.py, urls.py (no models — pure aggregation)
```

---

## 5. Backend — app by app

### `core`

`BaseModel` (UUID primary key + `created_at`/`updated_at`), `StandardResultsSetPagination`, `success_response`/`error_response` envelope helpers.

### `authz` — roles & permissions

- **Feature-code driven**, not role-name driven: every API view declares a required feature string (e.g. `"sales.create"`); nothing in business logic checks a role name directly.
- Models: `Feature`, `Role`, `RoleFeature`, `Menu`, `UserBranchRole`.
- `UserBranchRole.branch` is **nullable** — null means "this role applies everywhere" (e.g. an owner); a specific branch means the role applies only there.
- `HasFeaturePermission` (DRF permission class): fails closed by default. Superusers bypass entirely via a sentinel in `services.get_user_feature_codes()`.
- Seeded roles: `owner` (all features), `branch_manager`, `cashier`.
- `settings.manage` (business profile/branch management) is granted **only to `owner`**.
- **Important**: `branch_access` in `/authz/me/` reflects `UserBranchRole` rows only — a user with zero role assignments sees an empty branch list even if Branches exist in the system. This is by design (permission boundary), not a bug — assign roles explicitly via `UserBranchRole.objects.get_or_create(user=..., branch=..., role=...)`.

### `tenants`

`Organization` → `Branch` → `Terminal`. `Organization` is treated as a **singleton** — `OrganizationView` is a dedicated APIView (GET/PATCH), not a ModelViewSet. `BranchViewSet` is full CRUD; deleting a branch with sales/stock/accounting history is blocked at the DB level (`on_delete=PROTECT`) and caught cleanly in `destroy()`.

### `staff`

`StaffProfile` (one-to-one with Django's `User`). Creating a staff member via the API creates the `User` login **and** the profile in one request — but grants **no permissions by itself**; that's a separate `UserBranchRole` step.

### `notifications`

`NotificationTemplate`, `NotificationLog`, swappable `SMSProvider` abstraction (`ConsoleSMSProvider` for dev). `services.send_notification()` is the single entry point.

### `catalog`

`Category`, `UnitOfMeasure`, `Product`, `ProductBarcode` (multiple barcodes per product, each with a `conversion_factor` for different packaging levels). `ProductViewSet` supports:

- `/lookup/?code=` — barcode-first, SKU-fallback lookup for POS scanning.
- `get_queryset()` filtering by `?search=` (name/SKU, partial) and `?category=` (exact) — added specifically to support the POS catalog picker grid.
- `organization` is a `HiddenField` with a context-aware default (`CurrentOrganizationDefault`) — required because DRF's `UniqueTogetherValidator` force-requires every field in a `unique_together` constraint regardless of that field's own `required=False`.

### `inventory`

`StockMovement` (ledger) and `StockLevel` (cache). `services.record_movement()`, `get_stock_level()`, `recalculate_stock_level()` (drift-recovery escape hatch). Read-only API + a manual `/adjust/` action reusing the same ledger.

### `purchases`

`Supplier`, `PurchaseOrder`, `PurchaseOrderItem`. Creating a PO does **not** move stock — only `receive_purchase_order_item()` does. Supports partial receiving. Reference numbers auto-generate if not supplied.

### `sales` — the core POS transaction

- `Customer` (optional — no management UI yet, backend-only), `BranchSaleSequence` (gapless per-branch invoice numbers via `select_for_update`), `Sale`, `SaleItem`, `Payment` (multiple rows per sale — split payments), `SaleReturn`/`SaleReturnItem`.
- **Lifecycle, not CRUD**: `draft` → `completed` → possibly `void` or `(partially_)refunded`. `sale_number` assigned only at completion.
- `SaleItem.unit_price` is a **snapshot** at add-time.
- `services.add_item()` **merges** a repeated product+price into the existing line (increments quantity) instead of creating a duplicate row, and the whole operation **locks the Sale row** (`select_for_update`) to prevent a race condition where rapid/overlapping requests could undercount totals. The same locking applies to `remove_item()` and `update_item_quantity()`.
- `void_sale()` reverses stock via the same idempotent ledger.
- Exposed as custom DRF actions on `SaleViewSet` (`create`, `items/`, `items/{id}/remove/`, `items/{id}/quantity/`, `complete/`, `void/`), plus `?status=` filtering used by both the held-sales chooser and the Sales history page.
- `SaleSerializer` includes `branch_code` and `created_at` (added for the Sales history page).

### `expenses`

`ExpenseCategory`, `Expense` (branch-scoped). **Auto-posts to accounting** via a signal.

### `accounting`

`Account`, `JournalEntry`/`JournalEntryLine` (enforced double-entry). `expenses` → `accounting` posting via a **signal defined inside `accounting`** (`signals.py`, connected in `apps.py`'s `ready()`) listening to `Expense.post_save` — preserves the upward-only layering rule. **Sales/purchases do not yet auto-post** — deferred pending a FIFO vs weighted-average inventory valuation decision for COGS.

### `reports`

Pure read-side aggregation (no models). `DashboardSummaryView` and `TopProductsView`, sourced directly from `sales`/`expenses`/`inventory` — **not** from the accounting ledger, since that ledger is currently incomplete (only expenses post to it).

### Auth

JWT (`djangorestframework-simplejwt`). `/api/auth/token/`, `/api/auth/token/refresh/`, `/api/authz/me/` (identity + full branch/role access list).

### CORS

`django-cors-headers`. `CORS_ALLOW_HEADERS` must explicitly include custom headers used by the frontend (`x-active-branch`) — the default header allowlist does not include custom headers, and a preflight `OPTIONS` request will be silently rejected by the browser otherwise. `CORS_ALLOWED_ORIGINS` includes `http://localhost:5173` (Vite dev server).

---

## 6. API endpoint map

| Prefix                                                 | App        | Notes                                        |
| ------------------------------------------------------ | ---------- | -------------------------------------------- |
| `/api/auth/token/`, `/api/auth/token/refresh/`         | —          | JWT login/refresh                            |
| `/api/authz/me/`                                       | authz      | Identity + branch/role access                |
| `/api/tenants/organization/`, `/api/tenants/branches/` | tenants    | Singleton org + branch CRUD                  |
| `/api/catalog/products/`, `/categories/`, `/units/`    | catalog    | Includes `/products/lookup/`                 |
| `/api/inventory/stock-levels/`, `/movements/`          | inventory  | Read-only + `/stock-levels/adjust/`          |
| `/api/sales/sales/`                                    | sales      | Custom actions, not plain CRUD (see §5)      |
| `/api/purchases/suppliers/`, `/purchase-orders/`       | purchases  | Nested line items on create                  |
| `/api/expenses/categories/`, `/expenses/`              | expenses   |                                              |
| `/api/staff/staff/`                                    | staff      | Custom `create()` spanning User+StaffProfile |
| `/api/accounting/accounts/`, `/journal-entries/`       | accounting | Read-only                                    |
| `/api/reports/summary/`, `/top-products/`              | reports    | Query params: `days`, `limit`                |

---

## 7. Frontend architecture

### Design system

Tailwind v4 (CSS `@theme`, no `tailwind.config.js`). Deep teal-emerald brand, warm amber for primary actions, brick-red for destructive actions. Type: **Sora** (headings), **Inter** (body), **IBM Plex Mono** (all prices/SKUs/invoice numbers), **Noto Sans Bengali** in the font stack (automatic per-glyph fallback, no JS font-switching).

### Shared component library (`src/components/ui/`)

`Button`, `Modal`, `ConfirmDialog`, `ActionMenu`, `Tabs`, `Badge`, `DataTable` (generic sortable/paginated table), `StatCard`, `MiniBarChart` (hand-built SVG, no chart dependency), `NumericKeypad`, `LockOverlay`.

### App shell (`src/components/layout/`)

`Sidebar` (collapsible desktop / full drawer mobile), `TopBar` (branch switcher, language toggle, POS launcher icon, user menu), `AppShell` (wraps `<Outlet>`).

### Routing (`src/App.jsx`)

- `/login` — public
- `/pos` — **top-level route, deliberately OUTSIDE `AppShell`** (no sidebar/topbar — a dedicated full-screen terminal)
- `/` (AppShell-wrapped): `/`, `/products`, `/sales`, `/purchases`, `/inventory`, `/expenses`, `/staff`, `/accounting`, `/reports`, `/settings`

### Actual frontend file structure

```
frontend/src/
├── App.jsx, main.jsx, index.css
├── api/            accounting.js, auth.js, catalog.js, client.js, expenses.js,
│                   inventory.js, purchases.js, reports.js, sales.js, staff.js, tenants.js
├── components/
│   ├── layout/     AppShell.jsx, Sidebar.jsx, TopBar.jsx
│   └── ui/         ActionMenu, Badge, Button, ConfirmDialog, DataTable, LockOverlay,
│                   MiniBarChart, Modal, NumericKeypad, StatCard, Tabs
├── context/        AuthContext.jsx, ProtectedRoute.jsx
├── i18n/           index.js, locales/{en,bn}.json
└── pages/
    ├── auth/Login.jsx
    ├── dashboard/Dashboard.jsx
    ├── products/{Products,ProductFormModal}.jsx
    ├── pos/POS.jsx                          ← full-screen terminal, own header/footer, no AppShell
    ├── sales/SalesHistory.jsx               ← admin-style sales list (the "Sales" nav item)
    ├── purchases/{Purchases,PurchaseOrderFormModal,ReceivePurchaseModal}.jsx
    ├── inventory/{Inventory,AdjustStockModal,StockHistoryModal}.jsx
    ├── expenses/{Expenses,ExpenseFormModal}.jsx
    ├── staff/{Staff,StaffFormModal}.jsx
    ├── accounting/Accounting.jsx
    ├── reports/Reports.jsx
    └── settings/{Settings,BranchFormModal}.jsx
```

### `client.js` (axios)

Attaches JWT `Authorization` header and `X-Active-Branch` header to every request. Automatic silent token refresh on 401 — **except** for `/auth/token` endpoints themselves, which must bypass the refresh-retry flow entirely (a failed login has no valid refresh token yet; without this guard, the refresh attempt also fails and triggers a full-page redirect to `/login` that wipes out the original error before the Login page's own error handler can show "incorrect password").

### The `/pos` page in detail

A full-screen terminal (its own header/footer, not the admin `AppShell`):

- **Header** (shared across every POS sub-screen): branch/warehouse selector (single selector — the data model has one "location" concept, not separate warehouse+branch), Customer button (cosmetic — no customer management UI exists yet), Return button (cosmetic — backend `process_return` exists but has no UI wiring yet), language toggle, Settings shortcut, fullscreen toggle, three-dot menu (username, **Lock**, Sign out), exit.
- **Lock**: password-reentry overlay scoped to this page only (not the admin TopBar).
- **Main register screen**: left = product grid (square cards; no real product photos exist yet, placeholder icon shown), right = cart (± quantity, remove) + totals + promo code input (cosmetic — no backend promo system exists) + Total/Pay Now.
- **Bottom bar** (main register screen only): online/synced indicator (currently a static visual — real offline detection is not built), Home, Reset (clears cart), Recent Drafts, Hold.
- **Payment flow**: Pay Now → method tiles (Cash/Card/Mobile Banking/Store Credit) → Cash shows numeric keypad + quick-cash buttons (৳50/100/500/1000) + Exact Amount with live balance/change → Confirm → success screen (Change Due, Print Receipt, Start New Sale). Non-cash methods complete instantly (no real payment terminal integration).

### Internationalization

`react-i18next`, `src/i18n/locales/{en,bn}.json`. Language toggle persists to `localStorage`. Only the app's own UI chrome is translated — user-entered data (product names, category names) is never translated.

---

## 8. Key design decisions worth remembering

- **Feature-code permissions, never role-name checks.**
- **Ledgers, not balances** — inventory and accounting both.
- **`HiddenField` + context-aware default for `unique_together` fields** — plain `required=False` is not enough; DRF's `UniqueTogetherValidator` overrides it.
- **Signals for lower→higher communication** — never a direct import from a lower layer into a higher one.
- **Server-side inference over client-required fields** — `organization`, `branch` (via `X-Active-Branch`, falling back to the only branch in single-branch dev), and auto-generated reference/invoice numbers are all resolved server-side.
- **Lock the row you're about to recompute from** — any "read all related rows, recompute an aggregate, save" operation (sale totals, stock levels) needs `select_for_update()` around it or concurrent requests can silently produce wrong totals.
- **Honest stubs over fake functionality** — where a feature is UI-only pending real backend work (promo codes, customer selection, returns), the UI says so plainly ("coming soon") rather than silently doing nothing or faking a result.

---

## 9. What's NOT built yet

- Sales/Purchases → accounting auto-posting (blocked on FIFO vs weighted-average COGS decision)
- Real promo/discount code system (model, validation, redemption)
- Customer management (list/create/search UI — model and serializer exist, no endpoint/UI)
- Returns/refunds UI (backend `process_return` service exists, unwired)
- Product images (no field on `Product` yet)
- Brand model/filter (only `Category` exists)
- Real offline support (the POS "online/synced" indicator is currently a static visual)
- Docker Compose + GCP VM deployment
- React Native mobile app
- Online store / customer-facing e-commerce (explicitly deferred — needs its own design pass)
- A handful of lower-visibility UI strings not yet translated

---

## 10. Recurring operational lessons from this build

- **Run exactly one `runserver` process at a time.** Multiple stale instances caused two separate debugging detours. Django's own 404 page (lists registered URL patterns) confirms a `urls.py` change actually applied.
- **PowerShell: one command per line.** Joined multi-line pastes repeatedly caused "cannot bind parameter" errors.
- **Manual file copy-paste is error-prone for larger files** — caused at least two file mix-ups (wrong content landing in the wrong file). Writing files directly via a PowerShell here-string (`@'...'@ | Set-Content`) avoids this.
- **CORS custom headers must be explicitly allowlisted** — `CORS_ALLOW_HEADERS` needs any custom header (like `X-Active-Branch`) added on top of the library's defaults, or the browser's preflight silently blocks it.
- **Never let a failed-login request go through the token-refresh-retry interceptor** — it has no valid refresh token yet, and the resulting redirect can mask the real error from the user.
- **`branch_access` reflects explicit role assignments, not raw branch existence** — a superuser or any user with zero `UserBranchRole` rows will see no branches in any selector, regardless of how many exist in the system.

---

## 11. Suggested next steps (pick one)

1. Continue POS fine-tuning (per user's own in-progress UI iteration).
2. Wire up one of the cosmetic stubs for real: Customer management, Returns, or Promo codes.
3. Decide the FIFO vs weighted-average valuation question and wire sales/purchases → accounting.
4. Bangla i18n cleanup pass (remaining untranslated strings).
5. Offline support design (the hardest remaining architectural piece).
6. Docker Compose + GCP VM deployment.
7. React Native mobile app.
