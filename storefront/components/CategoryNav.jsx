"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "../lib/api";

export default function CategoryNav() {
  const [categories, setCategories] = useState([]);
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category");

  useEffect(() => {
    api.categories().then(setCategories).catch(() => setCategories([]));
  }, []);

  if (categories.length === 0) return null;

  return (
    <nav className="border-b border-gray-200 dark:border-gray-800 px-6 py-2 flex gap-6 text-sm overflow-x-auto">
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/products?category=${c.id}`}
          className={`whitespace-nowrap ${
            activeCategory === c.id
              ? "text-brand-700 dark:text-brand-500 font-medium"
              : "text-gray-600 dark:text-gray-400 hover:text-brand-600"
          }`}
        >
          {c.name}
        </Link>
      ))}
    </nav>
  );
}
