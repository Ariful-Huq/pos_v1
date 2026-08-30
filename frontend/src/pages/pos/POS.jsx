import { useState, useEffect, useRef, useCallback } from "react";
import {
  Scan,
  Plus,
  Trash2,
  CheckCircle2,
  PauseCircle,
  Clock,
  Search,
  PackageSearch,
  Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Tabs from "../../components/ui/Tabs";
import {
  createDraftSale,
  listHeldSales,
  addItem,
  removeItem,
  updateItemQuantity,
  completeSale,
  lookupProduct,
} from "../../api/sales";
import { listProducts, listCategories } from "../../api/catalog";

const PAYMENT_METHOD_KEYS = ["cash", "card", "mobile_banking", "store_credit"];
const CATALOG_PAGE_SIZE = 24;

function getProductPrice(product) {
  return product.selling_price ?? 0;
}

function getProductCategoryLabel(product) {
  return product.category_name || null;
}

export default function POS() {
  const { t } = useTranslation();
  const paymentMethods = [
    { value: "cash", label: t("pos.methodCash") },
    { value: "card", label: t("pos.methodCard") },
    { value: "mobile_banking", label: t("pos.methodMobileBanking") },
    { value: "store_credit", label: t("pos.methodStoreCredit") },
  ];

  const [mode, setMode] = useState("loading");
  const [heldSales, setHeldSales] = useState([]);
  const [emptyDraft, setEmptyDraft] = useState(null);
  const [sale, setSale] = useState(null);
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState("");
  const [payments, setPayments] = useState([{ method: "cash", amount: "0", reference: "" }]);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");
  const [completedSale, setCompletedSale] = useState(null);
  const scanInputRef = useRef(null);

  // --- Product catalog picker ---
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [catalogSearchInput, setCatalogSearchInput] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [productsPage, setProductsPage] = useState(1);
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const [addingProductId, setAddingProductId] = useState(null);

  const loadHeldSales = useCallback(async () => {
    setMode("loading");
    const held = await listHeldSales();
    const withItems = held.filter((h) => h.items.length > 0);
    const reusable = held.find((h) => h.items.length === 0) || null;
    setEmptyDraft(reusable);

    if (withItems.length === 0) {
      setSale(reusable || (await createDraftSale()));
      setMode("checkout");
    } else {
      setHeldSales(withItems);
      setMode("choosing");
    }
  }, []);

  useEffect(() => { loadHeldSales(); }, [loadHeldSales]);

  useEffect(() => {
    if (mode === "checkout") scanInputRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (sale && payments.length === 1) {
      setPayments([{ ...payments[0], amount: sale.total_amount }]);
    }
  }, [sale?.total_amount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Categories rarely change — load once.
  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  // Debounce the catalog search box so we don't fire a request per keystroke.
  useEffect(() => {
    const timeout = setTimeout(() => setCatalogSearch(catalogSearchInput.trim()), 350);
    return () => clearTimeout(timeout);
  }, [catalogSearchInput]);

  // Reload the product grid whenever the search term or category changes.
  useEffect(() => {
    if (mode !== "checkout") return;
    let cancelled = false;
    setProductsLoading(true);
    setProductsError("");
    listProducts({
      search: catalogSearch || undefined,
      category: activeCategory !== "all" ? activeCategory : undefined,
      page: 1,
      page_size: CATALOG_PAGE_SIZE,
    })
      .then((data) => {
        if (cancelled) return;
        setProducts(data.results || []);
        setHasMoreProducts(Boolean(data.next));
        setProductsPage(1);
      })
      .catch(() => {
        if (!cancelled) setProductsError(t("pos.couldntLoadProducts"));
      })
      .finally(() => {
        if (!cancelled) setProductsLoading(false);
      });
    return () => { cancelled = true; };
  }, [mode, catalogSearch, activeCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLoadMoreProducts() {
    const nextPage = productsPage + 1;
    setProductsLoading(true);
    try {
      const data = await listProducts({
        search: catalogSearch || undefined,
        category: activeCategory !== "all" ? activeCategory : undefined,
        page: nextPage,
        page_size: CATALOG_PAGE_SIZE,
      });
      setProducts((prev) => [...prev, ...(data.results || [])]);
      setHasMoreProducts(Boolean(data.next));
      setProductsPage(nextPage);
    } catch {
      setProductsError(t("pos.couldntLoadMoreProducts"));
    } finally {
      setProductsLoading(false);
    }
  }

  async function handleAddProduct(product) {
    setAddingProductId(product.id);
    setScanError("");
    try {
      const updated = await addItem(sale.id, { product: product.id, quantity: 1 });
      setSale(updated);
    } catch {
      setScanError(t("pos.couldntAddProduct", { name: product.name }));
    } finally {
      setAddingProductId(null);
    }
  }

  async function handleStartNew() {
    const newSale = emptyDraft || (await createDraftSale());
    setSale(newSale);
    setEmptyDraft(null);
    setPayments([{ method: "cash", amount: "0", reference: "" }]);
    setMode("checkout");
  }

  function handleResume(heldSale) {
    setSale(heldSale);
    setPayments([{ method: "cash", amount: heldSale.total_amount || "0", reference: "" }]);
    setMode("checkout");
  }

  function handleHold() {
    setSale(null);
    setCompletedSale(null);
    loadHeldSales();
  }

  async function handleScan(e) {
    e.preventDefault();
    if (!scanValue.trim()) return;
    setScanError("");
    try {
      const product = await lookupProduct(scanValue.trim());
      const updated = await addItem(sale.id, { product: product.id, quantity: 1 });
      setSale(updated);
      setScanValue("");
    } catch (err) {
      setScanError(err?.response?.status === 404 ? t("pos.noCodeMatch") : t("pos.couldntAddItem"));
    } finally {
      scanInputRef.current?.focus();
    }
  }

  async function handleQuantityChange(itemId, quantity) {
    if (quantity < 1) return;
    setSale(await updateItemQuantity(sale.id, itemId, quantity));
  }

  async function handleRemove(itemId) {
    setSale(await removeItem(sale.id, itemId));
  }

  function updatePaymentLine(index, field, value) {
    setPayments((lines) => lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  function addPaymentLine() {
    setPayments((lines) => [...lines, { method: "cash", amount: "0", reference: "" }]);
  }

  function removePaymentLine(index) {
    setPayments((lines) => lines.filter((_, i) => i !== index));
  }

  const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const total = parseFloat(sale?.total_amount || 0);
  const balance = total - totalPaid;
  const canComplete = sale?.items?.length > 0 && totalPaid >= total;

  async function handleComplete() {
    setCompleting(true);
    setCompleteError("");
    try {
      const result = await completeSale(
        sale.id,
        payments.map((p) => ({ ...p, amount: parseFloat(p.amount) || 0 }))
      );
      setCompletedSale(result);
      setMode("completed");
    } catch (err) {
      setCompleteError(err?.response?.data?.detail || "Couldn't complete the sale.");
    } finally {
      setCompleting(false);
    }
  }

  if (mode === "loading") {
    return <div className="text-center text-ink-400 py-10">{t("common.loading")}</div>;
  }

  if (mode === "choosing") {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <h2 className="font-display font-semibold text-lg text-ink-900">{t("pos.heldSales")}</h2>
        <div className="space-y-2">
          {heldSales.map((h) => (
            <button
              key={h.id}
              onClick={() => handleResume(h)}
              className="w-full flex items-center justify-between bg-white border border-surface-200 rounded-xl p-4 hover:border-brand-500 text-left"
            >
              <div className="flex items-center gap-3">
                <Clock size={18} className="text-ink-400" />
                <div>
                  <p className="font-medium text-ink-900">{h.items.length} item{h.items.length !== 1 ? "s" : ""}</p>
                  <p className="text-xs text-ink-400">{h.customer_name || t("pos.walkIn")}</p>
                </div>
              </div>
              <span className="font-figures font-medium text-ink-900">৳{Number(h.total_amount).toFixed(2)}</span>
            </button>
          ))}
        </div>
        <Button variant="primary" className="w-full" onClick={handleStartNew}>
          <Plus size={16} /> {t("pos.startNewSale")}
        </Button>
      </div>
    );
  }

  if (mode === "completed" && completedSale) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-xl border border-surface-200 p-8 text-center">
        <CheckCircle2 className="mx-auto text-brand-700 mb-3" size={40} />
        <h2 className="font-display font-semibold text-xl text-ink-900 mb-1">{t("pos.saleComplete")}</h2>
        <p className="font-figures text-2xl text-brand-900 mb-1">{completedSale.sale_number}</p>
        <p className="text-ink-400 text-sm mb-6">
          {t("pos.total")} <span className="font-figures">৳{Number(completedSale.total_amount).toFixed(2)}</span>
        </p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => window.print()}>{t("pos.printReceipt")}</Button>
          <Button variant="primary" onClick={handleStartNew}>{t("pos.newSale")}</Button>
        </div>
      </div>
    );
  }

  const categoryTabs = [
    { value: "all", label: t("pos.all") },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Scan + catalog */}
      <div className="lg:col-span-2 space-y-4">
        <form onSubmit={handleScan} className="flex gap-2">
          <div className="relative flex-1">
            <Scan className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={18} />
            <input
              ref={scanInputRef}
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              placeholder={t("pos.scanPlaceholder")}
              autoFocus
              className="input !pl-12 !h-10 font-figures"
            />
          </div>
          <Button type="submit" variant="brand">
            <Plus size={16} /> {t("pos.add")}
          </Button>
          <Button type="button" variant="outline" onClick={handleHold}>
            <PauseCircle size={16} /> {t("pos.hold")}
          </Button>
        </form>
        {scanError && <p className="text-danger-600 text-sm">{scanError}</p>}

        {/* Product catalog picker */}
        <div className="bg-white rounded-xl border border-surface-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display font-semibold text-sm text-ink-900">{t("pos.browseProducts")}</h3>
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={14} />
              <input
                value={catalogSearchInput}
                onChange={(e) => setCatalogSearchInput(e.target.value)}
                placeholder={t("pos.searchNameOrSku")}
                className="input !pl-8 text-sm py-1.5"
              />
            </div>
          </div>

          {categoryTabs.length > 1 && (
            <Tabs tabs={categoryTabs} active={activeCategory} onChange={setActiveCategory} />
          )}

          {productsError && <p className="text-danger-600 text-sm">{productsError}</p>}

          {products.length === 0 && !productsLoading ? (
            <div className="text-center text-ink-400 py-10">
              <PackageSearch className="mx-auto mb-2" size={28} />
              <p className="text-sm">{t("pos.noProductsMatch")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[34rem] overflow-y-auto pr-1">
              {products.map((product) => {
                const categoryLabel = getProductCategoryLabel(product);
                const adding = addingProductId === product.id;
                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={adding}
                    onClick={() => handleAddProduct(product)}
                    className="text-left bg-white border border-surface-200 rounded-lg p-3
                               hover:border-brand-500 disabled:opacity-60 disabled:cursor-not-allowed
                               flex flex-col gap-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-ink-900 text-sm leading-snug line-clamp-2">
                        {product.name}
                      </span>
                      {adding && <Loader2 size={14} className="animate-spin text-brand-700 shrink-0 mt-0.5" />}
                    </div>
                    <span className="font-figures text-xs text-ink-400">SKU {product.sku}</span>
                    <div className="flex items-center justify-between pt-1">
                      {categoryLabel ? (
                        <Badge tone="neutral">{categoryLabel}</Badge>
                      ) : <span />}
                      <span className="font-figures font-medium text-sm text-ink-900">
                        ৳{Number(getProductPrice(product)).toFixed(2)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {productsLoading && products.length === 0 && (
            <div className="flex items-center justify-center py-6 text-ink-400 text-sm gap-2">
              <Loader2 size={16} className="animate-spin" /> {t("pos.loadingProducts")}
            </div>
          )}

          {hasMoreProducts && (
            <div className="text-center pt-1">
              <button
                onClick={handleLoadMoreProducts}
                disabled={productsLoading}
                className="text-xs text-brand-700 hover:underline disabled:opacity-60"
              >
                {productsLoading ? t("pos.loading") : t("pos.loadMore")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cart + payment panel */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-200 flex items-center justify-between">
            <h3 className="font-display font-semibold text-sm text-ink-900">{t("pos.cart")}</h3>
            {sale.items.length > 0 && (
              <span className="text-xs text-ink-400">
                {sale.items.length} item{sale.items.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {sale.items.length === 0 ? (
            <p className="text-center text-ink-400 py-10 text-sm px-4">{t("pos.emptyCart")}</p>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-surface-100">
              {sale.items.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink-900 text-sm truncate">{item.product_name}</p>
                    <p className="font-figures text-xs text-ink-400">{item.product_sku}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        className="w-14 px-1.5 py-1 rounded-lg border border-surface-200 font-figures text-xs"
                      />
                      <span className="font-figures text-xs text-ink-400">
                        × ৳{Number(item.unit_price).toFixed(2)}
                      </span>
                      <span className="font-figures text-sm font-medium text-ink-900 ml-auto">
                        ৳{Number(item.line_total).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="text-danger-500 hover:text-danger-600 shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-surface-200 p-4 space-y-2">
          <Row label={t("pos.subtotal")} value={sale.subtotal} />
          <Row label={t("pos.discount")} value={sale.discount_amount} negative />
          <Row label={t("pos.tax")} value={sale.tax_amount} />
          <div className="border-t border-surface-200 pt-2">
            <Row label={t("pos.total")} value={sale.total_amount} bold />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-surface-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-sm text-ink-900">{t("pos.payment")}</h3>
            <button onClick={addPaymentLine} className="text-xs text-brand-700 hover:underline">
              {t("pos.splitPayment")}
            </button>
          </div>

          {payments.map((p, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select
                value={p.method}
                onChange={(e) => updatePaymentLine(i, "method", e.target.value)}
                className="input text-sm flex-1"
              >
                {paymentMethods.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                value={p.amount}
                onChange={(e) => updatePaymentLine(i, "amount", e.target.value)}
                className="input text-sm w-28 font-figures"
              />
              {payments.length > 1 && (
                <button onClick={() => removePaymentLine(i)} className="text-danger-500">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}

          <div className="flex justify-between text-sm pt-2 border-t border-surface-100">
            <span className="text-ink-400">{balance > 0 ? t("pos.balanceDue") : t("pos.change")}</span>
            <Badge tone={balance > 0 ? "warning" : "success"}>
              ৳{Math.abs(balance).toFixed(2)}
            </Badge>
          </div>

          {completeError && <p className="text-danger-600 text-sm">{completeError}</p>}

          <Button
            variant="primary"
            className="w-full"
            disabled={!canComplete || completing}
            onClick={handleComplete}
          >
            {completing ? t("pos.completing") : t("pos.completeSale")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, negative, bold }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? "font-semibold text-ink-900" : "text-ink-700"}`}>
      <span>{label}</span>
      <span className="font-figures">
        {negative && Number(value) > 0 ? "-" : ""}৳{Number(value).toFixed(2)}
      </span>
    </div>
  );
}
