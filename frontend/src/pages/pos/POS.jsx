import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Scan, Plus, Trash2, CheckCircle2, PauseCircle, Clock, Search, PackageSearch,
  Loader2, Minus, ArrowLeft, Printer, Banknote, CreditCard, Smartphone, Wallet2, X,
  Languages, Settings as SettingsIcon, Maximize, Minimize, Home, RotateCcw, FileClock,
  User as UserIcon, Lock as LockIcon, LogOut, Wifi, UserPlus, Undo2, History, UserCircle2,
  Zap, Eye, Keyboard, Receipt as ReceiptIcon, Check, List as ListIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Tabs from "../../components/ui/Tabs";
import NumericKeypad from "../../components/ui/NumericKeypad";
import ActionMenu from "../../components/ui/ActionMenu";
import LockOverlay from "../../components/ui/LockOverlay";
import Modal from "../../components/ui/Modal";
import { useAuth } from "../../context/AuthContext";
import { setLanguage } from "../../i18n";
import {
  createDraftSale, listHeldSales, addItem, removeItem,
  updateItemQuantity, completeSale, lookupProduct, setSaleCustomer,
} from "../../api/sales";
import { listProducts, listCategories } from "../../api/catalog";
import { listCustomers, createCustomer, getCustomer, getCustomerSales } from "../../api/customers";

const CATALOG_PAGE_SIZE = 24;
const QUICK_CASH_AMOUNTS = [50, 100, 500, 1000];

// No organization-name field is exposed by the API yet (Organization.name
// exists on the backend but /me and /sales don't return it), so this is
// hardcoded for now. Wire it up to a real field if that changes.
const ORG_NAME = "PonnoSomver";

// Receipt paper width — no backend field for this exists yet (it's a
// per-terminal printer setting, not really organization/sale data), so
// it's kept as a per-browser localStorage setting for now, editable via
// the gear icon in the POS header (see POSSettingsModal). Defaults to
// 80mm, the most common thermal receipt width.
const RECEIPT_WIDTH_STORAGE_KEY = "pos.receiptPaperWidthMm";
const RECEIPT_WIDTH_MIN_MM = 40;
const RECEIPT_WIDTH_MAX_MM = 300;
const RECEIPT_WIDTH_PRESETS_MM = [58, 80];
const DEFAULT_RECEIPT_WIDTH_MM = 80;

function isValidReceiptWidthMm(value) {
  return Number.isFinite(value) && value >= RECEIPT_WIDTH_MIN_MM && value <= RECEIPT_WIDTH_MAX_MM;
}

function getStoredReceiptWidthMm() {
  const stored = Number(localStorage.getItem(RECEIPT_WIDTH_STORAGE_KEY));
  return isValidReceiptWidthMm(stored) ? stored : DEFAULT_RECEIPT_WIDTH_MM;
}

// Invoice format ("thermal" vs "a4") — only "thermal" actually does
// anything right now (drives the receipt preview/print above); "a4" is a
// placeholder for a future A4 PDF invoice. Stored separately from the
// paper-width setting since it gates whether that setting is even shown.
const INVOICE_FORMAT_STORAGE_KEY = "pos.invoiceFormat";
const DEFAULT_INVOICE_FORMAT = "thermal";

function getStoredInvoiceFormat() {
  const stored = localStorage.getItem(INVOICE_FORMAT_STORAGE_KEY);
  return stored === "thermal" || stored === "a4" ? stored : DEFAULT_INVOICE_FORMAT;
}

// Everything below is UI-only for now — POS Settings mirrors a fuller
// settings screen that isn't wired to real behavior yet (no backend
// fields, no functional effect elsewhere in the app). It's still
// persisted per-browser so it doesn't reset every time the modal opens,
// but toggling these currently just changes what's shown in the modal.
// Defaults match what the mock design specifies.
const POS_SETTINGS_STORAGE_KEY = "pos.settings";
const DEFAULT_POS_SETTINGS = {
  quickAddCustomer: true,
  customerPurchaseHistory: true,
  barcodeScanningSound: true,
  enableHoldSales: true,
  enableCustomerPoints: false,
  allowOverselling: false,
  printInvoiceAutomatically: true,
  showProductImages: true,
  showStockQuantity: true,
  showCategories: true,
  showBrands: true,
  itemsPerPage: 12,
  openCashDrawerOnCashPayment: false,
  receiptPrinterName: "",
  enableKeyboardShortcuts: true,
};

function getStoredPOSSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(POS_SETTINGS_STORAGE_KEY));
    return { ...DEFAULT_POS_SETTINGS, ...(stored && typeof stored === "object" ? stored : {}) };
  } catch {
    return { ...DEFAULT_POS_SETTINGS };
  }
}

const PAYMENT_METHODS = [
  { value: "cash", icon: Banknote, labelKey: "pos.methodCash" },
  { value: "card", icon: CreditCard, labelKey: "pos.methodCard" },
  { value: "mobile_banking", icon: Smartphone, labelKey: "pos.methodMobileBanking" },
  { value: "store_credit", icon: Wallet2, labelKey: "pos.methodStoreCredit" },
];

// Units that count whole items — never fractional, always step by exactly 1.
// pcs is obviously whole-count; kg and l are here too because this catalog
// sells them as whole packaged units (a "1kg bag", "5kg bag" — the quantity
// is how many bags, not a fractional weight). gm and ml are the loose,
// precisely-weighed units: 2 decimal places, and +/- steps by the place
// value of whichever digit the cursor is sitting on, so 500 (gm) with the
// caret after the "5" steps 500 → 400 → 300, while the caret after the last
// "0" steps 500 → 499 → 498.
const WHOLE_COUNT_UNITS = new Set([
  "pcs", "pc", "piece", "pieces", "unit", "units",
  "kg", "kgs", "kilogram", "kilograms",
  "l", "ltr", "litre", "litres", "liter", "liters",
]);

