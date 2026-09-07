# pos_v1 → E-commerce Extension — Single Source of Truth (v5)

**Companion to:** `pos-v1-single-source-of-truth.md`
**Supersedes:** v1–v4.
**Basis for this version:** complete file-by-file diff of your `backend.zip`/`frontend.zip`/`storefront.zip` uploaded 2026-09-06, every file checked (not spot-checked — v4 missed that `cart/page.jsx` had drifted from my reference copy; this pass diffed everything to avoid repeating that).

---

## 1. Confirmed decisions (unchanged)

| Question     | Decision                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------- |
| Backend      | One Django project. `ecommerce` app at layer 5, alongside `sales`/`purchases`/`expenses`. |
| Fulfillment  | Single branch via `ECOMMERCE_FULFILLMENT_BRANCH_ID` (Main Branch, DHK-01).                |
| Organization | Single org via `ECOMMERCE_ORGANIZATION_ID`.                                               |
| Payments     | COD real. bKash/Nagad/Card recorded but not processed.                                    |
| Checkout     | Guest checkout (inline address) + account system (now with a working UI — see §3).        |
| Frontend     | Next.js 15 App Router at `pos_v1/storefront/`.                                            |

---

## 2. Backend — what's new since v4

Everything from v4 is untouched (re-confirmed by diff). One real addition:

### `HomeBanner` (new model, `apps/ecommerce/`)

Staff-managed hero banner for the storefront home page — title, subtitle, image, CTA label/URL, `is_active`, optional `starts_at`/`ends_at` scheduling window, `sort_order`. Migration `0002_homebanner.py` applied.

- `GET /api/storefront/home-banners/` — public. Filters to `is_active=True` and currently inside the optional time window, ordered by `sort_order`. Returns `[]` cleanly when nothing's configured (the storefront handles that — see §3).
- Registered in `catalog... ` — no, in `apps/ecommerce/admin.py` with `list_editable = ("is_active", "sort_order")`, so toggling a banner on/off or reordering doesn't even need the detail page.
- This is genuinely useful: swapping a sale banner in/out is now a Django admin edit, not a code change or redeploy.

### `CustomerRegisterSerializer` (from the previous round, confirmed unchanged)

Still accepts optional `address` → creates a default `Address` row for the new customer.

### Confirmed unchanged (diffed, zero functional drift)

`apps/catalog/*`, `apps/inventory/*`, `config/settings.py`, `config/urls.py`, and the rest of `apps/ecommerce/*` — only cosmetic reformatting (your toolchain re-wraps long lines) in a few files, no behavior change.

---

## 3. Storefront — what's new since v4

### Home page (`app/page.jsx`) — fully rebuilt, no longer a placeholder

Server-rendered, fetches `/categories/`, `/products/?ordering=latest`, and `/home-banners/` in parallel (same ISR pattern as the Shop page — revalidates at most once a minute). Composes three new components:

