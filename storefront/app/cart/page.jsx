"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";
import { useLanguage } from "../../components/LanguageProvider";

export default function CartPage() {
  const { t } = useLanguage();
  const [cart, setCart] = useState(null);
  const [error, setError] = useState(null);

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

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold mb-6">{t("cart_title")}</h1>
      <div className="divide-y divide-gray-200 dark:divide-gray-800 mb-6">
        {cart.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">{item.product_name}</p>
              <p className="font-price text-sm text-gray-500 dark:text-gray-400">৳{item.unit_price_snapshot}</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                value={item.quantity}
                onChange={(e) => updateQty(item.id, Number(e.target.value))}
                className="w-16 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md px-2 py-1"
              />
              <button onClick={() => remove(item.id)} className="text-danger-600 text-sm">
                {t("remove")}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Link href="/products" className="text-brand-600 text-sm">
          ← {t("continue_shopping")}
        </Link>
        <div className="flex items-center gap-6">
          <p className="font-price text-lg font-semibold text-gray-900 dark:text-gray-100">{t("total", { value: cart.total })}</p>
          <Link
            href="/checkout"
            className="bg-accent-500 text-white px-6 py-3 rounded-md font-medium hover:bg-accent-400"
          >
            {t("proceed_checkout")}
          </Link>
        </div>
      </div>
    </div>
  );
}