function getQuantityFormat(unitCode) {
  const normalized = (unitCode || "").trim().toLowerCase();
  const isWholeCount = !normalized || WHOLE_COUNT_UNITS.has(normalized);
  return {
    decimals: isWholeCount ? 0 : 2,
    cursorStep: !isWholeCount,
  };
}

// Given a numeric string (e.g. "500" or "12.34") and a caret position, works
// out the place value of the digit immediately to the left of the caret —
// that's the amount +/- should add or subtract. Falls back to 1 for empty
// or non-numeric input.
function getCursorStepValue(valueStr, cursorPos) {
  if (!valueStr) return 1;
  const dotIndex = valueStr.indexOf(".");
  const effectiveDot = dotIndex === -1 ? valueStr.length : dotIndex;

  let digitIndex = Math.max(0, (cursorPos ?? valueStr.length) - 1);
  if (valueStr[digitIndex] === ".") digitIndex = Math.max(0, digitIndex - 1);
  if (!/\d/.test(valueStr[digitIndex] || "")) return 1;

  return digitIndex < effectiveDot
    ? Math.pow(10, effectiveDot - digitIndex - 1) // integer-part digit
    : Math.pow(10, -(digitIndex - effectiveDot));  // fractional digit
}

// A print-only stylesheet, injected once, that hides the whole app and
// shows only the receipt preview when the browser print dialog is
// triggered — without this, "Print receipt" printed the entire POS screen
// (header, catalog, cart) onto a full Letter/A4 page. Mirrors the approach
// in PrintLabelsModal.jsx. The receipt is a normal, visible on-screen
// element (the left-hand preview on the success screen) — this stylesheet
// strips its on-screen card styling (border/shadow/rounded corners) and
// pulls it out of the page grid via fixed positioning so it prints
// centered on its own, instead of wherever it happened to sit on screen.
// Width isn't set here — it's user-configurable (see RECEIPT_WIDTH_* above),
// so it's applied dynamically alongside the page size in
// applyReceiptPrintDimensions, right before each print.
const RECEIPT_PRINT_STYLE_ID = "pos-receipt-print-style";
function ensureReceiptPrintStyle() {
  if (document.getElementById(RECEIPT_PRINT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = RECEIPT_PRINT_STYLE_ID;
  style.textContent = `
    @media print {
      body * { visibility: hidden; }
      #pos-receipt-sheet, #pos-receipt-sheet * { visibility: visible; }
      #pos-receipt-sheet {
        position: fixed !important;
        top: 0 !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        z-index: 9999 !important;
        margin: 0 !important;
        padding: 4mm 3mm !important;
        border: none !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// @page's `size` property can't mix a fixed length with `auto` — "size:
// Wmm auto" (what an earlier version of this used, to get a fixed-width
// page whose height fits the content) is invalid and gets silently
// dropped, which is why receipts were printing onto a full Letter/A4 sheet
// with the receipt content stranded in the corner. There's no CSS-only fix
// for "fixed width, height = however tall the content is", so instead this
// measures the receipt's actual rendered height right before printing and
// sets an explicit "Wmm x Ymm" page size (plus the matching sheet width)
// to match it. Called fresh before every print, so it always reflects
// whatever paper width is currently configured.
const RECEIPT_PAGE_SIZE_STYLE_ID = "pos-receipt-page-size-style";
function applyReceiptPrintDimensions(heightPx, widthMm) {
  const heightMm = Math.max(60, Math.ceil((heightPx * 25.4) / 96) + 4);
  let style = document.getElementById(RECEIPT_PAGE_SIZE_STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = RECEIPT_PAGE_SIZE_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `
    @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
    @media print {
      #pos-receipt-sheet {
        width: ${widthMm}mm !important;
        max-width: ${widthMm}mm !important;
      }
    }
  `;
}

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
  const [headerNote, setHeaderNote] = useState("");

  function showHeaderNote(message) {
    setHeaderNote(message);
    setTimeout(() => setHeaderNote(""), 2500);
  }

  // Customer — picker/quick-add modal and, once a customer is attached to
  // the sale, an optional history panel. Both are gated by the
  // quickAddCustomer / customerPurchaseHistory / enableCustomerPoints POS
  // settings (see POSSettingsModal) rather than always shown, since those
  // toggles exist specifically to let a store turn this off.
  const posSettings = getStoredPOSSettings();
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerHistoryOpen, setCustomerHistoryOpen] = useState(false);
  // Full customer record (name/phone/loyalty_points) for whoever is
  // currently attached to the sale — the sale object itself only carries
  // customer_name (see SaleSerializer), not points, so this is fetched
  // separately only when a customer is actually selected.
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    if (!sale?.customer) {
      setSelectedCustomer(null);
      return;
    }
    if (selectedCustomer?.id === sale.customer) return;
    let cancelled = false;
    getCustomer(sale.customer)
      .then((c) => { if (!cancelled) setSelectedCustomer(c); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sale?.customer]);

  async function handleSelectCustomer(customer) {
    const updated = await setSaleCustomer(sale.id, customer ? customer.id : null);
    setSale(updated);
    setSelectedCustomer(customer || null);
    setCustomerPickerOpen(false);
  }

  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState("");
  const scanInputRef = useRef(null);
  const receiptRef = useRef(null);
  const [receiptWidthMm, setReceiptWidthMm] = useState(() => getStoredReceiptWidthMm());
  const [receiptSettingsOpen, setReceiptSettingsOpen] = useState(false);

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
  useEffect(() => { ensureReceiptPrintStyle(); }, []);

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
    if (quantity <= 0) return;
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
    setLanguage(i18n.language === "en" ? "bn" : "en");
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

  function handlePrintReceipt() {
    if (receiptRef.current) applyReceiptPrintDimensions(receiptRef.current.offsetHeight, receiptWidthMm);
    window.print();
  }

  // ==================== HEADER (shared across every screen) ====================

  function Header() {
    return (
      <div className="border-b border-surface-200 bg-white shrink-0">
        <div className="flex items-center justify-between px-4 py-3 gap-3">
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

            <IconButton onClick={() => setCustomerPickerOpen(true)} title={t("pos.customerButton")}>
              {selectedCustomer ? <UserCircle2 size={16} /> : <UserPlus size={16} />}
              <span className="text-xs">
                {selectedCustomer ? (selectedCustomer.name || selectedCustomer.phone || t("pos.walkIn")) : t("pos.walkIn")}
                {posSettings.enableCustomerPoints && selectedCustomer &&
                  ` · ${selectedCustomer.loyalty_points} ${t("pos.loyaltyPointsShort")}`}
              </span>
            </IconButton>

            {selectedCustomer && posSettings.customerPurchaseHistory && (
              <IconButton onClick={() => setCustomerHistoryOpen(true)} title={t("pos.customerHistoryButton")}>
                <History size={16} />
              </IconButton>
            )}

            <div className="h-6 w-px bg-surface-200" />

            <IconButton onClick={() => showHeaderNote(t("pos.returnsComingSoon"))} title={t("pos.returns")}>
              <Undo2 size={16} />
            </IconButton>

            <IconButton onClick={toggleLanguage} title={t("common.language")}>
              <span className="text-xs">{i18n.language === "bn" ? "EN" : "BN"}</span>
            </IconButton>
            <IconButton onClick={() => setReceiptSettingsOpen(true)} title={t("pos.settingsTitle")}>
              <SettingsIcon size={16} />
            </IconButton>
            <IconButton onClick={toggleFullscreen} title={t("common.fullscreen")}>
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </IconButton>

            <div className="h-6 w-px bg-surface-200" />

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
        {headerNote && (
          <div className="px-4 pb-2 text-xs text-ink-400 text-right">{headerNote}</div>
        )}
      </div>
    );
  }

  function Shell({ children }) {
    return (
      <div className="fixed inset-0 z-40 bg-surface-50 flex flex-col">
        <Header />
        <div className="flex-1 min-h-0 p-4 overflow-y-auto">{children}</div>
        {locked && <LockOverlay username={user?.username} onUnlock={() => setLocked(false)} />}
        <POSSettingsModal
          open={receiptSettingsOpen}
          onClose={() => setReceiptSettingsOpen(false)}
          receiptWidthMm={receiptWidthMm}
          onReceiptWidthChange={setReceiptWidthMm}
        />
        <CustomerPickerModal
          open={customerPickerOpen}
          onClose={() => setCustomerPickerOpen(false)}
          onSelect={handleSelectCustomer}
          allowQuickAdd={posSettings.quickAddCustomer}
          showPoints={posSettings.enableCustomerPoints}
        />
        <CustomerHistoryModal
          open={customerHistoryOpen}
          onClose={() => setCustomerHistoryOpen(false)}
          customer={selectedCustomer}
        />
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
                <span className="font-figures font-medium text-ink-900">৳{Number(h.total_amount).toFixed(2)}</span>
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
    const branchName = completedSale.branch_name || t("pos.title");
    const branchAddress = completedSale.branch_address || "";
    const branchPhone = completedSale.branch_phone || "";
    const cashierName = user?.full_name || user?.username || "";
    const receiptDate = new Date(completedSale.sold_at || completedSale.created_at || Date.now()).toLocaleString();
    const receiptItems = completedSale.items || [];
    const receiptPayments = completedSale.payments || [];

    return (
      <Shell>
        <div className="max-w-5xl mx-auto h-full py-6 grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* Receipt preview — this column scrolls on its own when the
              receipt is long; the summary column next to it stays put
              (no shared/outer scrolling). The card's width comes from
              receiptWidthMm (the configurable paper size — see the
              RECEIPT_WIDTH_* constants and POSSettingsModal), and is
              identical on screen and in print, so what's shown here is
              exactly what prints — including the height measured for
              applyReceiptPrintDimensions before printing, since nothing
              re-wraps at a different width. The print stylesheet just
              strips the on-screen card chrome (border/shadow/rounded
              corners) and repositions it to the page for printing — see
              ensureReceiptPrintStyle. */}
          <div className="lg:col-span-3 flex justify-center overflow-y-auto max-h-[calc(100vh-12rem)] py-2">
            <div
              id="pos-receipt-sheet"
              ref={receiptRef}
              style={{ width: `${receiptWidthMm}mm` }}
              className="shrink-0 bg-white rounded-xl border border-surface-200 shadow-sm p-4
                         font-mono text-[11px] leading-snug text-black"
            >
              <div className="text-center">
                <ReceiptLogo />
                <p className="text-sm font-bold">{ORG_NAME}</p>
                <p className="text-xs font-semibold mt-0.5">{branchName}</p>
                {branchAddress && <p className="text-[10px] mt-0.5">{branchAddress}</p>}
                {branchPhone && <p className="text-[10px]">{t("pos.receiptPhone")} {branchPhone}</p>}
                <p className="text-[10px] mt-1">{t("pos.transactionCompleted", { number: completedSale.sale_number })}</p>
              </div>

              <div className="my-2 border-t border-dashed border-black" />

              <div className="space-y-0.5">
                <div className="flex justify-between"><span>{t("pos.receiptDate")}</span><span>{receiptDate}</span></div>
                <div className="flex justify-between"><span>{t("pos.receiptCashier")}</span><span>{cashierName}</span></div>
                <div className="flex justify-between"><span>{t("pos.receiptCustomer")}</span><span>{completedSale.customer_name || t("pos.walkIn")}</span></div>
              </div>

              <div className="my-2 border-t border-dashed border-black" />

              <div className="space-y-1.5">
                {receiptItems.map((item) => (
                  <div key={item.id}>
                    <p className="font-semibold">{item.product_name}</p>
                    <div className="flex justify-between text-[10px]">
                      <span>{Number(item.quantity)} × ৳{Number(item.unit_price).toFixed(2)}</span>
                      <span>৳{Number(item.line_total).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="my-2 border-t border-dashed border-black" />

              <div className="space-y-0.5">
                <div className="flex justify-between"><span>{t("pos.subtotal")}</span><span>৳{Number(completedSale.subtotal).toFixed(2)}</span></div>
                {Number(completedSale.discount_amount) > 0 && (
                  <div className="flex justify-between"><span>{t("pos.discount")}</span><span>-৳{Number(completedSale.discount_amount).toFixed(2)}</span></div>
                )}
                {Number(completedSale.tax_amount) > 0 && (
                  <div className="flex justify-between"><span>{t("pos.tax")}</span><span>৳{Number(completedSale.tax_amount).toFixed(2)}</span></div>
                )}
                <div className="flex justify-between font-bold border-t border-black pt-0.5 mt-0.5">
                  <span>{t("pos.total")}</span><span>৳{Number(completedSale.total_amount).toFixed(2)}</span>
                </div>
              </div>

              <div className="my-2 border-t border-dashed border-black" />

              <div className="space-y-0.5">
                {receiptPayments.map((p) => (
                  <div key={p.id} className="flex justify-between">
                    <span>{t(PAYMENT_METHODS.find((m) => m.value === p.method)?.labelKey || "pos.payment")}</span>
                    <span>৳{Number(p.amount).toFixed(2)}</span>
                  </div>
                ))}
                {remaining < 0 && (
                  <div className="flex justify-between font-semibold">
                    <span>{t("pos.changeDue")}</span><span>৳{Math.abs(remaining).toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="my-2 border-t border-dashed border-black" />
              <p className="text-center text-[10px] mt-2">{t("pos.thankYou")}</p>
            </div>
          </div>

          {/* Sale-complete summary + actions. Stays put (no scrolling) —
              only the receipt column above scrolls. Action buttons are
              stacked full-width rather than side-by-side, so labels like
              "Print receipt" always fit on one line at full size, however
              narrow this column ends up. */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-surface-200 p-8 text-center">
            <CheckCircle2 className="mx-auto text-brand-700 mb-3" size={48} />
            <h2 className="font-display font-semibold text-xl text-ink-900 mb-1">{t("pos.saleComplete")}</h2>
            <p className="text-xs text-ink-400 mb-4">{t("pos.transactionCompleted", { number: completedSale.sale_number })}</p>

            {remaining < 0 && (
              <div className="bg-surface-50 rounded-xl p-4 mb-4">
                <p className="text-xs uppercase tracking-wide text-ink-400">{t("pos.changeDue")}</p>
                <p className="font-figures text-3xl font-semibold text-ink-900">৳{Math.abs(remaining).toFixed(2)}</p>
              </div>
            )}

            <div className="space-y-2">
              <Button variant="outline" className="w-full" onClick={handlePrintReceipt}>
                <Printer size={16} /> {t("pos.printReceipt")}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate("/sales")}>
                {t("pos.backToCart")}
              </Button>
              <Button variant="primary" className="w-full" onClick={handleStartNew}>
                {t("pos.newSale")}
              </Button>
            </div>
          </div>
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
          <p className="text-center font-figures text-5xl font-bold text-ink-900 mb-8">৳{total.toFixed(2)}</p>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-ink-700">{t("pos.amountTendered")}</label>
              <div className="bg-white border border-surface-200 rounded-xl px-4 py-3 flex items-center">
                <span className="font-figures text-2xl text-ink-400 mr-1">৳</span>
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
                    ৳{amt}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setTendered(sale.total_amount)}
                className="w-full py-2 rounded-lg border border-surface-200 bg-white hover:bg-surface-50 text-sm font-medium"
              >
                {t("pos.exactAmount", { amount: `৳${total.toFixed(2)}` })}
              </button>
            </div>

            <NumericKeypad onKeyPress={handleKeypadPress} />
          </div>

          <div className={`mt-6 rounded-xl p-4 flex justify-between items-center ${remaining > 0 ? "bg-accent-100" : "bg-brand-100"}`}>
            <span className="text-sm font-medium text-ink-700">{remaining > 0 ? t("pos.balanceDue") : t("pos.change")}</span>
            <span className="font-figures text-xl font-semibold text-ink-900">৳{Math.abs(remaining).toFixed(2)}</span>
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
                        <div className="flex-1 rounded-lg bg-surface-50 flex items-center justify-center mb-2 overflow-hidden">
                          {adding ? (
                            <Loader2 size={22} className="animate-spin text-brand-700" />
                          ) : (
                            <ProductThumbnail product={product} />
                          )}
                        </div>
                        <span className="font-medium text-ink-900 text-xs leading-snug line-clamp-2">{product.name}</span>
                        <span className="font-figures text-[10px] text-ink-400 mb-1">{product.sku}</span>

                        <div className="flex items-center justify-between gap-1">
                          {/* Unit label — uses unit_code, the actual field
                              ProductSerializer returns (base_unit.code).
                              Renders nothing if a product has none. */}
                          {product.unit_code ? (
                            <span className="text-[10px] text-ink-400 truncate">per {product.unit_code}</span>
                          ) : <span />}

                          <span className="font-figures font-semibold text-[11px] leading-none
                                            text-brand-700 bg-brand-50 border border-brand-200 rounded-md px-1.5 py-1 shrink-0">
                            ৳{Number(product.selling_price).toFixed(2)}
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
                            <CartQuantityControl
                              item={item}
                              onCommit={(qty) => handleQuantityChange(item.id, qty)}
                            />
                            <span className="font-figures text-xs text-ink-400">
                              × ৳{unitPrice.toFixed(2)}
                            </span>
                            <span className="font-figures text-sm font-medium text-ink-900 ml-auto">৳{Number(item.line_total).toFixed(2)}</span>
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
            <div className="h-8 w-px bg-surface-200" />
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
              <p className="text-xs uppercase tracking-wide text-ink-400">{t("pos.totalPayable")}</p>
              <p className="font-figures text-xl font-bold text-ink-900">৳{total.toFixed(2)}</p>
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

// Cart-line quantity control. Behavior depends on the item's unit_code
// (now returned by SaleItemSerializer, mirroring ProductSerializer):
//  - whole-count units (pcs, or no unit at all) → integer value, +/- always
//    steps by 1.
//  - measured units (gm, ml, ...) → 2 decimal places, and +/- steps
//    by the place value of the digit under the caret (so 500 with the caret
//    after the "5" steps by 100; caret at the end steps by 1). The value is
//    also directly editable — click in, type, Enter/blur to commit.
function CartQuantityControl({ item, onCommit }) {
  const { decimals, cursorStep } = getQuantityFormat(item.unit_code);
  const minQuantity = decimals === 0 ? 1 : Math.pow(10, -decimals);
  const serverValue = Number(item.quantity).toFixed(decimals);

  const [draft, setDraft] = useState(serverValue);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(serverValue);
  }, [serverValue, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  function clamp(num) {
    if (Number.isNaN(num)) return Number(serverValue);
    return Number(Math.max(minQuantity, num).toFixed(decimals));
  }

  function commit(rawValue) {
    const next = clamp(parseFloat(rawValue));
    setEditing(false);
    setDraft(next.toFixed(decimals));
    if (next !== Number(item.quantity)) onCommit(next);
  }

  function step(direction) {
    const delta = cursorStep
      ? getCursorStepValue(draft, inputRef.current?.selectionStart ?? draft.length)
      : 1;
    const base = parseFloat(editing ? draft : serverValue) || 0;
    const next = clamp(base + direction * delta);
    setDraft(next.toFixed(decimals));
    onCommit(next);
    // Buttons use onMouseDown+preventDefault to keep focus (and the caret
    // position) in the input, so repeated clicks keep stepping the same digit.
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => step(-1)}
        className="w-6 h-6 rounded-md border border-surface-200 flex items-center justify-center hover:bg-surface-50"
      >
        <Minus size={12} />
      </button>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={editing ? draft : serverValue}
        onFocus={() => setEditing(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") { setDraft(serverValue); setEditing(false); e.currentTarget.blur(); }
        }}
        className="font-figures text-sm w-14 text-center rounded-md border border-transparent
                   hover:border-surface-200 focus:border-brand-500 focus:outline-none py-0.5"
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => step(1)}
        className="w-6 h-6 rounded-md border border-surface-200 flex items-center justify-center hover:bg-surface-50"
      >
        <Plus size={12} />
      </button>
    </div>
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
      <span className="font-figures">{negative && Number(value) > 0 ? "-" : ""}৳{Number(value).toFixed(2)}</span>
    </div>
  );
}

// Store logo for the printed receipt. Expects /icon.png in the frontend's
// public/ folder (served at the site root) — renders nothing if it's
// missing rather than showing a broken-image glyph on the receipt.
function ReceiptLogo() {
  const [error, setError] = useState(false);
  if (error) return null;
  return (
    <img
      src="/icon.png"
      alt=""
      className="h-10 w-10 mx-auto mb-1 object-contain"
      onError={() => setError(true)}
    />
  );
}

// Small reusable pieces for POSSettingsModal below.

function SettingsSection({ icon: Icon, label, children }) {
  return (
    <div>
      <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400 mb-3">
        <Icon size={14} /> {label}
      </h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      // bg-brand-600 doesn't exist in this theme's palette (only
      // 900/700/500/100 are defined — see src/index.css), so it silently
      // produced no background at all, making on/off look identical.
      // brand-700 is an actually-defined shade, plus a border so the off
      // state reads as a track (not just pale fill) against white cards.
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors
                  ${checked ? "bg-brand-700 border-brand-700" : "bg-surface-200 border-surface-200"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform
                    ${checked ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}

function SettingToggle({ label, hint, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-3 bg-white border border-surface-200 rounded-xl p-4">
      <div className="min-w-0">
        <p className="font-medium text-sm text-ink-900">{label}</p>
        {hint && <p className="text-xs text-ink-400 mt-0.5">{hint}</p>}
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  );
}

// Static reference card for the shortcuts POS doesn't actually bind yet —
// listed here so the UI is ready for when they're implemented. Opened via
// "View shortcuts" inside POSSettingsModal's shortcuts section.
const KEYBOARD_SHORTCUTS = [
  { keys: "F2", actionKey: "pos.shortcutFocusSearch" },
  { keys: "F4", actionKey: "pos.shortcutOpenPayment" },
  { keys: "F6", actionKey: "pos.shortcutHoldSale" },
  { keys: "F7", actionKey: "pos.shortcutRecallHeld" },
  { keys: "F8", actionKey: "pos.shortcutQuickAddCustomer" },
  { keys: "F9", actionKey: "pos.shortcutPrintLastReceipt" },
  { keys: "Esc", actionKey: "pos.shortcutClearCart" },
  { keys: "Ctrl + ArrowUp", actionKey: "pos.shortcutIncreaseQty" },
  { keys: "Ctrl + ArrowDown", actionKey: "pos.shortcutDecreaseQty" },
  { keys: "Ctrl + Delete", actionKey: "pos.shortcutRemoveItem" },
  { keys: "Shift + ?", actionKey: "pos.shortcutShowHelp" },
];

function KeyboardShortcutsModal({ open, onClose }) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} title={t("pos.shortcutsModalTitle")} size="lg">
      <p className="text-sm text-ink-400 mb-4">{t("pos.shortcutsModalHint")}</p>
      <div className="divide-y divide-surface-100">
        <div className="flex justify-between pb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
          <span>{t("pos.shortcutColumnShortcut")}</span>
          <span>{t("pos.shortcutColumnAction")}</span>
        </div>
        {KEYBOARD_SHORTCUTS.map((s) => (
          <div key={s.keys} className="flex items-center justify-between py-2.5 gap-4">
            <code className="font-figures text-xs bg-ink-900 text-white rounded-md px-2 py-1 shrink-0">{s.keys}</code>
            <span className="text-sm text-ink-700 text-right">{t(s.actionKey)}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// Customer picker — opened from the header's customer button. Search an
// existing customer by name/phone, pick one, clear back to walk-in, or
// (when the quickAddCustomer setting is on) add a brand-new customer
// without leaving the register. Selecting a row calls onSelect, which the
// parent turns into a POST to /sales/sales/{id}/customer/.
function CustomerPickerModal({ open, onClose, onSelect, allowQuickAdd, showPoints }) {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddPhone, setQuickAddPhone] = useState("");
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [quickAddError, setQuickAddError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSearchInput("");
    setSearch("");
    setQuickAddOpen(false);
    setQuickAddName("");
    setQuickAddPhone("");
    setQuickAddError("");
  }, [open]);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    listCustomers({ search: search || undefined })
      .then((data) => { if (!cancelled) setCustomers(data); })
      .catch(() => { if (!cancelled) setError(t("pos.couldntLoadCustomers")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, search, t]);

  async function handleQuickAddSubmit(e) {
    e.preventDefault();
    if (!quickAddName.trim() && !quickAddPhone.trim()) return;
    setQuickAddSaving(true);
    setQuickAddError("");
    try {
      const customer = await createCustomer({ name: quickAddName.trim(), phone: quickAddPhone.trim() });
      onSelect(customer);
    } catch {
      setQuickAddError(t("customers.couldntSave"));
    } finally {
      setQuickAddSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("pos.customerPickerTitle")} size="md">
      <div className="space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            autoFocus
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("pos.customerSearchPlaceholder")}
            className="input !pl-8"
          />
        </div>

        <Button variant="outline" className="w-full justify-center" onClick={() => onSelect(null)}>
          {t("pos.continueAsWalkIn")}
        </Button>

        <div className="max-h-64 overflow-y-auto -mx-1 px-1 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-ink-400 text-sm py-6">
              <Loader2 size={16} className="animate-spin" /> {t("common.loading")}
            </div>
          ) : error ? (
            <p className="text-danger-600 text-sm py-2">{error}</p>
          ) : customers.length === 0 ? (
            <p className="text-ink-400 text-sm text-center py-6">{t("pos.noCustomersFound")}</p>
          ) : (
            customers.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-surface-200 hover:border-brand-500 hover:bg-surface-50 text-left"
              >
                <div>
                  <p className="text-sm font-medium text-ink-900">{c.name || t("pos.walkIn")}</p>
                  {c.phone && <p className="text-xs text-ink-400 font-figures">{c.phone}</p>}
                </div>
                {showPoints && (
                  <span className="text-xs font-figures text-ink-400">
                    {c.loyalty_points} {t("pos.loyaltyPointsShort")}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {allowQuickAdd && (
          <div className="border-t border-surface-200 pt-3">
            {quickAddOpen ? (
              <form className="space-y-2" onSubmit={handleQuickAddSubmit}>
                <input
                  value={quickAddName}
                  onChange={(e) => setQuickAddName(e.target.value)}
                  placeholder={t("customers.name")}
                  className="input"
                />
                <input
                  value={quickAddPhone}
                  onChange={(e) => setQuickAddPhone(e.target.value)}
                  placeholder={t("customers.phone")}
                  className="input"
                />
                {quickAddError && <p className="text-danger-600 text-sm">{quickAddError}</p>}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1 justify-center" onClick={() => setQuickAddOpen(false)} disabled={quickAddSaving}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" variant="primary" className="flex-1 justify-center" disabled={quickAddSaving}>
                    {quickAddSaving ? t("common.saving") : t("common.save")}
                  </Button>
                </div>
              </form>
            ) : (
              <Button variant="ghost" className="w-full justify-center" onClick={() => setQuickAddOpen(true)}>
                <UserPlus size={16} /> {t("pos.newCustomer")}
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// History panel for whoever is currently attached to the sale — only
// rendered from the header when customerPurchaseHistory is enabled (see
// DEFAULT_POS_SETTINGS). Read-only: this is a quick lookup for the
// cashier, not the full sales report (that's /sales in the admin app).
function CustomerHistoryModal({ open, onClose, customer }) {
  const { t } = useTranslation();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !customer) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    getCustomerSales(customer.id)
      .then((data) => { if (!cancelled) setSales(data); })
      .catch(() => { if (!cancelled) setError(t("pos.couldntLoadCustomers")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, customer, t]);

  return (
    <Modal open={open} onClose={onClose} title={`${t("pos.customerHistoryTitle")} — ${customer?.name || t("pos.walkIn")}`} size="md">
      {loading ? (
        <div className="flex items-center justify-center gap-2 text-ink-400 text-sm py-6">
          <Loader2 size={16} className="animate-spin" /> {t("common.loading")}
        </div>
      ) : error ? (
        <p className="text-danger-600 text-sm">{error}</p>
      ) : sales.length === 0 ? (
        <p className="text-ink-400 text-sm text-center py-6">{t("pos.customerHistoryEmpty")}</p>
      ) : (
        <div className="max-h-80 overflow-y-auto space-y-1">
          {sales.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-surface-200">
              <div>
                <p className="text-sm font-medium text-ink-900 font-figures">{s.sale_number || "—"}</p>
                <p className="text-xs text-ink-400">
                  {new Date(s.sold_at || s.created_at).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium font-figures text-ink-900">৳{Number(s.total_amount).toFixed(2)}</p>
                <Badge tone={s.status === "completed" ? "success" : s.status === "void" ? "danger" : "neutral"}>
                  {s.status.replace("_", " ")}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// The full POS Settings panel opened from the gear icon in the header.
// The invoice-format/paper-width fields, and the customer-related toggles
// (quickAddCustomer, customerPurchaseHistory, enableCustomerPoints — see
// CustomerPickerModal/CustomerHistoryModal above) have a real effect.
// Everything else is still cosmetic for now — see DEFAULT_POS_SETTINGS
// above — but is still persisted so it doesn't reset every time the modal
// is reopened. Hand-rolled rather than built on the shared Modal component
// because the gradient hero header and scrolling body + sticky footer
// don't fit Modal's simpler title-bar shape.
function POSSettingsModal({ open, onClose, receiptWidthMm, onReceiptWidthChange }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(getStoredPOSSettings);
  const [invoiceFormat, setInvoiceFormat] = useState(getStoredInvoiceFormat);
  const [widthSelected, setWidthSelected] = useState(receiptWidthMm);
  const [customWidth, setCustomWidth] = useState("");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    function handleEsc(e) { if (e.key === "Escape") onClose?.(); }
    if (open) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setDraft(getStoredPOSSettings());
    setInvoiceFormat(getStoredInvoiceFormat());
    const isPreset = RECEIPT_WIDTH_PRESETS_MM.includes(receiptWidthMm);
    setWidthSelected(isPreset ? receiptWidthMm : "custom");
    setCustomWidth(isPreset ? "" : String(receiptWidthMm));
  }, [open, receiptWidthMm]);

  if (!open) return null;

  const effectiveWidth = widthSelected === "custom" ? Number(customWidth) : widthSelected;
  const widthValid = isValidReceiptWidthMm(effectiveWidth);
  const canSubmit = invoiceFormat !== "thermal" || widthValid;

  function toggle(key) {
    setDraft((d) => ({ ...d, [key]: !d[key] }));
  }
  function setField(key, value) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function handleSubmit() {
    if (!canSubmit) return;
    localStorage.setItem(POS_SETTINGS_STORAGE_KEY, JSON.stringify(draft));
    localStorage.setItem(INVOICE_FORMAT_STORAGE_KEY, invoiceFormat);
    if (invoiceFormat === "thermal") {
      localStorage.setItem(RECEIPT_WIDTH_STORAGE_KEY, String(effectiveWidth));
      onReceiptWidthChange(effectiveWidth);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} aria-hidden="true" />

      <div role="dialog" aria-modal="true" className="relative w-full max-w-2xl max-h-full bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden">
        {/* Gradient hero header */}
        <div className="shrink-0 relative bg-gradient-to-r from-brand-700 to-brand-500 text-white px-6 py-5">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/90 hover:bg-white/10"
            aria-label="Close"
          >
            <X size={18} />
          </button>
          <h3 className="font-display font-semibold text-xl">{t("pos.settingsTitle")}</h3>
          <p className="text-sm text-white/80 mt-1">{t("pos.settingsSubtitle")}</p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <SettingsSection icon={Zap} label={t("pos.sectionBehavior")}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SettingToggle
                label={t("pos.quickAddCustomerLabel")} hint={t("pos.quickAddCustomerHint")}
                checked={draft.quickAddCustomer} onChange={() => toggle("quickAddCustomer")}
              />
              <SettingToggle
                label={t("pos.customerPurchaseHistoryLabel")} hint={t("pos.customerPurchaseHistoryHint")}
                checked={draft.customerPurchaseHistory} onChange={() => toggle("customerPurchaseHistory")}
              />
              <SettingToggle
                label={t("pos.barcodeScanningSoundLabel")} hint={t("pos.barcodeScanningSoundHint")}
                checked={draft.barcodeScanningSound} onChange={() => toggle("barcodeScanningSound")}
              />
              <SettingToggle
                label={t("pos.enableHoldSalesLabel")} hint={t("pos.enableHoldSalesHint")}
                checked={draft.enableHoldSales} onChange={() => toggle("enableHoldSales")}
              />
              <SettingToggle
                label={t("pos.enableCustomerPointsLabel")} hint={t("pos.enableCustomerPointsHint")}
                checked={draft.enableCustomerPoints} onChange={() => toggle("enableCustomerPoints")}
              />
              <SettingToggle
                label={t("pos.allowOversellingLabel")} hint={t("pos.allowOversellingHint")}
                checked={draft.allowOverselling} onChange={() => toggle("allowOverselling")}
              />
            </div>
            <SettingToggle
              label={t("pos.printInvoiceAutomaticallyLabel")} hint={t("pos.printInvoiceAutomaticallyHint")}
              checked={draft.printInvoiceAutomatically} onChange={() => toggle("printInvoiceAutomatically")}
            />
          </SettingsSection>

          <SettingsSection icon={Eye} label={t("pos.sectionDisplay")}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SettingToggle
                label={t("pos.showProductImagesLabel")} hint={t("pos.showProductImagesHint")}
                checked={draft.showProductImages} onChange={() => toggle("showProductImages")}
              />
              <SettingToggle
                label={t("pos.showStockQuantityLabel")} hint={t("pos.showStockQuantityHint")}
                checked={draft.showStockQuantity} onChange={() => toggle("showStockQuantity")}
              />
              <SettingToggle
                label={t("pos.showCategoriesLabel")} hint={t("pos.showCategoriesHint")}
                checked={draft.showCategories} onChange={() => toggle("showCategories")}
              />
              <SettingToggle
                label={t("pos.showBrandsLabel")} hint={t("pos.showBrandsHint")}
                checked={draft.showBrands} onChange={() => toggle("showBrands")}
              />
            </div>
            <label className="block">
              <span className="block text-sm font-medium text-ink-700 mb-1">{t("pos.itemsPerPageLabel")} *</span>
              <input
                type="number"
                min={1}
                value={draft.itemsPerPage}
                onChange={(e) => setField("itemsPerPage", e.target.value)}
                className="input font-figures"
              />
            </label>
          </SettingsSection>

          <SettingsSection icon={CreditCard} label={t("pos.sectionCashDrawer")}>
            <p className="text-xs text-ink-500 bg-brand-50 border border-brand-100 rounded-lg p-3">
              {t("pos.cashDrawerHint")}
            </p>
            <SettingToggle
              label={t("pos.openCashDrawerLabel")} hint={t("pos.openCashDrawerHint")}
              checked={draft.openCashDrawerOnCashPayment} onChange={() => toggle("openCashDrawerOnCashPayment")}
            />
            <label className="block">
              <span className="block text-sm font-medium text-ink-700 mb-1">{t("pos.receiptPrinterNameLabel")}</span>
              <input
                value={draft.receiptPrinterName}
                onChange={(e) => setField("receiptPrinterName", e.target.value)}
                placeholder={t("pos.receiptPrinterNamePlaceholder")}
                className="input"
              />
              <span className="block text-xs text-ink-400 mt-1">{t("pos.receiptPrinterNameHint")}</span>
            </label>
          </SettingsSection>

          <SettingsSection icon={ReceiptIcon} label={t("pos.sectionReceipt")}>
            <span className="block text-sm font-medium text-ink-700 mb-1">{t("pos.invoiceFormatLabel")}</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setInvoiceFormat("thermal")}
                className={`px-3 py-2 rounded-lg border text-sm font-medium ${
                  invoiceFormat === "thermal" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-ink-700 hover:bg-surface-50"
                }`}
              >
                {t("pos.invoiceFormatThermal")}
              </button>
              <button
                type="button"
                onClick={() => setInvoiceFormat("a4")}
                className={`px-3 py-2 rounded-lg border text-sm font-medium ${
                  invoiceFormat === "a4" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-ink-700 hover:bg-surface-50"
                }`}
              >
                {t("pos.invoiceFormatA4")}
              </button>
            </div>
            <p className="text-xs text-ink-400 mt-1">{t("pos.invoiceFormatHint")}</p>

            {invoiceFormat === "thermal" && (
              <div className="mt-3 pt-3 border-t border-surface-100 space-y-2">
                <span className="block text-sm font-medium text-ink-700">{t("pos.receiptSettingsTitle")}</span>
                {RECEIPT_WIDTH_PRESETS_MM.map((mm) => (
                  <label key={mm} className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
                    <input
                      type="radio"
                      name="pos-settings-receipt-width"
                      checked={widthSelected === mm}
                      onChange={() => setWidthSelected(mm)}
                    />
                    {t(mm === 80 ? "pos.receiptWidth80" : "pos.receiptWidth58")}
                  </label>
                ))}
                <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
                  <input
                    type="radio"
                    name="pos-settings-receipt-width"
                    checked={widthSelected === "custom"}
                    onChange={() => setWidthSelected("custom")}
                  />
                  {t("pos.receiptWidthCustom")}
                  <input
                    type="number"
                    min={RECEIPT_WIDTH_MIN_MM}
                    max={RECEIPT_WIDTH_MAX_MM}
                    value={customWidth}
                    onFocus={() => setWidthSelected("custom")}
                    onChange={(e) => { setWidthSelected("custom"); setCustomWidth(e.target.value); }}
                    placeholder="mm"
                    className="input !w-20 !py-1 text-sm font-figures"
                  />
                </label>
                {widthSelected === "custom" && !widthValid && (
                  <p className="text-xs text-danger-600">
                    {t("pos.receiptWidthRange", { min: RECEIPT_WIDTH_MIN_MM, max: RECEIPT_WIDTH_MAX_MM })}
                  </p>
                )}
              </div>
            )}
          </SettingsSection>

          <SettingsSection icon={Keyboard} label={t("pos.sectionShortcuts")}>
            <p className="text-xs text-ink-500 bg-brand-50 border border-brand-100 rounded-lg p-3">
              {t("pos.shortcutsHint")}
            </p>
            <SettingToggle
              label={t("pos.enableShortcutsLabel")} hint={t("pos.enableShortcutsHint")}
              checked={draft.enableKeyboardShortcuts} onChange={() => toggle("enableKeyboardShortcuts")}
            />
            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              className="flex items-center gap-1.5 text-sm text-brand-700 hover:underline"
            >
              <ListIcon size={14} /> {t("pos.viewShortcuts")}
            </button>
          </SettingsSection>
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 px-6 py-4 border-t border-surface-200 flex justify-end gap-2 bg-surface-50">
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
            {t("common.submit")}
          </Button>
        </div>
      </div>

      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}

function ProductThumbnail({ product }) {
  const [imgError, setImgError] = useState(false);
  if (product.image && !imgError) {
    return (
      <img
        src={product.image}
        alt={product.name}
        className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105"
        onError={() => setImgError(true)}
      />
    );
  }
  return <PackageSearch size={28} className="text-surface-200" />;
}
