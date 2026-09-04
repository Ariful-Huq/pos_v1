"use client";

import { useLanguage } from "./LanguageProvider";

// Deliberately shows the language you'd SWITCH TO, not the one currently
// active — while the page is in English, the button reads "BN"; click it
// and the page switches to Bangla, at which point the button reads "EN".
export default function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  const nextLocale = locale === "en" ? "bn" : "en";
  const label = nextLocale === "bn" ? "BN" : "EN";

  return (
    <button
      onClick={() => setLocale(nextLocale)}
      aria-label={nextLocale === "bn" ? "Switch to Bangla" : "Switch to English"}
      className="h-9 px-2 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 text-sm font-medium"
    >
      {label}
    </button>
  );
}
