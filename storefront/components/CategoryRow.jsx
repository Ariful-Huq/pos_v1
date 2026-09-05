import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ProductCard from "./ProductCard";

// Presentational row used on the home page for "New Arrivals" and for each
// active category that currently has published products. All real data —
// products come straight from the /products/ endpoint, nothing fabricated
// here (contrast with FlashSaleSection, which is intentionally cosmetic).
export default function CategoryRow({ eyebrow, title, viewAllLabel, viewAllHref, products }) {
  if (!products || products.length === 0) return null;

  return (
    <section className="mb-14">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          {eyebrow && (
            <p className="text-xs font-semibold tracking-wide text-accent-500 uppercase mb-1">{eyebrow}</p>
          )}
          <h2 className="font-heading text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
        </div>
        <Link
          href={viewAllHref}
          className="flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-500 hover:text-brand-700 shrink-0"
        >
          {viewAllLabel}
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {products.slice(0, 4).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
