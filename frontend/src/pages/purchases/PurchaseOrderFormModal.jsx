import { useState, useEffect } from "react";
import { Plus, Trash2, PackagePlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { listBranches } from "../../api/tenants";

const EMPTY_LINE = { product: "", quantity_ordered: "1", unit_cost: "0" };

export default function PurchaseOrderFormModal({
  open, onClose, onSubmit, suppliers, products, onRequestNewProduct,
}) {
  const { t } = useTranslation();
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState([]);
  const [supplier, setSupplier] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState("");
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSupplier("");
      setReferenceNumber("");
      setOrderDate(new Date().toISOString().slice(0, 10));
      setExpectedDate("");
      setLines([{ ...EMPTY_LINE }]);
      setError("");
      listBranches()
        .then((bs) => {
          setBranches(bs);
          // Default to the currently active branch if it's in the list,
          // otherwise the first one — but it stays explicitly editable,
          // since a PO is often raised for a different location.
          const active = localStorage.getItem("active_branch_id");
          setBranch(bs.find((b) => b.id === active)?.id || bs[0]?.id || "");
        })
        .catch(() => setBranches([]));
    }
  }, [open]);

  function updateLine(index, field, value) {
    setLines((ls) => ls.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  function addLine() {
    setLines((ls) => [...ls, { ...EMPTY_LINE }]);
  }

  function removeLine(index) {
    setLines((ls) => ls.filter((_, i) => i !== index));
  }

  const totalCost = lines.reduce(
    (sum, l) => sum + (parseFloat(l.quantity_ordered) || 0) * (parseFloat(l.unit_cost) || 0),
    0
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        branch,
        supplier,
        // Only sent when the user actually typed one — otherwise the
        // backend generates a gapless sequential number for this branch.
        ...(referenceNumber.trim() ? { reference_number: referenceNumber.trim() } : {}),
        order_date: orderDate,
        expected_date: expectedDate || null,
        items: lines
          .filter((l) => l.product)
          .map((l) => ({
            product: l.product,
            quantity_ordered: l.quantity_ordered,
            unit_cost: l.unit_cost,
          })),
      });
    } catch (err) {
      setError(err?.response?.data?.detail || "Couldn't create the purchase order — check the fields.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("purchases.newPOTitle")}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>{t("common.cancel")}</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? t("common.saving") : t("purchases.createPO")}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm font-medium text-ink-700 mb-1">{t("purchases.warehouse")}</span>
            <select value={branch} onChange={(e) => setBranch(e.target.value)} required className="input">
              <option value="">{t("common.selectEllipsis")}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-ink-700 mb-1">{t("purchases.supplier")}</span>
            <select value={supplier} onChange={(e) => setSupplier(e.target.value)} required className="input">
              <option value="">{t("common.selectEllipsis")}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="block text-sm font-medium text-ink-700 mb-1">{t("purchases.supplierReference")}</span>
            <input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder={t("purchases.autoGenerated")}
              className="input font-figures placeholder:font-body placeholder:text-ink-400"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-ink-700 mb-1">{t("purchases.orderDate")}</span>
            <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} required className="input" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-ink-700 mb-1">{t("purchases.expectedDate")}</span>
            <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="input" />
          </label>
        </div>
        <p className="text-xs text-ink-400 -mt-1">{t("purchases.supplierReferenceHint")}</p>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-ink-700">{t("purchases.items")}</span>
            <div className="flex items-center gap-3">
              {onRequestNewProduct && (
                <button type="button" onClick={onRequestNewProduct} className="text-xs text-brand-700 hover:underline flex items-center gap-1">
                  <PackagePlus size={14} /> {t("purchases.newProduct")}
                </button>
              )}
              <button type="button" onClick={addLine} className="text-xs text-brand-700 hover:underline flex items-center gap-1">
                <Plus size={14} /> {t("purchases.addLine")}
              </button>
            </div>
          </div>

          {/* Column headers + rows share one grid template so labels
              always sit directly above the input they describe. The old
              version used a flex row with fixed-width header spans, which
              drifted out of alignment and squeezed the product select to
              zero width. */}
          <div className="hidden sm:grid grid-cols-[1fr_7rem_8rem_7rem_2rem] gap-2 items-center mb-1 px-0.5">
            <span className="text-xs uppercase tracking-wide text-ink-400">{t("purchases.product")}</span>
            <span className="text-xs uppercase tracking-wide text-ink-400">{t("purchases.qtyOrdered")}</span>
            <span className="text-xs uppercase tracking-wide text-ink-400">{t("purchases.purchasePrice")}</span>
            <span className="text-xs uppercase tracking-wide text-ink-400 text-right">{t("purchases.lineTotal")}</span>
            <span />
          </div>

          <div className="space-y-2">
            {lines.map((line, i) => {
              const lineTotal = (parseFloat(line.quantity_ordered) || 0) * (parseFloat(line.unit_cost) || 0);
              return (
                <div
                  key={i}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_7rem_8rem_7rem_2rem] gap-2 items-center"
                >
                  <label className="block sm:contents">
                    <span className="sm:hidden block text-xs uppercase tracking-wide text-ink-400 mb-1">
                      {t("purchases.product")}
                    </span>
                    <select
                      value={line.product}
                      onChange={(e) => updateLine(i, "product", e.target.value)}
                      className="input w-full min-w-0"
                    >
                      <option value="">{t("purchases.selectProduct")}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block sm:contents">
                    <span className="sm:hidden block text-xs uppercase tracking-wide text-ink-400 mb-1">
                      {t("purchases.qtyOrdered")}
                    </span>
                    <input
                      type="number" min="0" step="0.001"
                      value={line.quantity_ordered}
                      onChange={(e) => updateLine(i, "quantity_ordered", e.target.value)}
                      className="input w-full min-w-0 font-figures"
                    />
                  </label>

                  <label className="block sm:contents">
                    <span className="sm:hidden block text-xs uppercase tracking-wide text-ink-400 mb-1">
                      {t("purchases.purchasePrice")}
                    </span>
                    <input
                      type="number" step="0.01"
                      value={line.unit_cost}
                      onChange={(e) => updateLine(i, "unit_cost", e.target.value)}
                      className="input w-full min-w-0 font-figures"
                    />
                  </label>

                  <span className="text-right font-figures text-sm text-ink-900 tabular-nums">
                    ৳{lineTotal.toFixed(2)}
                  </span>

                  <div className="flex justify-end">
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        className="text-danger-500 hover:text-danger-600 p-1"
                        title={t("common.delete")}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end mt-3 pt-2 border-t border-surface-200">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-ink-700">{t("purchases.totalCost")}</span>
              <span className="font-figures text-lg font-semibold text-ink-900">৳{totalCost.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {error && <p className="text-danger-600 text-sm">{error}</p>}
      </form>
    </Modal>
  );
}
