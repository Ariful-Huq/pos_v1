import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import { createExpenseCategory } from "../api/expenses";

const EMPTY = { category: "", amount: "", expense_date: "", payment_method: "cash", description: "" };

export default function ExpenseFormModal({ open, onClose, onSubmit, categories, onCategoryAdded }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, expense_date: new Date().toISOString().slice(0, 10) });
      setError("");
    }
  }, [open]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    const created = await createExpenseCategory({ name: newCategoryName.trim() });
    onCategoryAdded(created);
    set("category", created.id);
    setNewCategoryName("");
    setAddingCategory(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err?.response?.data?.detail || "Couldn't save the expense.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add expense"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : "Save expense"}
          </Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm font-medium text-ink-700 mb-1">Category</span>
            {addingCategory ? (
              <div className="flex gap-1">
                <input
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category name"
                  className="input"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCategory(); } }}
                />
                <Button type="button" size="sm" variant="outline" onClick={handleAddCategory}>Add</Button>
              </div>
            ) : (
              <div className="flex gap-1">
                <select value={form.category} onChange={(e) => set("category", e.target.value)} required className="input flex-1">
                  <option value="">Select…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={() => setAddingCategory(true)} className="px-2 text-brand-700" title="Add category">
                  <Plus size={18} />
                </button>
              </div>
            )}
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-ink-700 mb-1">Amount</span>
            <input type="number" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} required className="input font-figures" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm font-medium text-ink-700 mb-1">Date</span>
            <input type="date" value={form.expense_date} onChange={(e) => set("expense_date", e.target.value)} required className="input" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-ink-700 mb-1">Payment method</span>
            <select value={form.payment_method} onChange={(e) => set("payment_method", e.target.value)} className="input">
              <option value="cash">Cash</option>
              <option value="bank">Bank Transfer</option>
              <option value="mobile_banking">Mobile Banking</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="block text-sm font-medium text-ink-700 mb-1">Description</span>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} className="input" />
        </label>

        {error && <p className="text-danger-600 text-sm">{error}</p>}
      </form>
    </Modal>
  );
}
