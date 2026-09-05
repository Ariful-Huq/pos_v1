"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShoppingCart, Zap } from "lucide-react";
import { api } from "../lib/api";
import { useLanguage } from "./LanguageProvider";

/*
 * Cosmetic section, matching the reference screenshot's "Weekend Flash
 * Sale" block. Product has no discount/sale-price or promotion-window
 * field (see ecommerce SSOT §5 "not built"), so everything here except
 * `product.selling_price` and the Add to Cart action is fabricated purely
 * for visual purposes:
 *   - the per-item discount percentage
 *   - the struck-through "original" price (derived backwards from the
 *     real price + the fake percentage, so at least the math is internally
 *     consistent)
 *   - the countdown, which just runs from page-load time — there's no real
 *     campaign end date anywhere
 * Add to Cart still adds the item at its real selling_price. Swap this
 * section out once a real promotions/campaigns feature exists.
 */
const DEMO_DISCOUNTS = [15, 20, 25, 30];

function useCountdown(hoursFromNow) {
  const [deadline] = useState(() => new Date(Date.now() + hoursFromNow * 60 * 60 * 1000));
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, deadline - new Date()));

  useEffect(() => {
    const id = setInterval(() => {
      setRemainingMs(Math.max(0, deadline - new Date()));
    }, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const totalSeconds = Math.floor(remainingMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function FlashSaleCard({ product, discountPercent, t }) {
  const [status, setStatus] = useState("idle"); // idle | adding | added | error
  const isVariant = product.product_type === "variant";
  const fakeOriginalPrice = Math.round((product.selling_price / (1 - discountPercent / 100)) * 100) / 100;

  async function handleQuickAdd(e) {
    e.preventDefault();
    setStatus("adding");
    try {
      await api.addToCart({ product: product.id, variant: null, quantity: 1 });
      setStatus("added");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:shadow-md dark:hover:shadow-none dark:hover:border-gray-700 transition">
      <Link href={`/products/${product.slug}`} className="block group">
        <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-md mb-3 flex items-center justify-center text-gray-400 text-sm overflow-hidden">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt={product.name} className="w-full h-full object-cover rounded-md" />
          ) : (
            t("no_image")
          )}
        </div>
        <h3 className="font-medium text-sm mb-1 text-gray-900 dark:text-gray-100 truncate">{product.name}</h3>
      </Link>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="font-price text-sm text-brand-700 dark:text-brand-500">৳{product.selling_price}</span>
        <span className="font-price text-xs text-gray-400 dark:text-gray-500 line-through">৳{fakeOriginalPrice}</span>
        <span
          title={t("flash_sale_demo_note")}
          className="text-[11px] font-semibold text-danger-600 dark:text-danger-500 bg-danger-500/10 px-1.5 py-0.5 rounded"
        >
          −{discountPercent}%
        </span>
      </div>

      {isVariant ? (
        <Link
          href={`/products/${product.slug}`}
          className="block text-center border border-brand-500 text-brand-600 text-sm px-3 py-1.5 rounded-md hover:bg-brand-50"
        >
          {t("choose_options")}
        </Link>
      ) : (
        <button
          onClick={handleQuickAdd}
          disabled={status === "adding"}
          className="w-full bg-accent-500 text-white text-sm px-3 py-1.5 rounded-md font-medium hover:bg-accent-400 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <ShoppingCart size={14} className="shrink-0" />
          {status === "adding"
            ? t("adding")
            : status === "added"
            ? t("added")
            : status === "error"
            ? t("try_again")
            : t("add_to_cart")}
        </button>
      )}
    </div>
  );
}

export default function FlashSaleSection({ products, viewAllHref }) {
  const { t } = useLanguage();
  const { days, hours, minutes, seconds } = useCountdown(96); // static 4-day window from page load

  if (!products || products.length === 0) return null;

  return (
    <section className="mb-14">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-accent-500 uppercase mb-1">
            <Zap size={14} />
            {t("flash_sale_eyebrow")}
          </p>
          <h2 className="font-heading text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {t("flash_sale_title")}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t("flash_sale_ends_in")}{" "}
            <span className="font-price font-semibold text-gray-700 dark:text-gray-200">
              {days}d {pad(hours)}:{pad(minutes)}:{pad(seconds)}
            </span>
          </p>
        </div>
        <Link
          href={viewAllHref}
          className="flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-500 hover:text-brand-700 shrink-0"
        >
          {t("view_all")}
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {products.slice(0, 4).map((product, i) => (
          <FlashSaleCard
            key={product.id}
            product={product}
            discountPercent={DEMO_DISCOUNTS[i % DEMO_DISCOUNTS.length]}
            t={t}
          />
        ))}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">{t("flash_sale_demo_note")}</p>
    </section>
  );
}
