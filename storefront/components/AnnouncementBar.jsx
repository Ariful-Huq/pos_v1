"use client";

import { useLanguage } from "./LanguageProvider";
import { Truck, Megaphone } from 'lucide-react';

// Cosmetic only — matches the screenshot's top banner. No promotions/deals
// system exists in the backend, so this is static (but translated) copy,
// not tied to real shipping thresholds or campaigns.
export default function AnnouncementBar() {
  const { t } = useLanguage();
  return (
    <div className="bg-brand-700 text-white text-xs max-w-6xl mx-auto px-6 py-1.5 flex items-center justify-between">
      <span className="flex items-center gap-2">
        <Truck className="h-4 w-4 scale-x-[-1]" />
        {t("announcement_shipping")}
      </span>
      <span className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 scale-x-[-1]" />
        {t("announcement_thanks")}
      </span>
    </div>
  );
}
