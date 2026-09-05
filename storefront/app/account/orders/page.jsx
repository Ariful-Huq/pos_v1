"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { api } from "../../../lib/api";
import { useAuth } from "../../../components/AuthProvider";
import { useLanguage } from "../../../components/LanguageProvider";

export default function OrdersPage() {
  const { isAuthenticated, isLoading: authLoading, openAuthModal } = useAuth();
  const { t } = useLanguage();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.orders().then(setOrders).catch((err) => setError(err.message));
  }, [isAuthenticated]);

  if (authLoading) return <p className="text-gray-500">{t("loading")}</p>;

  if (!isAuthenticated) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">{t("account_orders_signin_prompt")}</p>
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
  if (!orders) return <p className="text-gray-500">{t("loading")}</p>;

  if (orders.length === 0) {
    return (
      <div className="text-center py-16">
        <Package className="h-10 w-10 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 mb-4">{t("account_no_orders")}</p>
        <Link href="/products" className="text-brand-600 underline text-sm">
          {t("browse_products")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold mb-6 text-gray-900 dark:text-gray-100">
        {t("account_my_orders")}
      </h1>
      <div className="space-y-3">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/order/${order.id}`}
            className="block border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:shadow-md transition"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {order.order_number || t("account_order_pending_number")}
              </span>
              <span className="text-xs px-2 py-1 rounded-full bg-brand-50 dark:bg-gray-800 text-brand-700 dark:text-brand-400 capitalize">
                {order.status.replace("_", " ")}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>{new Date(order.created_at).toLocaleDateString()}</span>
              <span className="font-price">৳{order.total}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
