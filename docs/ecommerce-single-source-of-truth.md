# pos_v1 E-commerce — Single Source of Truth

**What this document is:** the complete technical reference for the e-commerce extension built on top of `pos_v1`. It covers architecture, data model, API surface, the storefront application, local development, how to build new features consistently with what's here, and a deployment runbook for going to a cloud environment.

**Who it's for:** a new developer joining this project should be able to read this document, understand the system end to end, run it locally, and start building a new feature without needing to read through prior conversation history or commit logs.

**Companion document:** `pos-v1-single-source-of-truth.md` — the original POS system (staff-facing, in-store). This document assumes that one as background and does not repeat it; read that one first if you haven't.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Backend Reference](#3-backend-reference)
4. [Storefront Reference](#4-storefront-reference)
5. [Frontend (POS) Integration](#5-frontend-pos-integration)
6. [Local Development Setup](#6-local-development-setup)
7. [Feature Development Guide](#7-feature-development-guide)
8. [Current Status — Real vs. Cosmetic vs. Not Built](#8-current-status--real-vs-cosmetic-vs-not-built)
9. [Cloud Deployment Runbook](#9-cloud-deployment-runbook)
10. [Roadmap](#10-roadmap)
11. [Appendix](#11-appendix)

---

## 1. System Overview

`pos_v1` is now three applications sharing one Django backend and one database:

| App | Stack | Audience | Port (local) |
|---|---|---|---|
| **Backend** | Django 6.1 + DRF | — (API only) | 8000 |
| **Frontend** | Vite + React | Staff (in-store, back-office) | 5173 |
| **Storefront** | Next.js 15 (App Router) | Customers (public, online) | 3000 |

The storefront is a genuinely separate application, not a bolted-on module — different auth system, different routing, different design system considerations (SEO, ISR) — but it shares the **same product catalog, the same inventory ledger, and the same database** as the POS. A product edited in the frontend, stock adjusted at a POS terminal, or an order placed on the storefront are all the same underlying data, seen from three different doors.

**Brand name:** PonnoSomver — set dynamically from `Organization.name`/`Organization.logo` in the database (Settings → Business Profile in the frontend), not hardcoded. See §3.3 and §5.

---

## 2. Architecture

### 2.1 Backend layering

The Django backend follows a strict layered dependency rule established in the original POS build: **an app may only import from a layer below it, never sideways or upward.**

```
Layer 1: core                                    (base models, no dependencies)
Layer 2: authz                                    (staff roles/permissions)
Layer 3: tenants                                  (Organization, Branch, Terminal)
Layer 4: staff, notifications, catalog, inventory (domain building blocks)
Layer 5: sales, purchases, expenses, ecommerce    (transactional apps — siblings, never import each other)
Layer 6: accounting                               (derives from layer 5)
Layer 7: reports                                  (read-only views over everything)
```

`ecommerce` sits at **layer 5**, alongside `sales`/`purchases`/`expenses`. It depends on `catalog` and `inventory` (layer 4) for products and stock, and on `tenants` (layer 3) for `Organization`/`Branch`. **It never imports `sales`** — a POS sale and an online order are deliberately separate concepts sharing the same inventory ledger underneath, not the same table.

### 2.2 Why a separate Next.js app instead of extending the Vite frontend

The frontend is an internal tool — no SEO need, always-authenticated, fine as a client-rendered SPA. The storefront is public-facing and benefits materially from server rendering: product pages need to be crawlable and fast on first load, category pages benefit from ISR (incremental static regeneration) rather than a full client fetch on every visit. Next.js's App Router does this well; Vite's SPA model does not, without significant extra tooling. This is the reason for two frontends instead of one, despite the added complexity of running three applications instead of two.

### 2.3 Data flow, at a glance

```
Customer browses/orders           Staff manages catalog/stock/branding
        │                                      │
        ▼                                      ▼
   Next.js Storefront                    Vite Frontend (POS)
        │                                      │
        │   (public API,                       │  (staff JWT,
        │    signed customer token)             │   feature permissions)
        ▼                                      ▼
        └──────────────► Django Backend ◄──────┘
                                │
                                ▼
                         PostgreSQL (one DB)
```

Both frontends talk to the same Django backend, through different authentication mechanisms (§3.5), but the same underlying `Product`, `StockMovement`, `Organization`, etc.

---

## 3. Backend Reference

### 3.1 Extended apps (pre-existing, modified for e-commerce)

**`apps/tenants`** — `Organization` gained a `logo` field:
```python
logo = models.FileField(
    upload_to="organization/", null=True, blank=True,
    validators=[FileExtensionValidator(allowed_extensions=["png","jpg","jpeg","webp","svg"])],
)
```
Deliberately `FileField` with an extension allowlist, not `ImageField` — `ImageField` validates through Pillow, which cannot decode SVG at all. Extension-based validation was chosen so SVG logos *could* work if needed. **Security note:** this is judged acceptable because the logo is (a) only ever rendered via `<img>` tags, where embedded SVG scripts don't execute, and (b) only uploadable by authenticated staff. Do not reuse this exact pattern (extension-only validation, SVG allowed) for any customer-facing upload — that would need real content sanitization.

**In practice, PNG is what's actually used** — both the storefront and the frontend currently display a PNG logo, not SVG, despite SVG being technically accepted. This was a deliberate choice after weighing the tradeoff (PNG has no script-execution risk under any rendering context, ever, regardless of how the image is used in the future — a more durable guarantee than "safe because nothing currently renders it unsafely"). The SVG allowance in the validator is a capability, not a recommendation; stick to PNG/JPEG/WebP for any future logo uploads unless there's a specific reason to reconsider.

**`apps/catalog`** — `Product` gained:
- `product_type`: `"simple"` | `"variant"`
- `slug`: auto-generated in `save()` from `name`. **Bulk `.objects.update()` bypasses `save()`** — if you ever bulk-edit products, slugs won't populate; use a loop with individual `.save()` calls instead.
- `is_published_online`: defaults to `False`. A product existing in the POS does not automatically appear on the storefront — this is a deliberate gate, not a bug when a product "doesn't show up."

New models: `ProductImage` (gallery — separate from `Product.image`, the single POS-grid thumbnail), `ProductVariant`, `VariantAttribute`, `VariantAttributeValue`.

**`apps/inventory`** — `StockMovement` and `StockLevel` both gained a nullable `variant` FK (`NULL` = simple product, unchanged behavior). `MOVEMENT_TYPES` gained `ecommerce_reservation`/`ecommerce_release`; `movement_type` is `max_length=30` (the string `"ecommerce_reservation"` is 21 characters — the original field was too narrow). `record_movement()`, `get_stock_level()`, `recalculate_stock_level()` all gained an optional `variant=None` kwarg — every existing POS/purchases call site is unaffected by this.

### 3.2 New app: `apps/ecommerce`

```
apps/ecommerce/
├── models.py        CustomerAccount, Address, Cart, CartItem, Order, OrderItem, Payment, HomeBanner
├── serializers.py    incl. public-facing serializers for the storefront
├── services.py       cart mutation, checkout, shipping/tax calculation, stock reservation
├── payments.py       PaymentProvider abstraction (COD real, others cosmetic)
├── views.py          CustomerTokenAuthentication + all API views
├── admin.py
└── urls.py
```

#### Models

**`CustomerAccount`** — `organization` FK, `email` (unique), `password_hash`, `full_name`, `phone`, `is_active`. Deliberately **not** `auth.User` — customers never intersect with staff `authz` roles/permissions. `set_password()`/`check_password()` methods, same hashing as Django's own.

**`Address`** — `customer` FK (nullable — a `null` customer means a guest checkout's one-off address), `label`, `full_name`, `phone`, `line1`, `line2`, `city`, `area`, `is_default`.

**`Cart`** — `organization` FK, `customer` FK (nullable), `session_key` (nullable — guest carts), `status` (`active`/`converted`/`abandoned`). `CheckConstraint` enforces customer-or-session-key at the DB level (uses `condition=`, not `check=` — Django 6.1 renamed this kwarg from earlier versions).

**`CartItem`** — `cart` FK, `product` FK, `variant` FK (nullable), `quantity`, `unit_price_snapshot`.

**`Order`** — `organization`, `fulfillment_branch` (currently a fixed setting, see §3.4), `customer` (nullable), `shipping_address`, `order_number` (`null` until payment confirms — a `pending_payment` order via a cosmetic method has no number yet), `status` (`pending_payment`/`confirmed`/`fulfilled`/`cancelled`/`refunded`), `guest_email`, `guest_phone`, `subtotal`, `shipping_cost`, `tax_amount`, `total`, `idempotency_key`.

**`OrderItem`** — snapshots everything that could change later: `product_name_snapshot`, `unit_price_snapshot`, `tax_rate_snapshot`. **This snapshot pattern is load-bearing** — an order must read correctly forever, even after the product is renamed, repriced, or its tax rate changes. `line_total` and `line_tax` are computed properties, not stored.

**`Payment`** — `order` FK, `method` (`cod`/`bkash`/`nagad`/`card`), `status` (`pending_collection`/`not_implemented`/`succeeded`/`failed`), `amount`, `provider_reference`.

**`HomeBanner`** — staff-managed hero banner: `title`, `subtitle`, `image`, `cta_label`, `cta_url`, `is_active`, optional `starts_at`/`ends_at` scheduling window, `sort_order`. **Django-admin-only** — `list_editable` on `is_active`/`sort_order` makes toggling/reordering quick there, but unlike `Organization.logo` (§5), **no frontend Settings page UI has been built for this yet.** A staff member managing banners needs direct Django admin access (`/admin/`), not just the frontend app. This is a real gap worth closing if non-technical staff need to manage banners — see §10.

**`WishlistItem`** — `customer` FK (required — deliberately account-only, no guest/session-keyed wishlist the way `Cart` has one; a wishlist is inherently about identity across visits, which a guest session can't meaningfully provide), `product` FK, `variant` FK (nullable). Unique per (customer, product, variant).

**`Review`** — `product` FK, `customer` FK, `rating` (1–5, validated), `comment`, `is_visible` (moderation safety net, default `True`). One review per (customer, product). **Verified-purchase gated**: `services.can_review_product()` requires at least one `OrderItem` for that product on an order with status `confirmed` or `fulfilled` for that customer — not merely added to a cart. Reviews publish immediately on submission; there's no pre-approval queue. This was a deliberate decision: verified-purchase was judged sufficient spam/abuse protection on its own, and a pre-publish queue would mostly just suppress real reviews with no real safety benefit. `is_visible` is the after-the-fact moderation tool (staff can hide a review via Django admin's `list_editable`, without deleting it).

#### Services (`services.py`)

- `add_to_cart()` / `update_cart_item_quantity()` — locks the cart row during mutation, merges repeated product+variant lines.
- `calculate_shipping(subtotal)` — flat rate, free above a threshold, **both settings-driven** (`ECOMMERCE_FLAT_SHIPPING_COST`, `ECOMMERCE_FREE_SHIPPING_THRESHOLD`). This is deliberately the simplest real shipping rule that exists, not a fake placeholder — swap it for weight/distance-based rates later without touching any caller.
- `calculate_tax(order_items)` — sums each line's real tax using `OrderItem.tax_rate_snapshot`, itself snapshotted from `Product.tax_rate` (a field that existed since the catalog extension but had no consumer until this).
- `checkout(cart, shipping_address, payment_method, organization, fulfillment_branch, customer, guest_email, guest_phone, idempotency_key)` — the critical transition:
  1. Locks the cart, validates it's non-empty and `active`.
  2. Computes `subtotal`, then `shipping_cost` via `calculate_shipping()`.
  3. Creates `Order` + `OrderItem` rows (snapshotting price/name/tax rate).
  4. Computes `tax_amount` from the now-created line items, updates `Order.total = subtotal + shipping_cost + tax_amount`.
  5. Reserves stock: calls `inventory.services.record_movement()` with `movement_type="ecommerce_reservation"`, a negative signed quantity, and an idempotency key derived from the order+item — safe against retries/double-submits.
  6. Creates a `Payment` row via the selected provider. For COD, the order is marked `confirmed` immediately and an `order_number` is assigned. For cosmetic methods, the order stays `pending_payment` — **the UI does not pretend a payment succeeded that didn't.**
  7. Marks the cart `converted`.
- `reserve_stock_for_order()` / `release_stock_for_order()` — the latter is used by `cancel_order()`, reversing the ledger entry (not deleting history).

#### Payments (`payments.py`)

Mirrors `apps.notifications.providers`'s abstraction on purpose — a pattern already established and trusted elsewhere in this codebase:

```python
class PaymentProvider(ABC):
    def initiate(self, order) -> PaymentResult: ...
    def verify(self, reference) -> PaymentStatus: ...

class CODProvider(PaymentProvider):      # real — no external call, confirms immediately
class CosmeticProvider(PaymentProvider):  # bkash/nagad/card — records intent, settles nothing
```

Swapping in a real gateway (SSLCommerz, bKash's actual API, etc.) means writing one new `PaymentProvider` subclass and updating `PAYMENT_PROVIDERS` in `payments.py` — no caller changes.

### 3.3 Authentication — two separate systems, deliberately

| | Staff (frontend/POS) | Customer (storefront) |
|---|---|---|
| Identity model | `auth.User` | `ecommerce.CustomerAccount` |
| Token | JWT (`djangorestframework-simplejwt`) | Signed token (`django.core.signing`) |
| Stateful? | Yes (JWT has a refresh cycle) | No — signing is tamper-proof but stateless, no DB session |
| Where issued | `POST /api/auth/token/` | `POST /api/storefront/auth/login/` |
| Header | `Authorization: Bearer <jwt>` | `Authorization: Bearer <signed-token>` |

**These must never be conflated.** `config/settings.py`'s `REST_FRAMEWORK.DEFAULT_AUTHENTICATION_CLASSES` is project-wide `JWTAuthentication` (for the staff-facing API). Every single view in `apps/ecommerce` explicitly overrides this:

```python
authentication_classes = [CustomerTokenAuthentication]
```

**This is not optional boilerplate.** Without it, a customer's signed token gets handed to `JWTAuthentication`, which tries to decode it as a JWT, fails, and raises an exception *before* `permissions.AllowAny` is ever checked — breaking guest browsing entirely, not just authenticated customer requests. This was a real bug hit early in this build; the fix is now standard on every ecommerce view and must stay that way on any new one.

There is no logout endpoint — the token is stateless, so "logging out" is simply deleting it client-side.

### 3.4 Multi-tenancy model — currently single org, single branch

The storefront resolves "which organization" and "which branch fulfills orders" via two flat settings, not per-request logic:

```python
ECOMMERCE_ORGANIZATION_ID = env("ECOMMERCE_ORGANIZATION_ID", default=None)
ECOMMERCE_FULFILLMENT_BRANCH_ID = env("ECOMMERCE_FULFILLMENT_BRANCH_ID", default=None)
```

This is a genuine scope limit, not an oversight: the schema (every relevant model already has proper `organization`/`branch` FKs) supports multi-org/multi-branch without a migration — what's missing is the *resolution logic* (subdomain routing, a branch-picker at checkout, etc.). If you need multi-branch fulfillment or multiple storefronts sharing this backend, that resolution logic is the actual feature to design and build; the data model is already ready for it.

### 3.5 Full API surface

All under `/api/storefront/` unless noted.

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `auth/register/` | POST | none | Optional `address` field creates a default `Address` |
| `auth/login/` | POST | none | Returns signed token |
| `auth/me/` | GET | customer | Own profile |
| `products/` | GET | none | `?search=`, `?category=`, `?min_price=`, `?max_price=`, `?ordering=latest\|price_asc\|price_desc\|name_asc` |
| `products/{slug}/` | GET | none | |
| `categories/` | GET | none | Distinct from staff-only `/api/catalog/categories/` |
| `home-banners/` | GET | none | Filters `is_active` + current time window |
| `organization/` | GET | none | Name/logo/contact — real storefront branding source |
| `shipping-config/` | GET | none | `{flat_shipping_cost, free_shipping_threshold}` — lets the frontend preview accurately without duplicating numbers |
| `cart/` | GET, POST | optional | Guest (session-keyed) or authenticated |
| `cart/items/{id}/` | PATCH, DELETE | optional | |
| `checkout/` | POST | optional | `shipping_address_id` (saved) OR inline `shipping_address` object (guest, one step) |
| `orders/` | GET | customer | Own order history |
| `orders/{id}/` | GET | none | Any holder of the UUID can view (bookmarkable confirmation link) |
| `orders/track/` | POST | none | `{order_number, contact}` — **both required**, see §8 |
| `wishlist/` | GET, POST | customer | POST toggles (add if absent, remove if present) — one endpoint, not separate add/remove routes |
| `products/{slug}/reviews/` | GET, POST | GET: none, POST: customer | GET includes `can_review`/`already_reviewed` when a token is present; POST enforces verified-purchase server-side regardless of what the client sends |

### 3.6 Backend conventions to follow for new features

These patterns are established throughout the codebase and should be followed, not reinvented, when adding to `apps/ecommerce`:

1. **Snapshot anything that must survive a later edit.** If a new feature stores a reference to mutable data (price, name, a rate, a status label) at a point in time, snapshot it onto the transactional record rather than joining live.
2. **Idempotency keys on anything that mutates the stock ledger.** Never call `record_movement()` without one.
3. **Settings over hardcoding for anything a business would want to tune.** Follow the `ECOMMERCE_*` naming pattern.
4. **Public serializers are hand-written, not raw `ModelSerializer`s of internal models.** `ProductPublicSerializer`, `CategoryPublicSerializer`, `OrganizationPublicSerializer` all deliberately expose a minimal, safe subset — don't expose a staff-facing serializer to a public endpoint.
5. **Cosmetic features must say so, honestly, in the response/UI — never fabricate.** A count with no real system behind it (e.g. a "people viewing this" counter) returns `0`, not a plausible-looking fake number. See §8 for the full list of what's currently cosmetic and how that's signaled.
6. **New `ecommerce` views must set `authentication_classes = [CustomerTokenAuthentication]` explicitly.** See §3.3.

---

## 4. Storefront Reference

### 4.1 Structure

```
storefront/
├── package.json          next, react, react-dom, lucide-react (^1.34.0+), jspdf, tailwindcss v4
├── lib/
│   ├── api.js             fetch wrapper, token storage, CART_UPDATED_EVENT/AUTH_CHANGED_EVENT
│   ├── pricing.js          calculateOrderTotals() — mirrors backend calculation exactly
│   ├── invoice.js          real PDF generation via jsPDF
│   └── locales/{en,bn}.json
├── app/
│   ├── layout.jsx          async Server Component: fetches Organization, sets dynamic title/favicon
│   ├── icon.png            static favicon fallback (when no org logo is set)
│   ├── globals.css         Tailwind v4 tokens + @custom-variant dark
│   ├── page.jsx             home: Hero + category rows + flash sale
│   ├── products/page.jsx    Shop: filters sidebar + grid
│   ├── products/[slug]/page.jsx   product detail
│   ├── cart/page.jsx
│   ├── checkout/page.jsx
│   ├── order/[id]/page.jsx  confirmation / order detail / invoice download
│   ├── account/orders/page.jsx  order history
│   └── track-order/page.jsx
└── components/            (see §4.4)
```

### 4.2 Rendering strategy

Pages that primarily display catalog data (`products/page.jsx`, `app/page.jsx`) are **Server Components** fetching directly from the Django API with `next: { revalidate: N }` — ISR, not full static generation, since the catalog changes. Interactive pages (cart, checkout, product detail's add-to-cart) are Client Components. `app/layout.jsx` itself is an **async Server Component** — it fetches `Organization` once per request (5-minute cache) so the header/footer/page title/favicon all reflect real branding without every page needing to re-fetch it.

`components/T.jsx` exists specifically so a Server Component can render translated text without itself becoming a Client Component — it's a one-line Client Component leaf that Server Components can drop inline.

### 4.3 Internationalization

Custom, dependency-light — no `next-intl`/`next-i18next`. `LanguageProvider.jsx` is a React Context holding the current locale (`en`/`bn`), persisted to `localStorage`. `t(key, values?)` does simple `{placeholder}` interpolation. Both locale files are kept in **exact key parity** — verify this with:

```bash
python3 -c "
import json
en = json.load(open('lib/locales/en.json'))
bn = json.load(open('lib/locales/bn.json'))
assert set(en) == set(bn), (set(en)-set(bn), set(bn)-set(en))
print('OK,', len(en), 'keys')
"
```

Run this after adding any new UI text. **Scope:** this system translates storefront UI chrome only — buttons, labels, messages. Product names/descriptions render in whatever language they were entered in Django; there's no `name_en`/`name_bn` field split (see §8).

### 4.4 Dark mode

Class-based (`@custom-variant dark (&:where(.dark, .dark *));` in `globals.css`), not OS-preference-only — `ThemeToggle.jsx` gives the user explicit control, defaulting to OS preference on first visit, then persisting to `localStorage`. An inline `<script>` in `layout.jsx` sets the `dark` class on `<html>` *before* React hydrates, to avoid a flash of the wrong theme — this is why `<html suppressHydrationWarning>` is set: React would otherwise (correctly, but unhelpfully) warn about the mismatch this script deliberately introduces.

### 4.5 Authentication

`AuthProvider.jsx` mirrors `LanguageProvider`'s pattern. On mount, it checks for a token (`hasAuthToken()`) *before* calling `GET /auth/me/` — avoids firing a doomed authenticated request on every single guest page load. Token storage genuinely respects "Remember me": checked → `localStorage` (persists across browser restarts), unchecked → `sessionStorage` (cleared when the tab closes) — this is real behavior, not a cosmetic checkbox. `AuthModal.jsx` combines sign-in and registration in one modal with tabs. **Guest checkout is always available regardless of auth state** — signing in is offered, never required, per an explicit product decision (see §8).

### 4.6 Cart/order pricing consistency

`lib/pricing.js`'s `calculateOrderTotals()` is deliberately the *same formula*, run client-side, as `apps.ecommerce.services.calculate_shipping()`/`calculate_tax()` on the backend — fed by the real settings via `GET /shipping-config/`, not duplicated hardcoded numbers. Both the cart page and checkout page's summary panels call this same function, so they never disagree with each other, and both should match what `checkout()` actually charges server-side (the backend remains the authority; the frontend is a preview computed from the same real inputs).

### 4.7 Invoice generation

`lib/invoice.js` generates a real PDF client-side via `jsPDF` — a genuine one-click file download, not a "use your browser's print dialog" workaround. Two things worth knowing if you touch this file:

- **Currency displays as `Tk`, not `৳`, inside the PDF only.** jsPDF's built-in fonts (Helvetica etc.) cannot render Bengali glyphs at all — passing `৳` silently substitutes a wrong character *and* miscalculates the text-width math used for right-alignment (a real bug this caused once). The rest of the storefront renders `৳` correctly; this is a jsPDF-specific limitation, not a project-wide currency decision.
- The logo is fetched and converted to a data URI before `doc.addImage()` — jsPDF cannot take a bare URL. The image format (PNG/JPEG/WebP) is detected from the data URI's MIME type rather than assumed.

### 4.8 Component reference

| Component | Real or cosmetic | Notes |
|---|---|---|
| `ProductCard` | Real (add-to-cart, wishlist) | Quick-add for simple products; variant products link to detail instead. Wishlist heart is real — opens sign-in if not authenticated |
| `ProductGallery` | Real | Main image + thumbnail strip |
| `ProductReviews` | Real | List, average rating, submission form gated server-side by verified purchase |
| `FiltersSidebar`, `FilterChips` | Real (search/category/price/sort) / cosmetic (Collection dropdown) | |
| `CategoryNav`, `CategoryRow` | Real | From `/categories/` |
| `HeroSection` | Real | From `/home-banners/`, honest placeholder when none configured |
| `FlashSaleSection` | Cosmetic (discount %, struck price, countdown) / Real (products, prices, add-to-cart, wishlist) | Own card component (`FlashSaleCard`), not `ProductCard` — keep this in sync manually if `ProductCard` changes (see §7.2) |
| `CartBadge` | Real | Live count, synced via `CART_UPDATED_EVENT` |
| `AccountMenu` | Real | Sign in / name+dropdown / Track Order link for guests |
| `AuthModal`, `AuthProvider` | Real | |
| `PaymentMethodTile` | Real (COD) / cosmetic (others, labeled "coming soon") | |
| `AnnouncementBar` | Cosmetic | Static copy, translated |
| `Footer` | Mixed — see §8 | |
| `LanguageSwitcher`, `ThemeToggle` | Real | |

---

## 5. Frontend (POS) Integration

The Vite frontend app was touched for the first time to support this project: **Settings → Business Profile** gained a logo upload control.

- `api/tenants.js`: `updateOrganization()` builds `multipart/form-data` only when a `File` is present (same `toRequestBody()` pattern as `api/catalog.js` uses for `Product.image` — reused, not reinvented).
- `pages/settings/Settings.jsx`: dashed-box upload + live preview, same UX pattern as the existing product image uploader.

This is the **only** source of the storefront's branding — there is no separate "storefront settings" screen. Whatever's set here (name, logo) propagates to the storefront header, footer, page title, browser tab favicon, and invoice PDFs automatically via `GET /api/storefront/organization/`.

**This is the only ecommerce-related feature added to the frontend.** Everything else staff-configurable for the storefront — most notably `HomeBanner` (§3.2) — is Django-admin-only right now. There is no unified "storefront management" screen in the frontend covering both; a staff member managing banners needs `/admin/` access specifically. Worth knowing before assuming a feature exists in the frontend just because a similar one does.

---

## 6. Local Development Setup

No Docker yet (see §9) — three processes, run directly.

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
# .env — see §11.1 for the full variable list
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver   # :8000
```

### Frontend (POS)
```bash
cd frontend
npm install
npm run dev   # :5173
```

### Storefront
```bash
cd storefront
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/storefront
npm run dev   # :3000
```

### First-time data setup
1. In Django admin, confirm/create your `Organization` and `Branch`, then set `ECOMMERCE_ORGANIZATION_ID`/`ECOMMERCE_FULFILLMENT_BRANCH_ID` in `backend/.env` to their UUIDs.
2. Mark at least one `Product` as `is_published_online=True` with a non-zero `selling_price` — otherwise the storefront's product list is legitimately empty (see §3.1's note on this gate).
3. Optionally upload an organization logo (Settings → Business Profile) to see real branding rather than the text fallback.

### Sanity checklist after any fresh setup
- `GET http://localhost:8000/api/storefront/products/` returns your published products.
- Add to cart → checkout with **Cash on Delivery** → confirms immediately with a real `order_number`.
- Check Django admin → `Inventory > Stock movements` for a new `ecommerce_reservation` row.
- Download the invoice PDF from the confirmation page and confirm totals match what the cart page showed.

---

## 7. Feature Development Guide

Use this section when asked to build something new in the storefront or its backend.

### 7.1 Before writing code

- **Does the data already exist?** Check §3.1–3.2 before assuming a new field is needed — several features in this build (tax, contact-us mailto) turned out to need zero new fields, just a consumer for data that was already there.
- **Is this genuinely buildable, or does it need a fake placeholder?** Default to real. If the backend truly can't support it yet (e.g. no promo/discount engine — see `FlashSaleSection`'s discount % and countdown), build the UI honestly labeled as not-yet-functional (see the `FlashSaleSection` header comment for the reference pattern) rather than faking the data. Never fabricate a number that looks real (a fake rating, a "12 people viewing this").
- **Does this touch pricing?** If yes, update `apps/ecommerce/services.py`'s calculation *and* `lib/pricing.js` together — they must stay in lockstep (§4.6). A change to one without the other is a real, easy-to-miss bug class in this codebase.

### 7.2 Known duplication to watch

`ProductCard.jsx` and `FlashSaleSection.jsx`'s `FlashSaleCard` are two separate components that both render a product tile (the latter needs the fake discount badge/strikethrough price, which doesn't fit `ProductCard`'s props cleanly). **When you change one** (add a feature like the wishlist heart, change hover behavior, fix a bug), **check whether the other needs the same change** — this has already caused one real inconsistency bug in this build (wishlist heart missing from Flash Sale cards) that had to be fixed after the fact.

### 7.3 Adding a new public API endpoint

1. Write a dedicated, minimal serializer if the endpoint is public-facing — don't expose an internal/staff serializer. Follow `OrganizationPublicSerializer`/`CategoryPublicSerializer` as the reference pattern (hand-picked fields, not `ModelSerializer` of everything).
2. Set `authentication_classes = [CustomerTokenAuthentication]` explicitly (§3.3).
3. Set `permission_classes` deliberately — `AllowAny` for public data, `IsAuthenticated` for customer-owned data.
4. Add the URL under `/api/storefront/`.
5. Add the corresponding call to `storefront/lib/api.js`.

### 7.4 Adding a new translated string

Add the key to **both** `lib/locales/en.json` and `lib/locales/bn.json` in the same pass — never one without the other. Run the parity check from §4.3 before considering the work done.

### 7.5 Translation quirks worth knowing

- Django 6.1 renamed `CheckConstraint`'s `check=` kwarg to `condition=` — if you add a new `CheckConstraint` anywhere, use `condition=`.
- Next.js 15: `params` and `searchParams` are `Promise`s, not plain objects, in both Server and Client Components. Server Components: `await searchParams`. Client Components: `const { id } = use(params)` (React's `use()` hook, not a `.then()`).
- `lucide-react` — pin to `^1.34.0` or later. The `0.400.x` range (used earlier in this build) is missing some icon names (`Funnel` notably) that were added in later releases; using an icon name that doesn't exist in the installed version fails silently at import (`undefined`) and crashes at render with a cryptic "Element type is invalid" error, not an import error.

---

## 8. Current Status — Real vs. Cosmetic vs. Not Built

### Real, working end to end
- Full catalog (images, variants, categories, search/filter/sort)
- Cart, checkout (guest or account), order creation with real stock reservation through the same ledger the POS uses
- Real shipping (flat rate + free threshold) and real tax (per-product `tax_rate`), both feeding into the order total the customer is actually charged
- Customer accounts (register/login/logout, order history with status filtering), guest checkout preserved alongside — **an explicit product decision**: accounts are offered, never required, because the customer module wasn't considered "done" enough to gate checkout behind it
- Order confirmation, guest order tracking by order number + contact (see caveat below), downloadable PDF invoices
- Real business branding (name/logo) sourced from one place (`Organization`, editable in the frontend) and reflected everywhere: header, footer, browser tab favicon, page title, invoices
- Wishlist (account-only) and product reviews (verified-purchase gated, published immediately) — both real, backed by their own models, no longer cosmetic
- Dark mode, EN/BN language toggle, cart badge — all genuinely functional, no backend involved
- Home page: real hero banner (staff-managed), real "New Arrivals"/category product rows

### Cosmetic — flagged in code comments, does not do what it visually implies
- **Flash Sale section** — the discount %, struck-through "original" price, and countdown timer are fabricated (no discount/promotion field exists on `Product`, no campaign system exists). The products shown and their prices are real; only the "sale" framing around them is decorative.
- **Cart promo code field** — accepts input, shows a "not live yet" message, validates nothing
- **"Collection" filter dropdown** — no collections/tags concept exists in the schema
- **Announcement bar** copy — static text, not tied to a real promotions system
- **bKash/Nagad/Card** payment methods — selectable, recorded on the order, settle nothing (`CosmeticProvider`)
- **Footer's "Deals" link, social icons** — no destination exists

### Known partial application — worth checking before assuming this is done
`Footer.jsx` has, at various points in this build, both had and not had the real `Organization` name/logo/mailto wiring applied, depending on which upload was being worked from. **Verify the deployed `Footer.jsx` actually uses the `org` prop (real branding) rather than the static `site_name` translation key before assuming this is finished.**

### Not built
- Real payment gateway integration (any actual bKash/SSLCommerz/etc. API call)
- Password reset / email verification for customer accounts
- Prefilling checkout from a signed-in customer's saved `Address` (signing in currently only helps with order history, not a faster checkout — the `Address` created at registration isn't consumed anywhere yet)
- Abandoned-cart / stock-reservation-expiry sweep (a cart can hold a stock reservation indefinitely if checkout is never completed — no cron/scheduled job releases it)
- Product name/description translation (`name_en`/`name_bn`-style fields don't exist — only storefront UI chrome is bilingual)
- Cart line-item product images (`CartItemSerializer` doesn't expose one — cart rows show a placeholder tile, not the product photo)
- Multi-branch fulfillment choice, multi-organization storefronts (see §3.4 — schema-ready, resolution logic not built)
- Rate limiting on any public endpoint (checkout, login, track-order, register are all currently unthrottled)

### Deliberate, logged design decision — revisit before cloud launch
**Guest order tracking (`POST /orders/track/`) requires both order number and contact info together**, not contact info alone. Looking up by contact info alone was considered (better UX for someone who lost their order number) and rejected for now: it would let anyone who knows or guesses someone's email/phone see their full order history (items, address, spending) with zero verification. **The intended fix, not yet built:** contact info → send a verification code (OTP, reusing `apps.notifications`'s existing provider abstraction) → then show matching orders. This was explicitly deferred until closer to a real cloud deployment with real customers — **do not ship the current contact-only-lookup UX to production without building the OTP step first**, if that variant is ever built.

---

## 9. Cloud Deployment Runbook

**Status: none of this has been implemented yet.** This section is guidance for when that work happens, not a description of the current state — local development (§6) is all that currently exists. Treat this as a checklist to work through, not a changelog.

### 9.1 Django backend — production settings

- `DEBUG = False`, with `ALLOWED_HOSTS` set to your real domain(s).
- `SECRET_KEY` from a secrets manager or environment variable injected at deploy time — never committed.
- `CORS_ALLOWED_ORIGINS` restricted to the real storefront/frontend production domains (currently includes `localhost` origins for dev — these must not ship to prod).
- `CSRF_TRUSTED_ORIGINS` set for the real domains if any cross-origin form posts rely on Django's session/CSRF machinery.
- Standard Django security headers/settings worth reviewing: `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_HSTS_SECONDS`.
- Move off SQLite/local Postgres to a managed database (RDS, Cloud SQL, managed Postgres of your choice) — update `DATABASE_URL`.

### 9.2 Media/static files — the most likely thing to silently break

Product images, `ProductImage` gallery photos, `HomeBanner` images, and `Organization.logo` are **currently stored on local disk** (`MEDIA_ROOT`). Most cloud platforms (Heroku-style PaaS, most container platforms without a persistent volume) have an **ephemeral filesystem** — anything written there disappears on the next deploy or restart. This will silently break every image in the system if not addressed before launch.

**Required before deployment:** move to object storage — S3, Google Cloud Storage, or a compatible alternative (Spaces, R2, etc.) — via `django-storages`. This changes `DEFAULT_FILE_STORAGE`/`STORAGES` and `MEDIA_URL` in `settings.py`; no changes needed to the models themselves (`ImageField`/`FileField` are storage-backend-agnostic).

### 9.3 Application servers

`runserver` is development-only. Production needs:
- **Backend:** `gunicorn` (WSGI) or `uvicorn`/`daphne` (ASGI) behind a reverse proxy (nginx, or your platform's equivalent) handling TLS termination.
- **Storefront:** `next build && next start` (a real Node process, not `next dev`), or deploy to a platform with native Next.js support (Vercel, etc.) — if you do, revisit the ISR `revalidate` intervals used throughout (`products/page.jsx`, `app/layout.jsx`'s organization fetch, etc.) against that platform's caching model.
- **Frontend:** `npm run build` produces a static bundle — serve it from a CDN/static host, it doesn't need a Node server at runtime.

### 9.4 Cross-origin cookies (guest cart)

The storefront's guest cart relies on a Django session cookie (`credentials: "include"` in `lib/api.js`'s fetch wrapper). In production, storefront and backend will likely be on different subdomains (e.g. `shop.example.com` and `api.example.com`). This requires correct `SameSite`, `Secure`, and cookie `domain` settings on the Django session cookie, or guest carts will silently fail to persist between requests. Test this specifically after deploying — it's the kind of thing that works perfectly in local dev (same-origin, `localhost`) and breaks only in production.

### 9.5 Environment variables to set per environment

See §11.1 for the full list. At minimum, these will differ between local/staging/production: `SECRET_KEY`, `DATABASE_URL`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `ECOMMERCE_ORGANIZATION_ID`, `ECOMMERCE_FULFILLMENT_BRANCH_ID`, `NEXT_PUBLIC_API_BASE_URL` (storefront).

### 9.6 Before accepting real orders

- Build the OTP-verified order tracking flow (§8's logged decision) if contact-only lookup is ever enabled.
- Add rate limiting to `checkout/`, `auth/login/`, `auth/register/`, `orders/track/` at minimum — currently unthrottled.
- Integrate at least one real payment provider — COD-only is a real limitation for many markets/order values.
- Build the abandoned-cart/reservation-expiry sweep, or reservations from incomplete cosmetic-payment checkouts will accumulate indefinitely against real stock.

### 9.7 Operational basics (not addressed anywhere in this build yet)

Backups, monitoring/alerting, structured logging, error tracking (Sentry or similar) — standard production concerns for any Django + Next.js system, not specific to this project, but worth a deliberate pass before launch since none of it has been set up.

---

## 10. Roadmap

Roughly in priority order, based on what would most affect a real launch:

1. **Deployment readiness** (§9) — nothing here works outside local dev yet; this blocks any real usage.
2. **Real payment gateway** — COD-only is the single biggest functional gap for a live store.
3. **OTP-verified order tracking** — logged decision, should land before or alongside deployment.
4. **Checkout personalization** — saved address prefill for signed-in customers; right now an account only helps after the fact (order history), not during checkout.
5. **Rate limiting** on public write endpoints.
6. **Abandoned-cart/reservation sweep.**
7. **Frontend HomeBanner management** — currently Django-admin-only (§5); add to the frontend's Settings area if non-technical staff need to manage hero banners without `/admin/` access.
8. `ProductListView` rating aggregation — currently one query per product via the reverse relation (`product.reviews`), not `annotate()`d. Fine at current catalog size; switch to `Product.objects.annotate(avg_rating=Avg("reviews__rating"), review_count=Count("reviews"))` if the product list grows large enough for this to matter.
9. Lower priority, genuinely optional: promo codes, product content translation, multi-branch fulfillment.

---

## 11. Appendix

### 11.1 Environment variables

**Backend (`backend/.env`)**
```
SECRET_KEY=
DEBUG=True                      # False in production
ALLOWED_HOSTS=
DATABASE_URL=
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
ECOMMERCE_ORGANIZATION_ID=      # UUID of the Organization row the storefront serves
ECOMMERCE_FULFILLMENT_BRANCH_ID=  # UUID of the Branch that fulfills online orders
ECOMMERCE_FLAT_SHIPPING_COST=60
ECOMMERCE_FREE_SHIPPING_THRESHOLD=2000
```

**Storefront (`storefront/.env.local`)**
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/storefront
```

### 11.2 Full storefront component/page file tree

See §4.1 and §4.8 above — kept together in one place rather than duplicated here.

### 11.3 Glossary of patterns referenced throughout this document

- **Snapshot pattern** — copying a value onto a transactional record at the moment it matters, rather than joining live, so history doesn't silently change (§3.2, `OrderItem`).
- **Ledger, not balance** — stock quantity is always derived from summing `StockMovement` rows; `StockLevel` is a cache of that sum, never the source of truth (inherited from the original POS design, extended here for variants).
- **Idempotency key** — a caller-supplied unique string that makes an operation safe to retry without double-applying (§3.2, stock reservation).
- **Settings-driven config** — a business-tunable value lives in `settings.py`/`.env`, not hardcoded in a function body (§3.4, shipping cost/threshold).
