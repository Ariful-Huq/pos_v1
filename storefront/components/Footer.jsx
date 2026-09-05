"use client";

import Link from "next/link";
import { useLanguage } from "./LanguageProvider";
import { ShieldCheck, Truck } from 'lucide-react';

// "Deals", social links, and the bottom trust-badge row are cosmetic —
// no deals/CMS/social-links system exists in the backend. Real links only
// where real destinations exist (Shop, Products).
export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 mt-16">
      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div>
          <p className="font-heading text-lg font-semibold text-brand-700 dark:text-brand-500 mb-2">Store</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("footer_tagline")}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase mb-3">{t("footer_shop_heading")}</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/products" className="text-gray-600 dark:text-gray-300 hover:text-brand-600">{t("footer_all_products")}</Link></li>
            <li><span className="text-gray-400 dark:text-gray-600">{t("footer_deals")}</span></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase mb-3">{t("footer_support_heading")}</p>
          <ul className="space-y-2 text-sm">
            <li><span className="text-gray-400 dark:text-gray-600">{t("footer_contact")}</span></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-200 dark:border-gray-800 max-w-6xl mx-auto px-6 py-4 text-xs text-gray-400 flex flex-wrap gap-4 justify-between">
        <span>© {new Date().getFullYear()} Store. {t("footer_rights")}</span>
        <span className="flex gap-4">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-green-500" />
            {t("footer_secure_payment")}
          </span>
          <span className="flex items-center gap-2">
            <Truck className="h-4 w-4 scale-x-[-1] text-teal-500" />
            {t("footer_fast_shipping")}
          </span>
        </span>
      </div>
    </footer>
  );
}