- **`HeroSection.jsx`** — shows the active `HomeBanner` if one exists (image, title, subtitle, CTA all real, from the database). When none is configured, shows an honest dashed-border placeholder with an icon — not a fake stock photo standing in for a real banner.
- **`FlashSaleSection.jsx`** — explicitly, deliberately cosmetic, and says so in its own header comment: the discount percentage, the struck-through "original" price, and the countdown timer are all fabricated (there's no discount/promotion field on `Product`, no campaign-end-date anywhere). The countdown just runs from page-load. **What's real:** the products shown and their actual `selling_price`, and Add to Cart adds at the real price — the fakery is purely cosmetic dressing on real inventory, not a fake product or a fake price paid.
- **`CategoryRow.jsx`** — fully real, no caveats. Reused for "New Arrivals" (first 4 of the latest-ordered products) and for one row per active category that currently has published products. Nothing hardcoded — it scales with whatever's actually in the catalog.

### Cart page (`app/cart/page.jsx`) — confirmed, this is the v4-documented rebuild

(My v4 reference copy of this file had gone stale without me realizing — now re-synced.) Two-column layout: line items with quantity stepper + remove (left), sticky Order Summary with real subtotal/total, cosmetic shipping/tax placeholders and promo code field, and Secure Payment/Fast Shipping/Easy Returns trust icons (right).

### Minor tweaks (cosmetic, no behavior change)

- `AnnouncementBar.jsx`'s truck icon flipped horizontally (`scale-x-[-1]`)
- `AccountMenu.jsx`'s width class normalized (`max-w-[8rem]` → `max-w-32`, equivalent)
- Alignment fixes from last session (header/announcement/category-nav/footer all constrained to `max-w-6xl mx-auto`, matching `<main>`) — confirmed present and correct.

### Locale files

148 keys in both `en.json` and `bn.json`. **Perfect parity checked programmatically** — zero keys present in one file and missing from the other, in either direction.

---

## 4. What's real vs. cosmetic (consolidated, current)

**Real:**

- Full catalog (images, variants, categories), search/filter/sort, cart, checkout, order creation + stock reservation
- Dark mode, EN/BN toggle, cart badge, customer accounts (sign in/register/sign out, order history)
- Home page: hero banner (staff-managed via admin), New Arrivals, per-category rows
- Buy Now, Copy Link, quantity stepper, related products

**Cosmetic (flagged in code, not wired to anything):**

- Announcement bar copy, "Collection" filter dropdown, footer Deals/Contact/social links and trust badges
- bKash/Nagad/Card payment methods
- Wishlist heart on product cards
- Promo code field (cart)
- Reviews tab / review count
- Flash Sale section's discount %, struck-through price, and countdown

**Not built:**

- Real payment gateway integration
- Password reset / email verification
- Prefilling checkout from a signed-in customer's saved address (a sign-in banner at checkout offers the account, but doesn't yet autofill the form from a saved `Address`)
- Abandoned-cart / reservation-expiry sweep
- Product name/description translation
- Cart line-item product images (`CartItemSerializer` still doesn't expose one)
- Multi-branch fulfillment choice, multi-org storefronts

---

## 5a. Round: real shipping, real tax/VAT, PDF invoice, optional sign-in at checkout

**Requires a migration** — `Order.shipping_cost`/`tax_amount` and `OrderItem.tax_rate_snapshot` are new model fields.

- Shipping is now real: flat rate, free above a threshold, both via settings (`ECOMMERCE_FLAT_SHIPPING_COST`, `ECOMMERCE_FREE_SHIPPING_THRESHOLD`) — the same config-driven pattern as `ECOMMERCE_FULFILLMENT_BRANCH_ID`.
- Tax is now real: `Product.tax_rate` existed since the catalog extension early in this build but nothing used it until now. Each `OrderItem` snapshots the rate at order time (so a later rate change doesn't rewrite history), and `services.calculate_tax()` sums it per line.
- New public endpoint `GET /shipping-config/` lets the frontend preview shipping/tax accurately (`lib/pricing.js`) without duplicating the backend's numbers — cart and checkout show identical figures, and checkout's server-side total is the actual authority.
- Order confirmation page has a real "Download Invoice" button — genuine client-side PDF generation via `jspdf` (new dependency), built directly from the real order data (items, shipping address, subtotal/shipping/tax/total). Not a print-dialog workaround.
- Checkout gained an optional "Sign in for faster checkout" prompt. Per your explicit decision, **guest checkout is unchanged and still fully functional** — the prompt is dismissible and never blocks the form.

---

## 6. Artifact cleanup

Checked for stale/superseded files in what I'm tracking on my end — found nothing to remove. Current tracked structure: `docs/` (this file), `backend_ecommerce_app/` (full app + migrations), `real_file_updates/` (catalog/inventory/settings/urls), `storefront/` (full app). Nothing orphaned.

---

## 7. Everything's synced — no outstanding file requests

Every file in your uploads was checked against what I had; my reference copies are byte-equivalent (modulo formatting) to your actual codebase, now including this round's shipping/tax/invoice work. Same offer as always going forward: re-upload for a full re-sync, or paste the specific changed file.
