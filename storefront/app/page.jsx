import CategoryRow from "../components/CategoryRow";
import FlashSaleSection from "../components/FlashSaleSection";
import HeroSection from "../components/HeroSection";
import T from "../components/T";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/storefront";

// Server-side fetch, same ISR pattern as app/products/page.jsx — refreshes
// at most once a minute, no client loading state needed.
async function getJSON(path) {
  const res = await fetch(`${BASE_URL}${path}`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  return res.json();
}

export default async function HomePage() {
  const [categories, products] = await Promise.all([
    getJSON("/categories/"),
    getJSON("/products/?ordering=latest"),
  ]);

  // Already latest-first from the API — first 4 is a real "New Arrivals".
  const newArrivals = products.slice(0, 4);

  // Reuses the same latest-first slice for the flash sale block (only the
  // price styling is fake there, not the products or their real prices).
  const flashSaleProducts = products.slice(0, 4);

  // One row per active category that actually has published products —
  // no hardcoded category names, so this scales with the real catalog.
  const categoryRows = categories
    .map((category) => ({
      category,
      products: products.filter((p) => p.category === category.id),
    }))
    .filter((row) => row.products.length > 0);

  const hasAnyRow = newArrivals.length > 0 || categoryRows.length > 0;

  return (
    <div>
      <HeroSection />

      <FlashSaleSection products={flashSaleProducts} viewAllHref="/products" />

      <CategoryRow
        eyebrow={<T id="collection_eyebrow" />}
        title={<T id="new_arrivals_title" />}
        viewAllLabel={<T id="view_all" />}
        viewAllHref="/products?ordering=latest"
        products={newArrivals}
      />

      {categoryRows.map(({ category, products: catProducts }) => (
        <CategoryRow
          key={category.id}
          eyebrow={<T id="collection_eyebrow" />}
          title={category.name}
          viewAllLabel={<T id="view_all" />}
          viewAllHref={`/products?category=${category.id}`}
          products={catProducts}
        />
      ))}

      {!hasAnyRow && (
        <p className="text-gray-500 text-center py-8">
          <T id="no_products" />
        </p>
      )}
    </div>
  );
}
