"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../components/LanguageProvider";

export default function OrderConfirmationPage({ params }) {
  // Next.js 15: params is a Promise even in Client Components — unwrap
  // with use(), same reasoning as the product detail page.
  const { id } = use(params);
  const { t } = useLanguage();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.order(id).then(setOrder).catch((err) => setError(err.message || "Failed to load order."));
  }, [id]);

  if (error) return <p className="text-danger-600">{error}</p>;
  if (!order) return <p className="text-gray-500">{t("loading")}</p>;

  const isConfirmed = order.status === "confirmed";

  return (
    <div className="max-w-xl">
      <h1 className="font-heading text-2xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
        {isConfirmed ? t("order_confirmed") : t("order_received")}
      </h1>
      {order.order_number && (
        <p className="font-price text-gray-600 dark:text-gray-400 mb-4">#{order.order_number}</p>
      )}
      {!isConfirmed && (
        <p className="text-sm text-accent-500 mb-4">
          {t("order_pending_notice")}
        </p>
      )}

      <div className="border border-gray-200 dark:border-gray-800 rounded-lg divide-y divide-gray-200 dark:divide-gray-800 mb-4">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
            <span>{item.product_name_snapshot} × {item.quantity}</span>
            <span className="font-price">৳{item.unit_price_snapshot * item.quantity}</span>
          </div>
        ))}
      </div>

      <p className="font-price text-lg font-semibold text-right mb-6 text-gray-900 dark:text-gray-100">{t("total", { value: order.total })}</p>

      <Link
        href="/products"
        className="inline-block bg-accent-500 text-white px-6 py-3 rounded-md font-medium hover:bg-accent-400"
      >
        {t("continue_shopping")}
      </Link>
    </div>
  );
}
