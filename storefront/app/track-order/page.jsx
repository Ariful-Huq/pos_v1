"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { api } from "../../lib/api";
import { useLanguage } from "../../components/LanguageProvider";

export default function TrackOrderPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [orderNumber, setOrderNumber] = useState("");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const order = await api.trackOrder({ order_number: orderNumber.trim(), contact: contact.trim() });
      router.push(`/order/${order.id}`);
    } catch (err) {
      setError(err.message || t("generic_error"));
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md px-3 py-2.5";

  return (
    <div className="max-w-md mx-auto py-8">
      <div className="text-center mb-6">
        <div className="mx-auto w-12 h-12 rounded-xl bg-brand-50 dark:bg-gray-800 flex items-center justify-center mb-3">
          <Search className="h-6 w-6 text-brand-700 dark:text-brand-500" />
        </div>
        <h1 className="font-heading text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
          {t("track_order_title")}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("track_order_subtitle")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t("track_order_number_label")}</label>
          <input
            required
            placeholder="WEB-20260907-C4F0BDC7"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t("track_order_contact_label")}</label>
          <input
            required
            placeholder={t("track_order_contact_placeholder")}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            className={inputClass}
          />
        </div>

        {error && <p className="text-danger-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-accent-500 text-white px-6 py-3 rounded-md font-medium hover:bg-accent-400 disabled:opacity-50"
        >
          {submitting ? t("loading") : t("track_order_submit")}
        </button>
      </form>
    </div>
  );
}
