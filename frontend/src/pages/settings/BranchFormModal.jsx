import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";

const EMPTY = { name: "", code: "", address: "", phone: "", is_active: true };

export default function BranchFormModal({ open, onClose, onSubmit, initial }) {
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
      setError(err?.response?.data?.detail || err?.response?.data?.code?.[0] || "Couldn't save this branch.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? t("settings.editBranch") : t("settings.addBranch")}
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
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm font-medium text-ink-700 mb-1">{t("settings.branchName")}</span>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} required className="input" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-ink-700 mb-1">{t("settings.branchCode")}</span>
            <input value={form.code} onChange={(e) => set("code", e.target.value)} required placeholder="e.g. DHK-02" className="input font-figures" />
          </label>
        </div>

        <label className="block">
          <span className="block text-sm font-medium text-ink-700 mb-1">{t("settings.address")}</span>
          <textarea value={form.address} onChange={(e) => set("address", e.target.value)} rows={2} className="input" />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-ink-700 mb-1">{t("settings.phone")}</span>
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="input" />
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
