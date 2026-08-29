import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";

const EMPTY = {
  sku: "",
  name: "",
  category: "",
  base_unit: "",
  cost_price: "",
  selling_price: "",
  tax_rate: "0",
};

export default function ProductFormModal({ open, onClose, onSubmit, categories, units, initial }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...EMPTY, ...initial } : EMPTY);
      setError("");
    }
  }, [open, initial]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err?.response?.data?.detail || "Something went wrong — check the fields and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? t("products.editProduct") : t("products.addProduct")}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>{t("common.cancel")}</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? t("common.saving") : t("products.saveProduct")}
          </Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("products.sku")}>
            <input
              value={form.sku}
              onChange={(e) => set("sku", e.target.value)}
              required
              className="input font-figures"
            />
          </Field>
          <Field label={t("products.name")}>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
              className="input"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("products.category")}>
            <select value={form.category} onChange={(e) => set("category", e.target.value)} className="input">
              <option value="">{t("common.none")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("products.baseUnit")}>
            <select value={form.base_unit} onChange={(e) => set("base_unit", e.target.value)} required className="input">
              <option value="">{t("common.selectEllipsis")}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.code}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label={t("products.costPrice")}>
            <input type="number" step="0.01" value={form.cost_price} onChange={(e) => set("cost_price", e.target.value)} className="input font-figures" />
          </Field>
          <Field label={t("products.sellingPrice")}>
            <input type="number" step="0.01" value={form.selling_price} onChange={(e) => set("selling_price", e.target.value)} required className="input font-figures" />
          </Field>
          <Field label={t("products.taxPercent")}>
            <input type="number" step="0.01" value={form.tax_rate} onChange={(e) => set("tax_rate", e.target.value)} className="input font-figures" />
          </Field>
        </div>

        {error && <p className="text-danger-600 text-sm">{error}</p>}
      </form>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink-700 mb-1">{label}</span>
      {children}
    </label>
  );
}
