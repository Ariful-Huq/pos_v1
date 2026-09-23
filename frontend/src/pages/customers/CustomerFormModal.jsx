import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";

const EMPTY = { name: "", phone: "", loyalty_points: 0, is_active: true };

export default function CustomerFormModal({ open, onClose, onSubmit, initial }) {
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
      setError(err?.response?.data?.detail || t("customers.couldntSave"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? t("customers.editCustomer") : t("customers.addCustomer")}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>{t("common.cancel")}</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <label className="block">
          <span className="block text-sm font-medium text-ink-700 mb-1">{t("customers.name")}</span>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} className="input" />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-ink-700 mb-1">{t("customers.phone")}</span>
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="input" />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-ink-700 mb-1">{t("customers.loyaltyPoints")}</span>
          <input
            type="number" min="0" step="1"
            value={form.loyalty_points}
            onChange={(e) => set("loyalty_points", e.target.value === "" ? 0 : Number(e.target.value))}
            className="input font-figures"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
          {t("common.active")}
        </label>

        {error && <p className="text-danger-600 text-sm">{error}</p>}
      </form>
    </Modal>
  );
}
