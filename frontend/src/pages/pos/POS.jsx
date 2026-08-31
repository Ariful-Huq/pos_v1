import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Scan, Plus, Trash2, CheckCircle2, PauseCircle, Clock, Search, PackageSearch,
  Loader2, Minus, ArrowLeft, Printer, Banknote, CreditCard, Smartphone, Wallet2, X,
  Languages, Settings as SettingsIcon, Maximize, Minimize, Home, RotateCcw, FileClock,
  User as UserIcon, Lock as LockIcon, LogOut, Wifi,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Tabs from "../../components/ui/Tabs";
import NumericKeypad from "../../components/ui/NumericKeypad";
import ActionMenu from "../../components/ui/ActionMenu";
import LockOverlay from "../../components/ui/LockOverlay";
import { useAuth } from "../../context/AuthContext";
import { setLanguage } from "../../i18n";
import {
  createDraftSale, listHeldSales, addItem, removeItem,
  updateItemQuantity, completeSale, lookupProduct,
} from "../../api/sales";
import { listProducts, listCategories } from "../../api/catalog";

const CATALOG_PAGE_SIZE = 24;
const QUICK_CASH_AMOUNTS = [50, 100, 500, 1000];

const PAYMENT_METHODS = [
  { value: "cash", icon: Banknote, labelKey: "pos.methodCash" },
  { value: "card", icon: CreditCard, labelKey: "pos.methodCard" },
  { value: "mobile_banking", icon: Smartphone, labelKey: "pos.methodMobileBanking" },
  { value: "store_credit", icon: Wallet2, labelKey: "pos.methodStoreCredit" },
];

