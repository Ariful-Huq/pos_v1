"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";
import { useLanguage } from "../../components/LanguageProvider";

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="6" width="14" height="11" rx="1" />
      <path d="M15 10h4l3 3v4h-7z" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="17.5" cy="19" r="2" />
    </svg>
  );
}

function ReturnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10h11a5 5 0 0 1 0 10h-2" />
      <path d="M7 6l-4 4 4 4" />
    </svg>
  );
}

// The cart API doesn't embed a product image on line items today — this
// checks the couple of shapes that might eventually show up so the row
// upgrades automatically once the backend adds one, and falls back to a
// placeholder tile in the meantime (same idea as ProductGallery's fallback).
function itemImage(item) {
  return item.image || item.product_image || item.product?.image || null;
}

export default function CartPage() {
  const { t } = useLanguage();
  const [cart, setCart] = useState(null);
  const [error, setError] = useState(null);
  const [promoCode, setPromoCode] = useState("");
  const [showPromoNote, setShowPromoNote] = useState(false);

  function load() {
    setError(null);
    api.cart().then(setCart).catch((err) => setError(err.message || "Failed to load cart."));
  }

  useEffect(load, []);

  async function updateQty(itemId, quantity) {
    await api.updateCartItem(itemId, quantity);
    load();
  }

  async function remove(itemId) {
    await api.removeCartItem(itemId);
    load();
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-danger-600 mb-4">{error}</p>
        <button onClick={load} className="text-brand-600 underline">
          {t("try_again")}
        </button>
      </div>
    );
  }
  if (!cart) return <p className="text-gray-500">{t("loading")}</p>;
  if (cart.items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">{t("cart_empty")}</p>
        <Link href="/products" className="text-brand-600 underline">
          {t("browse_products")}
        </Link>
      </div>
    );
  }

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="grid md:grid-cols-3 gap-8 items-start">
      {/* Your Cart — 2/3 width */}
      <div className="md:col-span-2">
        <h1 className="font-heading text-2xl font-semibold mb-4 pb-4 border-b border-gray-200 dark:border-gray-800">
          {t("cart_title")}
        </h1>

        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {cart.items.map((item) => {
            const image = itemImage(item);
            const lineTotal = (Number(item.unit_price_snapshot) * item.quantity).toFixed(2);
            return (
              <div key={item.id} className="flex items-center gap-4 py-4">
                <div className="w-16 h-16 shrink-0 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-md flex items-center justify-center overflow-hidden">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt={item.product_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-gray-400 text-center px-1">{t("no_image")}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.product_name}</p>
                  {item.variant_label && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.variant_label}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 shrink-0">
                  <input
                    type="number"
                    min={0}
                    value={item.quantity}
                    onChange={(e) => updateQty(item.id, Number(e.target.value))}
                    aria-label={t("quantity_label")}
                    className="w-14 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md px-2 py-1 text-center"
                  />
                  <span className="text-gray-400">×</span>
                  <span className="font-price">৳{item.unit_price_snapshot}</span>
                  <span className="text-gray-400">=</span>
                  <span className="font-price font-semibold text-gray-900 dark:text-gray-100">৳{lineTotal}</span>
                </div>

                <button
                  onClick={() => remove(item.id)}
                  aria-label={t("remove")}
                  className="shrink-0 p-2 text-gray-400 hover:text-danger-600 transition"
                >
                  <TrashIcon />
                </button>
              </div>
            );
          })}
        </div>

        <Link href="/products" className="inline-block mt-6 text-brand-600 text-sm no-underline hover:text-brand-700">
          ← {t("continue_shopping")}
        </Link>
      </div>

      {/* Order Summary — 1/3 width */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-5 md:sticky md:top-6">
        <h2 className="font-heading text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
          {t("order_summary_heading")}
        </h2>

        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between text-gray-600 dark:text-gray-300">
            <span>{t("subtotal_label", { count: itemCount })}</span>
            <span className="font-price">৳{cart.total}</span>
          </div>
          {/* No shipping/tax calculation exists yet — shown as cosmetic
              placeholders until the backend provides real values. */}
          <div className="flex justify-between text-gray-600 dark:text-gray-300">
            <span>{t("estimated_shipping_label")}</span>
            <span className="text-gray-400 dark:text-gray-500">{t("calculated_at_checkout")}</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-gray-300">
            <span>{t("estimated_tax_label")}</span>
            <span className="text-gray-400 dark:text-gray-500">{t("calculated_at_checkout")}</span>
          </div>
        </div>

        <div className="flex justify-between items-baseline mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
          <span className="font-medium text-gray-900 dark:text-gray-100">{t("total_label")}</span>
          <span className="font-price text-xl font-bold text-gray-900 dark:text-gray-100">৳{cart.total}</span>
        </div>

        {/* Promo codes aren't wired up to the backend yet — kept as a
            cosmetic control, same treatment as the collection filter
            elsewhere in this app, until that's built. */}
        <div className="mt-5">
          <label className="block text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400 uppercase mb-1.5">
            {t("promo_code_label")}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder={t("promo_code_placeholder")}
              className="flex-1 min-w-0 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm"
            />
            <button
              onClick={() => setShowPromoNote(true)}
              className="border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {t("promo_code_apply")}
            </button>
          </div>
          {showPromoNote && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">{t("promo_code_note")}</p>
          )}
        </div>

                <Link
          href="/checkout"
          className="mt-5 w-full bg-accent-500 text-white px-6 py-3 rounded-md font-medium hover:bg-accent-400 transition flex items-center justify-center gap-2"
        >
          {t("proceed_checkout")}
          <ArrowRightIcon />
        </Link>


        <div className="flex items-center justify-center gap-6 text-gray-400 dark:text-gray-500 mt-5 pt-5 border-t border-gray-200 dark:border-gray-800">
          <span title={t("footer_secure_payment")}>
            <ShieldIcon />
          </span>
          <span title={t("footer_fast_shipping")}>
            <TruckIcon />
          </span>
          <span title={t("easy_returns")}>
            <ReturnIcon />
          </span>
        </div>
      </div>
    </div>
  );
}
