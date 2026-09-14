"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, ShoppingCart, X } from "lucide-react";
import { api } from "../../../lib/api";
import { useAuth } from "../../../components/AuthProvider";
import { useWishlist } from "../../../components/WishlistProvider";
import { useLanguage } from "../../../components/LanguageProvider";

export default function WishlistPage() {
  const { isAuthenticated, isLoading: authLoading, openAuthModal } = useAuth();
  const { toggle } = useWishlist();
  const { t } = useLanguage();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  function load() {
    api.wishlist().then(setItems).catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated]);

  async function handleRemove(item) {
    setBusyId(item.id);
    try {
      await toggle(item.product);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddToCart(item) {
    setBusyId(item.id);
    try {
      await api.addToCart({ product: item.product.id, variant: item.variant, quantity: 1 });
    } finally {
      setBusyId(null);
    }
  }

  if (authLoading) return <p className="text-gray-500">{t("loading")}</p>;

  if (!isAuthenticated) {
    return (
      <div className="text-center py-16">
        <Heart className="h-10 w-10 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 mb-4">{t("wishlist_signin_prompt")}</p>
        <button
          onClick={() => openAuthModal("login")}
          className="bg-accent-500 text-white px-6 py-3 rounded-md font-medium hover:bg-accent-400"
        >
          {t("account_sign_in")}
        </button>
      </div>
    );
  }

  if (error) return <p className="text-danger-600 text-sm">{error}</p>;
  if (!items) return <p className="text-gray-500">{t("loading")}</p>;

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <Heart className="h-10 w-10 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 mb-4">{t("wishlist_empty")}</p>
        <Link href="/products" className="text-brand-600 underline text-sm">
          {t("browse_products")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold mb-6 text-gray-900 dark:text-gray-100">
        {t("wishlist_heading")}
      </h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
            <Link href={`/products/${item.product.slug}`} className="block relative">
              <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-md mb-3 flex items-center justify-center text-gray-400 text-sm overflow-hidden">
                {item.product.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                ) : (
                  t("no_image")
                )}
              </div>
              <h3 className="font-medium text-sm mb-1 text-gray-900 dark:text-gray-100 truncate">{item.product.name}</h3>
              <p className="font-price text-sm text-brand-700 dark:text-brand-500 mb-3">৳{item.product.selling_price}</p>
            </Link>
            <div className="flex gap-2">
              <button
                onClick={() => handleAddToCart(item)}
                disabled={busyId === item.id}
                className="flex-1 flex items-center justify-center gap-1.5 bg-accent-500 text-white text-xs px-2 py-2 rounded-md font-medium hover:bg-accent-400 disabled:opacity-50"
              >
                <ShoppingCart className="h-3.5 w-3.5" /> {t("add_to_cart")}
              </button>
              <button
                onClick={() => handleRemove(item)}
                disabled={busyId === item.id}
                aria-label={t("remove")}
                className="px-2.5 border border-gray-300 dark:border-gray-700 rounded-md text-gray-500 hover:text-danger-600 hover:border-danger-300 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