export default function POS() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, activeBranchId, switchBranch, logout } = useAuth();

  // screen: loading | choosing | register | payment-method | cash-entry | success
  const [screen, setScreen] = useState("loading");
  const [heldSales, setHeldSales] = useState([]);
  const [emptyDraft, setEmptyDraft] = useState(null);
  const [sale, setSale] = useState(null);
  const [locked, setLocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [recentDraftsNote, setRecentDraftsNote] = useState("");

  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState("");
  const scanInputRef = useRef(null);

  // Catalog picker
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
  const [resetting, setResetting] = useState(false);

  // Promo code — UI only for now, no backend system exists yet.
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState("");

  // Payment
  const [tendered, setTendered] = useState("0");
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");
  const [completedSale, setCompletedSale] = useState(null);

  const loadHeldSales = useCallback(async () => {
    setScreen("loading");
    const held = await listHeldSales();
    const withItems = held.filter((h) => h.items.length > 0);
    const reusable = held.find((h) => h.items.length === 0) || null;
    setEmptyDraft(reusable);

    if (withItems.length === 0) {
      setSale(reusable || (await createDraftSale()));
      setScreen("register");
    } else {
      setHeldSales(withItems);
      setScreen("choosing");
    }
  }, []);

  useEffect(() => { loadHeldSales(); }, [loadHeldSales]);

  useEffect(() => {
    if (screen === "register") scanInputRef.current?.focus();
  }, [screen]);

  useEffect(() => {
    listCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    function handleFsChange() { setIsFullscreen(Boolean(document.fullscreenElement)); }
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setCatalogSearch(catalogSearchInput.trim()), 350);
    return () => clearTimeout(timeout);
  }, [catalogSearchInput]);

  useEffect(() => {
    if (screen !== "register") return;
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
      .catch(() => { if (!cancelled) setProductsError(t("pos.couldntLoadProducts")); })
      .finally(() => { if (!cancelled) setProductsLoading(false); });
    return () => { cancelled = true; };
  }, [screen, catalogSearch, activeCategory]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setSale(await addItem(sale.id, { product: product.id, quantity: 1 }));
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
    resetPaymentState();
    setScreen("register");
  }

  function handleResume(heldSale) {
    setSale(heldSale);
    resetPaymentState();
    setScreen("register");
  }

  function handleHold() {
    setSale(null);
    setCompletedSale(null);
    loadHeldSales();
  }

  async function handleReset() {
    if (!sale || sale.items.length === 0) return;
    setResetting(true);
    try {
      let current = sale;
      for (const item of [...current.items]) {
        current = await removeItem(current.id, item.id);
      }
      setSale(current);
    } finally {
      setResetting(false);
    }
  }

  async function handleRecentDrafts() {
    const held = await listHeldSales();
    const withItems = held.filter((h) => h.items.length > 0 && h.id !== sale?.id);
    if (withItems.length > 0) {
      setHeldSales(withItems);
      setScreen("choosing");
    } else {
      setRecentDraftsNote(t("pos.noOtherDrafts"));
      setTimeout(() => setRecentDraftsNote(""), 2500);
    }
  }

  function resetPaymentState() {
    setTendered("0");
    setCompleteError("");
    setPromoCode("");
    setPromoMessage("");
  }

  async function handleScan(e) {
    e.preventDefault();
    if (!scanValue.trim()) return;
    setScanError("");
    try {
      const product = await lookupProduct(scanValue.trim());
      setSale(await addItem(sale.id, { product: product.id, quantity: 1 }));
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

  function handleApplyPromo() {
    if (!promoCode.trim()) return;
    setPromoMessage(t("pos.promoComingSoon"));
  }

  function toggleLanguage() {
    setLanguage(i18n.language === "bn" ? "en" : "bn");
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  const total = parseFloat(sale?.total_amount || 0);

  function handleSelectMethod(method) {
    setCompleteError("");
    if (method === "cash") {
      setTendered(sale.total_amount);
      setScreen("cash-entry");
    } else {
      completeWithPayment(method, total);
    }
  }

  function handleKeypadPress(key) {
    setTendered((prev) => {
      if (key === "backspace") return prev.length > 1 ? prev.slice(0, -1) : "0";
      if (key === "." && prev.includes(".")) return prev;
      if (prev === "0" && key !== ".") return key;
      return prev + key;
    });
  }

  function handleQuickCash(amount) {
    setTendered(String(amount));
  }

  const tenderedNum = parseFloat(tendered) || 0;
  const remaining = total - tenderedNum;

  async function completeWithPayment(method, amount) {
    setCompleting(true);
    setCompleteError("");
    try {
      const result = await completeSale(sale.id, [{ method, amount }]);
      setCompletedSale(result);
      setScreen("success");
    } catch (err) {
      setCompleteError(err?.response?.data?.detail || "Couldn't complete the sale.");
    } finally {
      setCompleting(false);
    }
  }

  function handleConfirmCashPayment() {
    completeWithPayment("cash", tenderedNum);
  }

  // ==================== HEADER (shared across every screen) ====================

  function Header() {
    return (
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 bg-white shrink-0 gap-3">
        <span className="font-display font-semibold text-ink-900 shrink-0">{t("pos.title")}</span>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {user?.branch_access?.length > 1 && (
            <select
              value={activeBranchId || ""}
              onChange={(e) => switchBranch(e.target.value)}
              className="text-sm border border-surface-200 rounded-lg px-2 py-1.5 bg-white font-mono"
            >
              {user.branch_access.map((b) => (
                <option key={b.branch_id || "global"} value={b.branch_id || ""}>{b.branch_name}</option>
              ))}
            </select>
          )}

          <IconButton onClick={toggleLanguage} title={t("common.language")}>
            <Languages size={16} /> <span className="text-xs">{i18n.language === "bn" ? "বাং" : "EN"}</span>
          </IconButton>
          <IconButton onClick={() => navigate("/settings")} title={t("nav.settings")}>
            <SettingsIcon size={16} />
          </IconButton>
          <IconButton onClick={toggleFullscreen} title={t("common.fullscreen")}>
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </IconButton>

          <ActionMenu
            items={[
              { label: user?.username, icon: <UserIcon size={14} />, disabled: true },
              { divider: true },
              { label: t("common.lock"), icon: <LockIcon size={14} />, onClick: () => setLocked(true) },
              { label: t("common.signOut"), icon: <LogOut size={14} />, danger: true, onClick: logout },
            ]}
          />

          <button onClick={() => navigate("/sales")} className="p-1.5 rounded-lg text-ink-400 hover:bg-surface-100" title={t("pos.backToCart")}>
            <X size={20} />
          </button>
        </div>
      </div>
    );
  }

  function Shell({ children }) {
    return (
      <div className="fixed inset-0 z-40 bg-surface-50 flex flex-col">
        <Header />
        <div className="flex-1 min-h-0 p-4 overflow-y-auto">{children}</div>
        {locked && <LockOverlay username={user?.username} onUnlock={() => setLocked(false)} />}
      </div>
    );
  }

  // ==================== RENDER ====================

  if (screen === "loading") {
    return (
      <div className="fixed inset-0 flex items-center justify-center text-ink-400 bg-surface-50">
        {t("common.loading")}
      </div>
    );
  }

  if (screen === "choosing") {
    return (
      <Shell>
        <div className="max-w-lg mx-auto py-16 space-y-4">
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
                <span className="font-figures font-medium text-ink-900">৳ {Number(h.total_amount).toFixed(2)}</span>
              </button>
            ))}
          </div>
          <Button variant="primary" className="w-full" onClick={handleStartNew}>
            <Plus size={16} /> {t("pos.startNewSale")}
          </Button>
        </div>
      </Shell>
    );
  }

  if (screen === "success" && completedSale) {
    return (
      <Shell>
        <div className="max-w-md mx-auto py-20 bg-white rounded-2xl border border-surface-200 p-8 text-center">
          <CheckCircle2 className="mx-auto text-brand-700 mb-3" size={48} />
          <h2 className="font-display font-semibold text-xl text-ink-900 mb-1">{t("pos.saleComplete")}</h2>
          <p className="text-xs text-ink-400 mb-4">{t("pos.transactionCompleted", { number: completedSale.sale_number })}</p>

          {remaining < 0 && (
            <div className="bg-surface-50 rounded-xl p-4 mb-4">
              <p className="text-xs uppercase tracking-wide text-ink-400">{t("pos.changeDue")}</p>
              <p className="font-figures text-3xl font-semibold text-ink-900">৳ {Math.abs(remaining).toFixed(2)}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mb-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer size={16} /> {t("pos.printReceipt")}
            </Button>
            <Button variant="outline" onClick={() => navigate("/sales")}>
              {t("pos.backToCart")}
            </Button>
          </div>
          <Button variant="primary" className="w-full mt-2" onClick={handleStartNew}>
            {t("pos.newSale")}
          </Button>
        </div>
      </Shell>
    );
  }

  if (screen === "payment-method") {
    return (
      <Shell>
        <div className="max-w-lg mx-auto py-16">
          <button onClick={() => setScreen("register")} className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700 mb-6">
            <ArrowLeft size={16} /> {t("pos.backToCart")}
          </button>
          <h2 className="font-display font-semibold text-2xl text-ink-900 mb-1 text-center">{t("pos.selectPaymentMethod")}</h2>
          <p className="text-sm text-ink-400 text-center mb-8">{t("pos.choosePaymentMethod")}</p>

          <div className="grid grid-cols-2 gap-4">
            {PAYMENT_METHODS.map(({ value, icon: Icon, labelKey }) => (
              <button
                key={value}
                onClick={() => handleSelectMethod(value)}
                disabled={completing}
                className="bg-white border border-surface-200 rounded-xl p-8 flex flex-col items-center gap-3
                           hover:border-brand-500 hover:shadow-sm transition-all disabled:opacity-60"
              >
                <div className="w-12 h-12 rounded-full bg-surface-50 flex items-center justify-center">
                  <Icon size={22} className="text-ink-700" />
                </div>
                <span className="font-medium text-ink-900">{t(labelKey)}</span>
              </button>
            ))}
          </div>

          {completeError && <p className="text-danger-600 text-sm text-center mt-4">{completeError}</p>}
        </div>
      </Shell>
    );
  }

  if (screen === "cash-entry") {
    return (
      <Shell>
        <div className="max-w-lg mx-auto py-10">
          <button onClick={() => setScreen("payment-method")} className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700 mb-6">
            <ArrowLeft size={16} /> {t("pos.backToPaymentMethods")}
          </button>

          <p className="text-center text-xs uppercase tracking-wide text-ink-400">{t("pos.amountDue")}</p>
          <p className="text-center font-figures text-5xl font-bold text-ink-900 mb-8">৳ {total.toFixed(2)}</p>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-ink-700">{t("pos.amountTendered")}</label>
              <div className="bg-white border border-surface-200 rounded-xl px-4 py-3 flex items-center">
                <span className="font-figures text-2xl text-ink-400 mr-1">৳ </span>
                <span className="font-figures text-2xl font-semibold text-ink-900">{tendered}</span>
              </div>

              <label className="block text-xs uppercase tracking-wide text-ink-400 pt-2">{t("pos.quickCash")}</label>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_CASH_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => handleQuickCash(amt)}
                    className="py-2 rounded-lg border border-surface-200 bg-white hover:bg-surface-50 font-figures text-sm font-medium"
                  >
                    ৳ {amt}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setTendered(sale.total_amount)}
                className="w-full py-2 rounded-lg border border-surface-200 bg-white hover:bg-surface-50 text-sm font-medium"
              >
                {t("pos.exactAmount", { amount: `৳ ${total.toFixed(2)}` })}
              </button>
            </div>

            <NumericKeypad onKeyPress={handleKeypadPress} />
          </div>

          <div className={`mt-6 rounded-xl p-4 flex justify-between items-center ${remaining > 0 ? "bg-accent-100" : "bg-brand-100"}`}>
            <span className="text-sm font-medium text-ink-700">{remaining > 0 ? t("pos.balanceDue") : t("pos.change")}</span>
            <span className="font-figures text-xl font-semibold text-ink-900">৳ {Math.abs(remaining).toFixed(2)}</span>
          </div>

          {completeError && <p className="text-danger-600 text-sm text-center mt-3">{completeError}</p>}

          <Button
            variant="primary"
            className="w-full mt-4"
            disabled={tenderedNum < total || completing}
            onClick={handleConfirmCashPayment}
          >
            {completing ? t("pos.completing") : t("pos.confirmPayment")}
          </Button>
        </div>
      </Shell>
    );
  }

  // --- Main register screen ---
  const categoryTabs = [{ value: "all", label: t("pos.all") }, ...categories.map((c) => ({ value: c.id, label: c.name }))];

  return (
    <Shell>
      <div className="flex flex-col h-full gap-3">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
          {/* Product grid — LEFT */}
          <div className="lg:col-span-2 flex flex-col gap-3 min-h-0">
            <form onSubmit={handleScan} className="flex gap-2">
              <div className="relative flex-1">
                <Scan className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={18} />
                <input
                  ref={scanInputRef}
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  placeholder={t("pos.scanPlaceholder")}
                  autoFocus
                  className="input !pl-10 font-figures"
                />
              </div>
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={14} />
                <input
                  value={catalogSearchInput}
                  onChange={(e) => setCatalogSearchInput(e.target.value)}
                  placeholder={t("pos.searchNameOrSku")}
                  className="input !pl-8 text-sm"
                />
              </div>
            </form>

            {scanError && <p className="text-danger-600 text-sm">{scanError}</p>}
            {categoryTabs.length > 1 && <Tabs tabs={categoryTabs} active={activeCategory} onChange={setActiveCategory} />}

            <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-surface-200 p-3">
              {productsError && <p className="text-danger-600 text-sm mb-2">{productsError}</p>}

              {products.length === 0 && !productsLoading ? (
                <div className="text-center text-ink-400 py-16">
                  <PackageSearch className="mx-auto mb-2" size={28} />
                  <p className="text-sm">{t("pos.noProductsMatch")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {products.map((product) => {
                    const adding = addingProductId === product.id;
                    return (
                      <button
                        key={product.id}
                        type="button"
                        disabled={adding}
                        onClick={() => handleAddProduct(product)}
                        className="aspect-square bg-white border border-surface-200 rounded-xl p-3
                                   hover:border-brand-500 disabled:opacity-60 disabled:cursor-not-allowed
                                   flex flex-col text-left relative overflow-hidden"
                      >
                        <div className="flex-1 rounded-lg bg-surface-50 flex items-center justify-center mb-2">
                          {adding ? (
                            <Loader2 size={22} className="animate-spin text-brand-700" />
                          ) : (
                            <PackageSearch size={28} className="text-surface-200" />
                          )}
                        </div>
                        <span className="font-medium text-ink-900 text-xs leading-snug line-clamp-2">{product.name}</span>
                        <span className="font-figures text-[10px] text-ink-400 mb-1">{product.sku}</span>

                        <div className="flex items-center justify-between gap-1">
                          {/* Unit label — expects product.unit (e.g. "bottle", "pack", "pcs", "kg")
                              from the catalog API. Renders nothing if the field isn't present yet. */}
                          {product.unit ? (
                            <span className="text-[10px] text-ink-400 truncate">per {product.unit}</span>
                          ) : <span />}

                          <span className="font-figures font-semibold text-[11px] leading-none
                                            text-brand-700 bg-brand-50 border border-brand-200 rounded-md px-1.5 py-1 shrink-0">
                            ৳ {Number(product.selling_price).toFixed(2)}
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
                <div className="text-center pt-3">
                  <button onClick={handleLoadMoreProducts} disabled={productsLoading} className="text-xs text-brand-700 hover:underline disabled:opacity-60">
                    {productsLoading ? t("pos.loading") : t("pos.loadMore")}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Cart + payment summary — RIGHT */}
          <div className="flex flex-col gap-3 min-h-0">
            <div className="bg-white rounded-xl border border-surface-200 flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-200 flex items-center justify-between">
                <h3 className="font-display font-semibold text-sm text-ink-900">{t("pos.cart")}</h3>
                {sale.items.length > 0 && <span className="text-xs text-ink-400">{sale.items.length} item{sale.items.length !== 1 ? "s" : ""}</span>}
              </div>
              {sale.items.length === 0 ? (
                <p className="text-center text-ink-400 py-10 text-sm px-4">{t("pos.emptyCart")}</p>
              ) : (
                <div className="flex-1 overflow-y-auto divide-y divide-surface-100">
                  {sale.items.map((item) => {
                    const unitPrice = item.unit_price != null
                      ? Number(item.unit_price)
                      : Number(item.line_total) / (Number(item.quantity) || 1);
                    return (
                      <div key={item.id} className="px-4 py-3 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-ink-900 text-sm truncate">{item.product_name}</p>
                          <p className="font-figures text-xs text-ink-400">{item.product_sku}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <button onClick={() => handleQuantityChange(item.id, item.quantity - 1)} className="w-6 h-6 rounded-md border border-surface-200 flex items-center justify-center hover:bg-surface-50">
                              <Minus size={12} />
                            </button>
                            <span className="font-figures text-sm w-8 text-center">{Number(item.quantity).toFixed(2)}</span>
                            <button onClick={() => handleQuantityChange(item.id, item.quantity + 1)} className="w-6 h-6 rounded-md border border-surface-200 flex items-center justify-center hover:bg-surface-50">
                              <Plus size={12} />
                            </button>
                            <span className="font-figures text-xs text-ink-400">
                              x ৳ {unitPrice.toFixed(2)}
                            </span>
                            <span className="font-figures text-sm font-medium text-ink-900 ml-auto">৳ {Number(item.line_total).toFixed(2)}</span>
                          </div>
                        </div>
                        <button onClick={() => handleRemove(item.id)} className="text-danger-500 hover:text-danger-600 shrink-0">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-surface-200 p-4 space-y-2 shrink-0">
              <Row label={t("pos.subtotal")} value={sale.subtotal} />
              <Row label={t("pos.tax")} value={sale.tax_amount} />
              <Row label={t("pos.discount")} value={sale.discount_amount} negative />

              <div className="flex gap-2 pt-1">
                <input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder={t("pos.promoCodePlaceholder")}
                  className="input text-sm flex-1"
                />
                <Button size="sm" variant="primary" onClick={handleApplyPromo}>{t("pos.apply")}</Button>
              </div>
              {promoMessage && <p className="text-xs text-ink-400">{promoMessage}</p>}

              <div className="border-t border-surface-200 pt-2">
                <Row label={t("pos.total")} value={sale.total_amount} bold />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom action bar — spans full width */}
        <div className="flex items-center justify-between gap-3 bg-white border border-surface-200 rounded-xl px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-ink-400 mr-1">
              <span className="w-2 h-2 rounded-full bg-brand-500 inline-block" />
              <Wifi size={12} /> {t("pos.onlineSynced")}
            </span>
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <Home size={14} /> {t("pos.home")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset} disabled={resetting || sale.items.length === 0}>
              <RotateCcw size={14} /> {t("pos.reset")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleRecentDrafts}>
              <FileClock size={14} /> {t("pos.recentDrafts")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleHold}>
              <PauseCircle size={14} /> {t("pos.hold")}
            </Button>
            {recentDraftsNote && <span className="text-xs text-ink-400">{recentDraftsNote}</span>}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-ink-400">{t ("pos.totalPayable")}</p>
              <p className="font-figures text-xl font-bold text-ink-900">৳ {total.toFixed(2)}</p>
            </div>
            <Button
              variant="primary"
              disabled={sale.items.length === 0}
              onClick={() => setScreen("payment-method")}
            >
              {t("pos.payNow")}
            </Button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function IconButton({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-surface-200 text-ink-700 hover:bg-surface-100 text-sm"
    >
      {children}
    </button>
  );
}

function Row({ label, value, negative, bold }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? "font-semibold text-ink-900" : "text-ink-700"}`}>
      <span>{label}</span>
      <span className="font-figures">{negative && Number(value) > 0 ? "-" : ""}৳ {Number(value).toFixed(2)}</span>
    </div>
  );
}
