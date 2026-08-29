import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";

const EMPTY = {
  username: "", password: "", first_name: "", last_name: "", email: "",
  employee_id: "", phone: "", designation: "", date_joined: "",
};

export default function StaffFormModal({ open, onClose, onSubmit }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setError("");
    }
  }, [open]);

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
      setError(err?.response?.data?.detail || "Couldn't add this staff member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("staff.addStaffTitle")}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>{t("common.cancel")}</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? t("common.saving") : t("staff.addStaff")}
          </Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <p className="text-xs text-ink-400">{t("staff.accountNote")}</p>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("staff.username")}><input value={form.username} onChange={(e) => set("username", e.target.value)} required className="input" /></Field>
          <Field label={t("staff.tempPassword")}><input type="text" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder={t("staff.tempPasswordPlaceholder")} className="input" /></Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("staff.firstName")}><input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} className="input" /></Field>
          <Field label={t("staff.lastName")}><input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} className="input" /></Field>
        </div>

        <Field label={t("staff.email")}><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="input" /></Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("staff.employeeId")}><input value={form.employee_id} onChange={(e) => set("employee_id", e.target.value)} required className="input font-figures" /></Field>
          <Field label={t("staff.phone")}><input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="input" /></Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("staff.designation")}><input value={form.designation} onChange={(e) => set("designation", e.target.value)} placeholder="e.g. Cashier" className="input" /></Field>
          <Field label={t("staff.dateJoined")}><input type="date" value={form.date_joined} onChange={(e) => set("date_joined", e.target.value)} className="input" /></Field>
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
