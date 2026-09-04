"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../components/LanguageProvider";
import ProductGallery from "../../../components/ProductGallery";
import ProductCard from "../../../components/ProductCard";

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M5 12h14" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="6" width="14" height="11" rx="1" />
      <path d="M15 10h4l3 3v4h-7z" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="17.5" cy="19" r="2" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

// SKU / Category are the only spec fields the backend actually exposes
// today. Everything else a real spec tab would eventually show (brand,
// weight, dimensions, warranty...) has no field/source yet, so rather than
// invent placeholder rows we show what's real and leave a note — same
// pattern as filters_collection_note elsewhere in this app.
function SpecRow({ label, value }) {
  return (
    <div className="flex px-4 py-3 text-sm border-b border-gray-200 dark:border-gray-800 last:border-b-0">
      <span className="w-40 shrink-0 text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}

export default function ProductDetailPage({ params }) {
  // Next.js 15: params is a Promise even in Client Components. Client
  // components can't be async, so React's use() hook unwraps it instead.
  const { slug } = use(params);
  const { t } = useLanguage();
  const router = useRouter();
  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState("idle"); // idle | adding | added | error
  const [loadError, setLoadError] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("description");
  const [related, setRelated] = useState([]);

  useEffect(() => {
    setLoadError(null);
    setActiveTab("description");
    api.product(slug).then(setProduct).catch((err) => setLoadError(err.message || "Failed to load product."));
    api.categories().then(setCategories).catch(() => setCategories([]));
  }, [slug]);

  const categoryRaw = product?.category;
  const categoryId = categoryRaw && typeof categoryRaw === "object" ? categoryRaw.id : categoryRaw;

  // Related products: same category only, for now — per-category browsing
  // is the one grouping the backend already supports well.
  useEffect(() => {
    if (!categoryId || !product) {
      setRelated([]);
      return;
    }
    api
      .products({ category: categoryId })
      .then((list) => {
        const items = Array.isArray(list) ? list : list?.results || [];
        setRelated(items.filter((p) => p.id !== product.id).slice(0, 4));
      })
      .catch(() => setRelated([]));
  }, [categoryId, product]);

  if (loadError) return <p className="text-danger-600">{loadError}</p>;
  if (!product) return <p className="text-gray-500">{t("loading")}</p>;

  const isVariant = product.product_type === "variant";
  const price = selectedVariant?.effective_price ?? product.selling_price;

  // `product.category` may already arrive as a nested {id, name} object, or
  // just a bare id — fall back to matching it against the categories list
  // (same source FiltersSidebar/CategoryNav use) so the breadcrumb still
  // resolves a name either way.
  const categoryObj =
    categoryRaw && typeof categoryRaw === "object" ? categoryRaw : categories.find((c) => c.id === categoryRaw);

  // No reviews system exists in the backend yet — count is honestly 0
  // until that's built, rather than a fake number.
  const reviewCount = product.review_count ?? 0;

  const tabs = [
    { id: "description", label: t("tab_description") },
    { id: "specification", label: t("tab_specification") },
    { id: "reviews", label: t("tab_reviews", { count: reviewCount }) },
  ];

  async function addToCart() {
    if (isVariant && !selectedVariant) {
      setStatus("error");
      return false;
    }
    setStatus("adding");
    try {
      await api.addToCart({
        product: product.id,
        variant: selectedVariant?.id || null,
        quantity,
      });
      setStatus("added");
      return true;
    } catch {
      setStatus("error");
      return false;
    }
  }

  async function handleBuyNow() {
    const ok = await addToCart();
    if (ok) router.push("/checkout");
  }

  function handleCopyLink() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    });
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center flex-wrap gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-6">
        <Link href="/" className="hover:text-brand-600">{t("nav_home")}</Link>
        <ChevronIcon />
        <Link href="/products" className="hover:text-brand-600">{t("nav_shop")}</Link>
        {categoryObj?.name && (
          <>
            <ChevronIcon />
            <Link href={`/products?category=${categoryObj.id}`} className="hover:text-brand-600">
              {categoryObj.name}
            </Link>
          </>
        )}
        <ChevronIcon />
        <span className="text-gray-700 dark:text-gray-300 truncate">{product.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-10">
        <ProductGallery product={product} />

        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
            {product.name}
          </h1>

          {(product.sku || categoryObj?.name) && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 flex flex-wrap gap-x-4 gap-y-1">
              {product.sku && <span>{t("sku_label")}: {product.sku}</span>}
              {categoryObj?.name && (
                <span>
                  {t("category_label")}:{" "}
                  <Link href={`/products?category=${categoryObj.id}`} className="text-brand-600 hover:underline">
                    {categoryObj.name}
                  </Link>
                </span>
              )}
            </p>
          )}

          <p className="font-price text-2xl md:text-3xl text-brand-700 dark:text-brand-500 mb-5">৳{price}</p>

          {isVariant && product.variants?.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">{t("choose_option_heading")}</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`border rounded-md px-3 py-2 text-sm transition ${
                      selectedVariant?.id === v.id
                        ? "border-brand-500 bg-brand-50 dark:bg-gray-800 text-brand-700 dark:text-brand-400"
                        : "border-gray-300 dark:border-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-600"
                    }`}
                  >
                    {v.label || v.sku} — ৳{v.effective_price}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity stepper + primary actions */}
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="flex items-center border border-gray-300 dark:border-gray-700 rounded-md">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label={t("decrease_quantity")}
                className="w-9 h-10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-brand-600 disabled:opacity-40"
                disabled={quantity <= 1}
              >
                <MinusIcon />
              </button>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="w-12 text-center border-x border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 py-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                aria-label={t("increase_quantity")}
                className="w-9 h-10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-brand-600"
              >
                <PlusIcon />
              </button>
            </div>

            <button
              onClick={addToCart}
              disabled={status === "adding"}
              className="flex-1 min-w-[10rem] bg-accent-500 text-white px-6 py-2.5 rounded-md font-medium hover:bg-accent-400 disabled:opacity-50 transition"
            >
              {status === "adding" ? t("adding") : t("add_to_cart")}
            </button>
          </div>

          <button
            onClick={handleBuyNow}
            disabled={status === "adding"}
            className="w-full bg-brand-700 text-white px-6 py-2.5 rounded-md font-medium hover:bg-brand-600 disabled:opacity-50 transition mb-4"
          >
            {t("buy_now")}
          </button>

          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-brand-600 mb-6"
          >
            <LinkIcon />
            {linkCopied ? t("link_copied") : t("copy_link")}
          </button>

          {status === "added" && (
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <p className="text-brand-600 text-sm">{t("added_to_cart_msg")}</p>
              <Link href="/products" className="text-sm text-brand-600 underline">
                {t("continue_shopping")}
              </Link>
              <Link
                href="/cart"
                className="text-sm bg-accent-500 text-white px-4 py-2 rounded-md font-medium hover:bg-accent-400"
              >
                {t("view_cart")}
              </Link>
            </div>
          )}
          {status === "error" && (
            <p className="text-danger-600 text-sm mb-6">
              {isVariant && !selectedVariant ? t("choose_option_error") : t("generic_error")}
            </p>
          )}

          <div className="border border-gray-200 dark:border-gray-800 rounded-lg divide-y divide-gray-200 dark:divide-gray-800 text-sm">
            <div className="flex items-center gap-3 px-4 py-3 text-gray-600 dark:text-gray-300">
              <TruckIcon />
              {t("fast_dispatch_notice")}
            </div>
            <div className="flex items-center gap-3 px-4 py-3 text-gray-600 dark:text-gray-300">
              <ShieldIcon />
              {t("footer_secure_payment")}
            </div>
          </div>
        </div>
      </div>

      {/* Description / Specification / Reviews tabs */}
      <div className="mt-12">
        <div className="flex gap-6 border-b border-gray-200 dark:border-gray-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 -mb-px transition ${
                activeTab === tab.id
                  ? "border-brand-500 text-gray-900 dark:text-gray-100"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="py-6">
          {activeTab === "description" &&
            (product.description ? (
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed max-w-3xl">{product.description}</p>
            ) : (
              <p className="text-gray-400 dark:text-gray-500 text-sm italic">{t("no_description_note")}</p>
            ))}

          {activeTab === "specification" &&
            (product.sku || categoryObj?.name ? (
              <div className="border border-gray-200 dark:border-gray-800 rounded-lg max-w-2xl overflow-hidden">
                {product.sku && <SpecRow label={t("sku_label")} value={product.sku} />}
                {categoryObj?.name && <SpecRow label={t("category_label")} value={categoryObj.name} />}
              </div>
            ) : (
              <p className="text-gray-400 dark:text-gray-500 text-sm italic">{t("specification_note")}</p>
            ))}

          {activeTab === "reviews" && (
            <p className="text-gray-400 dark:text-gray-500 text-sm italic">{t("reviews_coming_soon")}</p>
          )}
        </div>
      </div>

      {/* Related products — same category only, for now */}
      {related.length > 0 && (
        <section className="mt-16">
          <p className="text-xs font-semibold tracking-wider text-brand-600 dark:text-brand-500 uppercase mb-1">
            {t("related_products_eyebrow")}
          </p>
          <h2 className="font-heading text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
            {t("related_products_heading")}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
