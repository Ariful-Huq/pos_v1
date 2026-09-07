"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { api } from "../../lib/api";
import { calculateOrderTotals } from "../../lib/pricing";
import PaymentMethodTile from "../../components/PaymentMethodTile";
import { useLanguage } from "../../components/LanguageProvider";
import { useAuth } from "../../components/AuthProvider";

const emptyAddress = {
  full_name: "", phone: "", line1: "", line2: "", city: "", area: "",
};

export default function CheckoutPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isAuthenticated, customer, openAuthModal } = useAuth();
  const [address, setAddress] = useState(emptyAddress);
  const [guestEmail, setGuestEmail] = useState("");
  const [method, setMethod] = useState("cod");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [cart, setCart] = useState(null);
  const [shippingConfig, setShippingConfig] = useState(null);

  useEffect(() => {
    api.cart().then(setCart).catch(() => setCart(null));
    api.shippingConfig().then(setShippingConfig).catch(() => setShippingConfig(null));
  }, []);

  // Signing in mid-checkout (via the banner below) doesn't lose anything
  // typed so far — just prefills email once a session appears.
  useEffect(() => {
    if (isAuthenticated && customer?.email && !guestEmail) {
      setGuestEmail(customer.email);
    }
  }, [isAuthenticated, customer]);

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

  const totals = cart ? calculateOrderTotals(cart.items, shippingConfig) : null;
  const inputClass =
    "border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md px-3 py-2";

  return (
    <div className="grid md:grid-cols-3 gap-8 items-start">
      <div className="md:col-span-2">
        <h1 className="font-heading text-2xl font-semibold mb-6 text-gray-900 dark:text-gray-100">
          {t("checkout_title")}
        </h1>

        {/* Optional, not required — guest checkout still works below
            regardless of whether this is dismissed or ignored. */}
        {!isAuthenticated && (
          <div className="flex items-center justify-between gap-4 bg-brand-50 dark:bg-gray-800 border border-brand-100 dark:border-gray-700 rounded-lg px-4 py-3 mb-6">
            <p className="text-sm text-brand-700 dark:text-brand-400">{t("checkout_signin_prompt")}</p>
            <button
              type="button"
              onClick={() => openAuthModal("login")}
              className="shrink-0 flex items-center gap-1.5 text-sm font-medium text-brand-700 dark:text-brand-400 hover:underline"
            >
              <LogIn className="h-4 w-4" /> {t("account_sign_in")}
            </button>
          </div>
        )}

        {method !== "cod" && (
          <p className="text-sm text-accent-500 mb-4">{t("checkout_not_live_notice")}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder={t("field_full_name")} value={address.full_name}
              onChange={(e) => updateField("full_name", e.target.value)} className={inputClass} />
            <input required placeholder={t("field_phone")} value={address.phone}
              onChange={(e) => updateField("phone", e.target.value)} className={inputClass} />
          </div>
          <input placeholder={t("field_email_optional")} value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)} className={`w-full ${inputClass}`} />
          <input required placeholder={t("field_address1")} value={address.line1}
            onChange={(e) => updateField("line1", e.target.value)} className={`w-full ${inputClass}`} />
          <input placeholder={t("field_address2_optional")} value={address.line2}
            onChange={(e) => updateField("line2", e.target.value)} className={`w-full ${inputClass}`} />
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder={t("field_city")} value={address.city}
              onChange={(e) => updateField("city", e.target.value)} className={inputClass} />
            <input placeholder={t("field_area_optional")} value={address.area}
              onChange={(e) => updateField("area", e.target.value)} className={inputClass} />
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

      {/* Order summary — same real calculation as the cart page (see
          lib/pricing.js), so what's shown here matches what checkout()
          actually charges server-side. */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-5 md:sticky md:top-6">
        <h2 className="font-heading text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
          {t("order_summary_heading")}
        </h2>
        {!totals ? (
          <p className="text-sm text-gray-400">{t("loading")}</p>
        ) : (
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>{t("subtotal_label", { count: cart.items.reduce((s, i) => s + i.quantity, 0) })}</span>
              <span className="font-price">৳{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>{t("estimated_shipping_label")}</span>
              <span className="font-price">
                {totals.shipping === 0 ? t("free_shipping") : `৳${totals.shipping.toFixed(2)}`}
              </span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>{t("estimated_tax_label")}</span>
              <span className="font-price">৳{totals.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-baseline mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
              <span className="font-medium text-gray-900 dark:text-gray-100">{t("total_label")}</span>
              <span className="font-price text-xl font-bold text-gray-900 dark:text-gray-100">৳{totals.total.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
