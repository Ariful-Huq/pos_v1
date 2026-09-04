"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "../lib/api";
import { useLanguage } from "./LanguageProvider";
import { Heart } from 'lucide-react';

export default function ProductCard({ product }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState("idle"); // idle | adding | added | error
  const [wishlisted, setWishlisted] = useState(false); // local cosmetic state
  const isVariant = product.product_type === "variant";

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

  function toggleWishlist() {
    // TODO: wire to real wishlist API when available
    setWishlisted((w) => !w);
  }

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:shadow-md dark:hover:shadow-none dark:hover:border-gray-700 transition">
      <Link href={`/products/${product.slug}`} className="block group">
        <div className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-md mb-3 flex items-center justify-center text-gray-400 text-sm overflow-hidden">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt={product.name} className="w-full h-full object-cover rounded-md" />
          ) : (
            t("no_image")
          )}

          {/* Wishlist button: shown on hover/focus of the image area */}
          <button
            type="button"
            onClick={toggleWishlist}
            className="absolute top-2 right-2 p-2 rounded-full bg-white/90 dark:bg-gray-900/80 text-gray-700 dark:text-gray-200 opacity-0 group-hover:opacity-100 focus:opacity-100 transition shadow hover:text-green-700 focus:text-green-700"
            aria-label="Toggle wishlist"
          >
            <Heart
              className="h-4 w-4"
              fill={wishlisted ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={2}
            />
          </button>
        </div>

        <h3 className="font-medium text-sm mb-1 text-gray-900 dark:text-gray-100">{product.name}</h3>
        <p className="font-price text-sm text-brand-700 dark:text-brand-500 mb-3">৳{product.selling_price}</p>
      </Link>

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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
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