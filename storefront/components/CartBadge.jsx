"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, CART_UPDATED_EVENT } from "../lib/api";
import { useLanguage } from "./LanguageProvider";

export default function CartBadge() {
  const { t } = useLanguage();
  const [count, setCount] = useState(0);

  function refresh() {
    api.cart()
      .then((cart) => setCount(cart.items.reduce((sum, i) => sum + i.quantity, 0)))
      .catch(() => setCount(0));
  }

  useEffect(() => {
    refresh();
    window.addEventListener(CART_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(CART_UPDATED_EVENT, refresh);
  }, []);

  return (
    <Link
      href="/cart"
      className="relative h-9 flex items-center gap-2 bg-accent-500 text-white px-4 rounded-md text-sm font-medium hover:bg-accent-400"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      {t("cart_label")}
      {count > 0 && (
        <span className="absolute -top-2 -right-2 bg-brand-700 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
          {count}
        </span>
      )}
    </Link>
  );
}
