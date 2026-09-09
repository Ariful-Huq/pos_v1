"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { api } from "../../../lib/api";
import { downloadInvoice } from "../../../lib/invoice";
import { useLanguage } from "../../../components/LanguageProvider";

export default function OrderConfirmationPage({ params }) {
  // Next.js 15: params is a Promise even in Client Components — unwrap
  // with use(), same reasoning as the product detail page.
  const { id } = use(params);
  const { t } = useLanguage();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.order(id).then(setOrder).catch((err) => setError(err.message || "Failed to load order."));
  }, [id]);

  if (error) return <p className="text-danger-600">{error}</p>;
  if (!order) return <p className="text-gray-500">{t("loading")}</p>;

  const isConfirmed = order.status === "confirmed";

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadInvoice(order);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-heading text-2xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
        {isConfirmed ? t("order_confirmed") : t("order_received")}
      </h1>
      {order.order_number && (
        <p className="font-price text-gray-600 dark:text-gray-400 mb-4">#{order.order_number}</p>
      )}
      {!isConfirmed && (
        <p className="text-sm text-accent-500 mb-4">{t("order_pending_notice")}</p>
      )}

      <div className="border border-gray-200 dark:border-gray-800 rounded-lg divide-y divide-gray-200 dark:divide-gray-800 mb-4">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
            <span>{item.product_name_snapshot} × {item.quantity}</span>
            <span className="font-price">৳{(item.unit_price_snapshot * item.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* Real now — shipping_cost/tax_amount are computed and persisted
          server-side in services.checkout(), not estimates. */}
      <div className="space-y-1.5 text-sm mb-4">
        <div className="flex justify-between text-gray-600 dark:text-gray-400">
          <span>{t("subtotal_label_plain")}</span>
          <span className="font-price">৳{Number(order.subtotal).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-gray-600 dark:text-gray-400">
          <span>{t("estimated_shipping_label")}</span>
          <span className="font-price">
            {Number(order.shipping_cost) === 0 ? t("free_shipping") : `৳${Number(order.shipping_cost).toFixed(2)}`}
          </span>
        </div>
        <div className="flex justify-between text-gray-600 dark:text-gray-400">
          <span>{t("estimated_tax_label")}</span>
          <span className="font-price">৳{Number(order.tax_amount).toFixed(2)}</span>
        </div>
      </div>

      <p className="font-price text-lg font-semibold text-right mb-6 text-gray-900 dark:text-gray-100">
        {t("total", { value: Number(order.total).toFixed(2) })}
      </p>

      {!order.order_number ? null : (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 bg-gray-50 dark:bg-gray-800 rounded-md px-3 py-2">
          {t("order_track_hint", { number: order.order_number })}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/products"
          className="inline-block bg-accent-500 text-white px-6 py-3 rounded-md font-medium hover:bg-accent-400"
        >
          {t("continue_shopping")}
        </Link>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 px-6 py-3 rounded-md font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {downloading ? t("loading") : t("download_invoice")}
        </button>
      </div>
    </div>
  );
}
