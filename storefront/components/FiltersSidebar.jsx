"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "../lib/api";
import { useLanguage } from "./LanguageProvider";
import { Funnel } from 'lucide-react';

export default function FiltersSidebar() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [minPrice, setMinPrice] = useState(searchParams.get("min_price") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("max_price") || "");
  const [ordering, setOrdering] = useState(searchParams.get("ordering") || "latest");
  // Cosmetic — there's no "collection" concept in the product schema (no
  // tags/collections table). Selecting this doesn't filter anything; it's
  // here to match the reference layout, not because it does something.
  const [collection, setCollection] = useState("");

  useEffect(() => {
    api.categories().then(setCategories).catch(() => setCategories([]));
  }, []);

  function apply() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (minPrice) params.set("min_price", minPrice);
    if (maxPrice) params.set("max_price", maxPrice);
    if (ordering && ordering !== "latest") params.set("ordering", ordering);
    const qs = params.toString();
    router.push(`/products${qs ? `?${qs}` : ""}`);
  }

  function reset() {
    setSearch(""); setCategory(""); setMinPrice(""); setMaxPrice("");
    setOrdering("latest"); setCollection("");
    router.push("/products");
  }

  const inputClass =
    "w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm";

  return (
    <aside className="w-full sm:w-64 shrink-0 border border-gray-200 dark:border-gray-800 rounded-lg p-5 h-fit">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading font-semibold">{t("filters_heading")}</h2>
        <button onClick={reset} className="text-xs text-gray-400 hover:text-brand-600">{t("filters_reset")}</button>
      </div>

      <label className="block text-xs font-medium text-gray-500 mb-1">{t("filters_search_label")}</label>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("search_placeholder")}
        className={`${inputClass} mb-4`}
      />

      <label className="block text-xs font-medium text-gray-500 mb-1">{t("filters_category_label")}</label>
      <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputClass} mb-4`}>
        <option value="">{t("filters_all_categories")}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <label className="block text-xs font-medium text-gray-500 mb-1">
        {t("filters_collection_label")} <span className="text-gray-400">{t("filters_collection_note")}</span>
      </label>
      <select value={collection} onChange={(e) => setCollection(e.target.value)} className={`${inputClass} mb-4`}>
        <option value="">{t("filters_collection_all")}</option>
        <option value="new">{t("filters_collection_new")}</option>
        <option value="deals">{t("filters_collection_deals")}</option>
      </select>

      <label className="block text-xs font-medium text-gray-500 mb-1">{t("filters_price_label")}</label>
      <div className="flex gap-2 mb-4">
        <input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="0" type="number" className={inputClass} />
        <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="9999" type="number" className={inputClass} />
      </div>

      <label className="block text-xs font-medium text-gray-500 mb-1">{t("filters_sort_label")}</label>
      <select value={ordering} onChange={(e) => setOrdering(e.target.value)} className={`${inputClass} mb-5`}>
        <option value="latest">{t("sort_latest")}</option>
        <option value="price_asc">{t("sort_price_asc")}</option>
        <option value="price_desc">{t("sort_price_desc")}</option>
        <option value="name_asc">{t("sort_name_asc")}</option>
      </select>

      <button
        onClick={apply}
        className="w-full bg-accent-500 text-white px-4 py-2.5 rounded-md font-medium text-sm hover:bg-accent-400 flex items-center justify-center gap-2"
      >
        <Funnel className="h-4 w-4" />
        {t("filters_apply")}
      </button>
    </aside>
  );
}
