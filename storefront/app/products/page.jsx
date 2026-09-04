import { Suspense } from "react";
import ProductCard from "../../components/ProductCard";
import FiltersSidebar from "../../components/FiltersSidebar";
import FilterChips from "../../components/FilterChips";
import T from "../../components/T";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/storefront";

async function getProducts(params) {
  const clean = Object.fromEntries(
    Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== "")
  );
  const qs = new URLSearchParams(clean).toString();
  const res = await fetch(`${BASE_URL}/products/${qs ? `?${qs}` : ""}`, {
    next: { revalidate: 60 }, // ISR — product list refreshes at most once/minute
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function ProductsPage({ searchParams }) {
  // Next.js 15: searchParams is a Promise in Server Components — must be
  // awaited before reading any properties.
  const params = await searchParams;
  const products = await getProducts(params);
  const hasFilters = Boolean(params?.search || params?.category || params?.min_price || params?.max_price);

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold mb-1"><T id="shop_title" /></h1>
      <p className="text-sm text-gray-500 mb-4">
        <T id="products_count" values={{ count: products.length }} />
        {hasFilters && <> <T id="filters_applied" /></>}
      </p>

      <Suspense fallback={null}>
        <FilterChips params={params} />
      </Suspense>

      <div className="flex flex-col sm:flex-row gap-6">
        <Suspense fallback={<div className="w-full sm:w-64 shrink-0" />}>
          <FiltersSidebar />
        </Suspense>

        <div className="flex-1">
          {products.length === 0 ? (
            <p className="text-gray-500"><T id="no_products" /></p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
