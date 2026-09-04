"use client";

import { createContext, useContext, useEffect, useState } from "react";
import en from "../lib/locales/en.json";
import bn from "../lib/locales/bn.json";

const dictionaries = { en, bn };
const STORAGE_KEY = "storefront_locale";

const LanguageContext = createContext({
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
});

function interpolate(template, values) {
  if (!values) return template;
  return Object.entries(values).reduce(
    (str, [k, v]) => str.replaceAll(`{${k}}`, v),
    template
  );
}

export function LanguageProvider({ children }) {
  const [locale, setLocaleState] = useState("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && dictionaries[stored]) setLocaleState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function setLocale(next) {
    if (!dictionaries[next]) return;
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  function t(key, values) {
    const dict = dictionaries[locale] || dictionaries.en;
    const template = dict[key] ?? dictionaries.en[key] ?? key;
    return interpolate(template, values);
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
