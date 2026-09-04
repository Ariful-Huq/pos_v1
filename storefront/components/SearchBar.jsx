"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "./LanguageProvider";

export default function SearchBar() {
  const router = useRouter();
  const { t } = useLanguage();
  const [value, setValue] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const qs = value.trim() ? `?search=${encodeURIComponent(value.trim())}` : "";
    router.push(`/products${qs}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex-1 max-w-md hidden md:block">
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("search_placeholder")}
        className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md px-4 py-2 text-sm"
      />
    </form>
  );
}
