"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import PaymentMethodTile from "../../components/PaymentMethodTile";
import { useLanguage } from "../../components/LanguageProvider";

const emptyAddress = {
  full_name: "", phone: "", line1: "", line2: "", city: "", area: "",
};

export default function CheckoutPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [address, setAddress] = useState(emptyAddress);
  const [guestEmail, setGuestEmail] = useState("");
  const [method, setMethod] = useState("cod");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function updateField(field, value) {
    setAddress((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const order = await api.checkout({
        shipping_address: address,
        payment_method: method,
        guest_email: guestEmail,
        guest_phone: address.phone,
        idempotency_key: crypto.randomUUID(),
      });
      router.push(`/order/${order.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-heading text-2xl font-semibold mb-6">{t("checkout_title")}</h1>

      {method !== "cod" && (
        <p className="text-sm text-accent-500 mb-4">
          {t("checkout_not_live_notice")}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <input required placeholder={t("field_full_name")} value={address.full_name}
            onChange={(e) => updateField("full_name", e.target.value)}
            className="border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md px-3 py-2" />
          <input required placeholder={t("field_phone")} value={address.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            className="border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md px-3 py-2" />
        </div>
        <input placeholder={t("field_email_optional")} value={guestEmail}
          onChange={(e) => setGuestEmail(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md px-3 py-2" />
        <input required placeholder={t("field_address1")} value={address.line1}
          onChange={(e) => updateField("line1", e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md px-3 py-2" />
        <input placeholder={t("field_address2_optional")} value={address.line2}
          onChange={(e) => updateField("line2", e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md px-3 py-2" />
        <div className="grid grid-cols-2 gap-3">
          <input required placeholder={t("field_city")} value={address.city}
            onChange={(e) => updateField("city", e.target.value)}
            className="border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md px-3 py-2" />
          <input placeholder={t("field_area_optional")} value={address.area}
            onChange={(e) => updateField("area", e.target.value)}
            className="border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md px-3 py-2" />
        </div>

        <div>
          <p className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">{t("payment_method_label")}</p>
          <PaymentMethodTile selected={method} onSelect={setMethod} />
        </div>

        {error && <p className="text-danger-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-accent-500 text-white px-6 py-3 rounded-md font-medium hover:bg-accent-400 disabled:opacity-50"
        >
          {submitting ? t("placing_order") : t("place_order")}
        </button>
      </form>
    </div>
  );
}
