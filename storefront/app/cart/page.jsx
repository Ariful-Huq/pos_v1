"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";
import { useLanguage } from "../../components/LanguageProvider";
import { Trash2, Plus, Minus, ArrowRight, ShieldCheck, Truck, Undo2 } from "lucide-react";

// The cart API doesn't embed a product image on line items today — this
// checks the couple of shapes that might eventually show up so the row
// upgrades automatically once the backend adds one, and falls back to a
// placeholder tile in the meantime (same idea as ProductGallery's fallback).
function itemImage(item) {
  return item.image || item.product_image || item.product?.image || null;
}

// SKU / variant (unit, size, color...) isn't on cart line items yet either —
// shown only when the data is actually there, nothing fabricated.
function itemMeta(item) {
  return item.variant_label || item.sku || null;
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
  const dividerClass = "border-gray-300 dark:border-gray-700";

  return (
    <div className="grid md:grid-cols-3 gap-8 items-start">
      {/* Your Cart — 2/3 width */}
      <div className="md:col-span-2">
        <h1 className={`font-heading text-2xl font-semibold mb-4 pb-4 border-b-2 ${dividerClass}`}>
          {t("cart_title")}
        </h1>

        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {cart.items.map((item) => {
            const image = itemImage(item);
            const meta = itemMeta(item);
            const lineTotal = (Number(item.unit_price_snapshot) * item.quantity).toFixed(2);
            return (
              <div key={item.id} className="flex items-start gap-4 py-4">
                <div className="w-16 h-16 shrink-0 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-md flex items-center justify-center overflow-hidden">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt={item.product_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-gray-400 text-center px-1">{t("no_image")}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Top line: name + delete icon */}
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.product_name}</p>
                    <button
                      onClick={() => remove(item.id)}
                      aria-label={t("remove")}
                      className="shrink-0 text-gray-400 hover:text-danger-600 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {meta && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{meta}</p>}

                  {/* Bottom line: qty stepper × unit price = total */}
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center border border-gray-300 dark:border-gray-700 rounded-md">
                      <button
                        type="button"
                        onClick={() => updateQty(item.id, Math.max(1, item.quantity - 1))}
                        aria-label={t("decrease_quantity")}
                        className="w-7 h-7 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-brand-600 disabled:opacity-40"
                        disabled={item.quantity <= 1}
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-8 text-center text-sm text-gray-900 dark:text-gray-100">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.id, item.quantity + 1)}
                        aria-label={t("increase_quantity")}
                        className="w-7 h-7 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-brand-600"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <span className="text-gray-400">×</span>
                    <span className="font-price text-sm text-gray-600 dark:text-gray-300">৳{item.unit_price_snapshot}</span>
                    <span className="text-gray-400 ml-auto">=</span>
                    <span className="font-price font-semibold text-gray-900 dark:text-gray-100">৳{lineTotal}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Link href="/products" className="inline-block mt-6 text-brand-600 text-sm no-underline hover:text-brand-700">
          ← {t("continue_shopping")}
        </Link>
      </div>

      {/* Order Summary — 1/3 width */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg px-5 pb-5 md:sticky md:top-6  pt-2">
        <h2 className={`font-heading text-xl font-semibold mb-3 pb-3 border-b-2 ${dividerClass} text-gray-900 dark:text-gray-100`}>
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

        <Link
          href="/checkout"
          className="mt-5 w-full bg-accent-500 text-white px-6 py-3 rounded-md font-medium hover:bg-accent-400 transition flex items-center justify-center gap-2"
        >
          {t("proceed_checkout")}
          <ArrowRight size={16} />
        </Link>

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

        <div className="flex items-center justify-center gap-6 text-gray-400 dark:text-gray-500 mt-5 pt-5 border-t border-gray-200 dark:border-gray-800">
          <span title={t("footer_secure_payment")}>
            <ShieldCheck size={18} />
          </span>
          <span title={t("footer_fast_shipping")}>
            <Truck size={18} />
          </span>
          <span title={t("easy_returns")}>
            <Undo2 size={18} />
          </span>
        </div>
      </div>
    </div>
  );
}
