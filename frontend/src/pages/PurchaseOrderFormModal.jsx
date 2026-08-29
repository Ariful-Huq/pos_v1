import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";

const EMPTY_LINE = { product: "", quantity_ordered: "1", unit_cost: "0" };

export default function PurchaseOrderFormModal({ open, onClose, onSubmit, suppliers, products }) {
  const { t } = useTranslation();
  const [supplier, setSupplier] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState("");
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSupplier("");
      setOrderDate(new Date().toISOString().slice(0, 10));
      setExpectedDate("");
      setLines([{ ...EMPTY_LINE }]);
      setError("");
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

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        supplier,
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
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="block text-sm font-medium text-ink-700 mb-1">{t("purchases.supplier")}</span>
            <select value={supplier} onChange={(e) => setSupplier(e.target.value)} required className="input">
              <option value="">{t("common.selectEllipsis")}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
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

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-ink-700">{t("purchases.items")}</span>
            <button type="button" onClick={addLine} className="text-xs text-brand-700 hover:underline flex items-center gap-1">
              <Plus size={14} /> {t("purchases.addLine")}
            </button>
          </div>

          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select
                  value={line.product}
                  onChange={(e) => updateLine(i, "product", e.target.value)}
                  className="input flex-1"
                >
                  <option value="">{t("common.selectEllipsis")}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                  ))}
                </select>
                <input
                  type="number" min="1" placeholder={t("pos.qty")}
                  value={line.quantity_ordered}
                  onChange={(e) => updateLine(i, "quantity_ordered", e.target.value)}
                  className="input w-24 font-figures"
                />
                <input
                  type="number" step="0.01" placeholder={t("products.costPrice")}
                  value={line.unit_cost}
                  onChange={(e) => updateLine(i, "unit_cost", e.target.value)}
                  className="input w-28 font-figures"
                />
                {lines.length > 1 && (
                  <button type="button" onClick={() => removeLine(i)} className="text-danger-500">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-danger-600 text-sm">{error}</p>}
      </form>
    </Modal>
  );
}
