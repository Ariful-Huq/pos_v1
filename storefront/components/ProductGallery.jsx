"use client";

import { useState } from "react";
import { useLanguage } from "./LanguageProvider";

// Accepts whatever the API gives us and normalizes it into a flat list of
// image URLs: a future `product.images` array (of strings or {image|url}
// objects), falling back to the single `product.image` field the backend
// exposes today. Degrades to a placeholder when there's nothing to show,
// and simply doesn't render a thumbnail strip when there's only one image.
function normalizeImages(product) {
  if (Array.isArray(product?.images) && product.images.length > 0) {
    return product.images
      .map((img) => (typeof img === "string" ? img : img?.image || img?.url))
      .filter(Boolean);
  }
  return product?.image ? [product.image] : [];
}

export default function ProductGallery({ product }) {
  const { t } = useLanguage();
  const images = normalizeImages(product);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex];

  return (
    <div>
      <div className="aspect-square bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg flex items-center justify-center overflow-hidden">
        {activeImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activeImage}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-gray-400 text-sm">{t("no_image")}</span>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-3 mt-3 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={t("view_image_n", { n: i + 1 })}
              aria-current={i === activeIndex}
              className={`shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition ${
                i === activeIndex
                  ? "border-brand-500"
                  : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
