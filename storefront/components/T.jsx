"use client";

import { useLanguage } from "./LanguageProvider";

// Drop-in translated text for use inside Server Components that don't
// otherwise need to be client-side (e.g. app/products/page.jsx, which
// fetches server-side for ISR — converting the whole page to a Client
// Component just to translate a couple of headings would throw away that).
export default function T({ id, values }) {
  const { t } = useLanguage();
  return t(id, values);
}
