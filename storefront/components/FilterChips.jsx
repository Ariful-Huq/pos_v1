"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";
import { useLanguage } from "./LanguageProvider";

export default function FilterChips({ params }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (params?.category) {
      api.categories().then(setCategories).catch(() => setCategories([]));
    }
  }, [params?.category]);

  const chips = [];
  if (params?.search) chips.push({ key: "search", label: t("chip_search", { value: params.search }) });
  if (params?.category) {
    const match = categories.find((c) => c.id === params.category);
    chips.push({ key: "category", label: match ? match.name : t("chip_category") });
  }
  if (params?.min_price) chips.push({ key: "min_price", label: t("chip_min", { value: params.min_price }) });
  if (params?.max_price) chips.push({ key: "max_price", label: t("chip_max", { value: params.max_price }) });

  if (chips.length === 0) return null;

  function removeChip(key) {
    const next = new URLSearchParams(params);
    next.delete(key);
    const qs = next.toString();
    router.push(`/products${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-2 bg-brand-50 dark:bg-gray-800 text-brand-700 dark:text-brand-400 text-xs px-3 py-1.5 rounded-full"
        >
          {chip.label}
          <button onClick={() => removeChip(chip.key)} aria-label={`Remove ${chip.label} filter`} className="hover:text-danger-600">
            ✕
          </button>
        </span>
      ))}
      <button
        onClick={() => router.push("/products")}
        className="text-xs text-danger-600 underline px-1"
      >
        {t("reset_all")}
      </button>
    </div>
  );
}
