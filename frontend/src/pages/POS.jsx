import { useState, useEffect, useRef, useCallback } from "react";
import { Scan, Plus, Trash2, CheckCircle2, PauseCircle, Clock } from "lucide-react";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import {
  createDraftSale,
  listHeldSales,
  addItem,
  removeItem,
  updateItemQuantity,
  completeSale,
  lookupProduct,
} from "../api/sales";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "mobile_banking", label: "Mobile Banking" },
  { value: "store_credit", label: "Store Credit" },
];

export default function POS() {
  const [mode, setMode] = useState("loading"); // loading | choosing | checkout | completed
  const [heldSales, setHeldSales] = useState([]);
  const [emptyDraft, setEmptyDraft] = useState(null); // a reusable empty cart, if one exists
  const [sale, setSale] = useState(null);
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState("");
  const [payments, setPayments] = useState([{ method: "cash", amount: "0", reference: "" }]);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");
  const [completedSale, setCompletedSale] = useState(null);
  const scanInputRef = useRef(null);

  const loadHeldSales = useCallback(async () => {
    setMode("loading");
    const held = await listHeldSales();
    // A draft with zero items isn't meaningfully "held" — it's either a
    // fresh cart someone hasn't touched yet, or one abandoned by
    // navigating away. Never show it as a held-sale card; reuse it as
    // the next new sale instead of letting empty drafts pile up.
    const withItems = held.filter((h) => h.items.length > 0);
    const reusable = held.find((h) => h.items.length === 0) || null;
    setEmptyDraft(reusable);

    if (withItems.length === 0) {
      if (reusable) {
        setSale(reusable);
      } else {
        setSale(await createDraftSale());
      }
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

  // Keep a single default payment row synced to the running total.
  useEffect(() => {
    if (sale && payments.length === 1) {
      setPayments([{ ...payments[0], amount: sale.total_amount }]);
    }
  }, [sale?.total_amount]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setScanError(err?.response?.status === 404 ? "No product matches that code." : "Couldn't add item.");
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
    return <div className="text-center text-ink-400 py-10">Loading…</div>;
  }

  if (mode === "choosing") {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <h2 className="font-display font-semibold text-lg text-ink-900">Held sales</h2>
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
                  <p className="text-xs text-ink-400">{h.customer_name || "Walk-in"}</p>
                </div>
              </div>
              <span className="font-figures font-medium text-ink-900">৳{Number(h.total_amount).toFixed(2)}</span>
            </button>
          ))}
        </div>
        <Button variant="primary" className="w-full" onClick={handleStartNew}>
          <Plus size={16} /> Start new sale
        </Button>
      </div>
    );
  }

  if (mode === "completed" && completedSale) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-xl border border-surface-200 p-8 text-center">
        <CheckCircle2 className="mx-auto text-brand-700 mb-3" size={40} />
        <h2 className="font-display font-semibold text-xl text-ink-900 mb-1">Sale complete</h2>
        <p className="font-figures text-2xl text-brand-900 mb-1">{completedSale.sale_number}</p>
        <p className="text-ink-400 text-sm mb-6">
          Total <span className="font-figures">৳{Number(completedSale.total_amount).toFixed(2)}</span>
        </p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => window.print()}>Print receipt</Button>
          <Button variant="primary" onClick={handleStartNew}>New sale</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Cart */}
      <div className="lg:col-span-2 space-y-4">
        <form onSubmit={handleScan} className="flex gap-2">
          <div className="relative flex-1">
            <Scan className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={18} />
            <input
              ref={scanInputRef}
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              placeholder="Scan barcode or type SKU, then press Enter"
              autoFocus
              className="input pl-10 font-figures"
            />
          </div>
          <Button type="submit" variant="brand">
            <Plus size={16} /> Add
          </Button>
          <Button type="button" variant="outline" onClick={handleHold}>
            <PauseCircle size={16} /> Hold
          </Button>
        </form>
        {scanError && <p className="text-danger-600 text-sm">{scanError}</p>}

        <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
          {sale.items.length === 0 ? (
            <p className="text-center text-ink-400 py-12">Cart is empty — scan an item to begin.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-left text-xs uppercase text-ink-400">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item) => (
                  <tr key={item.id} className="border-b border-surface-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-900">{item.product_name}</div>
                      <div className="font-figures text-xs text-ink-400">{item.product_sku}</div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        className="w-16 px-2 py-1 rounded-lg border border-surface-200 font-figures text-sm"
                      />
                    </td>
                    <td className="px-4 py-3 font-figures">৳{Number(item.unit_price).toFixed(2)}</td>
                    <td className="px-4 py-3 font-figures font-medium">৳{Number(item.line_total).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleRemove(item.id)} className="text-danger-500 hover:text-danger-600">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Payment panel */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-surface-200 p-4 space-y-2">
          <Row label="Subtotal" value={sale.subtotal} />
          <Row label="Discount" value={sale.discount_amount} negative />
          <Row label="Tax" value={sale.tax_amount} />
          <div className="border-t border-surface-200 pt-2">
            <Row label="Total" value={sale.total_amount} bold />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-surface-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-sm text-ink-900">Payment</h3>
            <button onClick={addPaymentLine} className="text-xs text-brand-700 hover:underline">
              + Split payment
            </button>
          </div>

          {payments.map((p, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select
                value={p.method}
                onChange={(e) => updatePaymentLine(i, "method", e.target.value)}
                className="input text-sm flex-1"
              >
                {PAYMENT_METHODS.map((m) => (
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
            <span className="text-ink-400">{balance > 0 ? "Balance due" : "Change"}</span>
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
            {completing ? "Completing…" : "Complete Sale"}
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
