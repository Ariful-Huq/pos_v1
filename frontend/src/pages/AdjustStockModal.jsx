import { useState, useEffect } from "react";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import { adjustStock } from "../api/inventory";

export default function AdjustStockModal({ open, onClose, stockLevel, onAdjusted }) {
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setQuantity("");
      setNotes("");
      setError("");
    }
  }, [open]);

  if (!stockLevel) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await adjustStock(stockLevel.product, parseFloat(quantity), notes);
      onAdjusted();
    } catch (err) {
      setError(err?.response?.data?.detail || "Couldn't adjust stock.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Adjust stock — ${stockLevel.product_name}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving || !quantity}>
            {saving ? "Saving…" : "Apply adjustment"}
          </Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <p className="text-sm text-ink-400">
          Current stock: <span className="font-figures text-ink-900">{stockLevel.quantity}</span>
        </p>

        <label className="block">
          <span className="block text-sm font-medium text-ink-700 mb-1">
            Adjustment (use a negative number to remove stock)
          </span>
          <input
            type="number"
            step="0.001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. -2 or 10"
            required
            autoFocus
            className="input font-figures"
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-ink-700 mb-1">Reason</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Damaged during delivery, stock count correction…"
            rows={2}
            className="input"
          />
        </label>

        {error && <p className="text-danger-600 text-sm">{error}</p>}
      </form>
    </Modal>
  );
}
