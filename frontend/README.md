# Customer management module — delivery

This contains only the new/changed files, with the same paths as your
project. Copy each one over the matching file in `pos_v1/` (all paths
below are relative to your project root).

## Backend

- `backend/apps/sales/serializers.py` — updated (`CustomerSerializer` now
  infers `organization` like `Category` does; added
  `CustomerSaleHistorySerializer`).
- `backend/apps/sales/views.py` — updated (new `CustomerViewSet`; new
  `SaleViewSet.set_customer` action).
- `backend/apps/sales/urls.py` — updated (registers `customers`).
- `backend/apps/authz/management/commands/seed_authz.py` — updated (adds
  `customers.view` / `customers.manage` features, assigned to `owner`,
  `branch_manager`, and `cashier`).

**After copying these in, re-run the seed command** so the new feature
codes exist and are assigned to your roles:

```powershell
cd backend; .\venv\Scripts\Activate.ps1; python manage.py seed_authz
```

It's idempotent — safe to re-run even though it's already been run once.
No migration is needed: `Customer` already existed in your schema.

## Frontend

- `frontend/src/api/customers.js` — new.
- `frontend/src/api/sales.js` — updated (adds `setSaleCustomer`).
- `frontend/src/pages/customers/Customers.jsx` — new (admin CRUD page).
- `frontend/src/pages/customers/CustomerFormModal.jsx` — new.
- `frontend/src/pages/pos/POS.jsx` — updated (Customer button now opens a
  real picker instead of "coming soon"; new history panel).
- `frontend/src/App.jsx` — updated (adds `/customers` route).
- `frontend/src/components/layout/Sidebar.jsx` — updated (adds
  "Customers" nav item).
- `frontend/src/i18n/locales/en.json` / `bn.json` — updated (new
  translation keys for everything above, in both languages).

I ran `npm install && npm run build` against these files in a clean
checkout and it built with no errors — only the pre-existing "chunk size"
warning and two pre-existing unused-import lint warnings that were
already in POS.jsx before this change.

## What this actually does

**Admin → Customers** (new sidebar item): full list/search/create/
edit/delete for `sales.Customer`, gated by the new `customers.view` /
`customers.manage` feature codes — same shape as the Suppliers tab.

**POS terminal**: the Customer button in the header was a stub
(`"Customer selection is coming soon."`). It's now wired up:

- Click it → search existing customers by name/phone, pick one, or
  "Continue as walk-in". Selecting a customer calls the new
  `POST /api/sales/sales/{id}/customer/` endpoint to attach them to the
  current draft sale (the sale already exists by the time the picker
  opens, so this couldn't just be a `create()`-time field).
- **Quick Add Customer** (already a toggle in POS Settings, previously
  did nothing): when on, the picker has an inline "+ New customer" form
  so a cashier can add a walk-in without leaving the register.
- **Customer purchase history** (same — previously did nothing): when
  on, a History button appears next to the customer button once someone
  is selected, showing their past completed sales via the new
  `GET /api/sales/customers/{id}/sales/` endpoint.
- **Enable Customer Points** (same): when on, loyalty points show next
  to each customer in the picker and next to the selected customer's
  name in the header.

I didn't build automatic point accrual (e.g. "1 point per ৳100 spent") —
the `Customer` model's own docstring says `loyalty_points` is
deliberately "a simple running counter, not a full loyalty/rewards
engine," and no accrual rule was specified anywhere in the docs. Points
are a plain editable field for now (adjustable from the admin Customers
page); accrual logic is a separate decision (like the FIFO/weighted-
average one already flagged as deferred) that's worth making explicitly
rather than guessing at.

I also left the `F8` "quick add customer" keyboard shortcut unbound —
none of the keyboard shortcuts are wired to actual key handlers yet
(the shortcuts panel is a documented, explicitly-labeled stub covering
many actions at once), so binding just F8 would be inconsistent with the
rest of that list rather than a customer-management change.

## Update the two `pos_v1` docs

Per your own rule ("when this document and the code disagree, fix the
document"), two lines are now stale:

- Single Source of Truth §8 "What is NOT built" — remove the "POS
  customer management" bullet.
- Design Document §11 "Deliberately deferred" — remove the "POS customer
  management" row.

I didn't edit those files myself since I only have Markdown copies you
pasted in, not the actual repo files.
