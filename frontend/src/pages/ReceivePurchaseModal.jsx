import { useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { receiveItem } from "../api/purchases";

export default function ReceivePurchaseModal({ open, onClose, purchaseOrder, onReceived }) {
  const { t } = useTranslation();
  const [quantities, setQuantities] = useState({});
  const [busyItemId, setBusyItemId] = useState(null);
  const [error, setError] = useState("");

  if (!purchaseOrder) return null;

  async function handleReceive(item) {
    const qty = parseFloat(quantities[item.id]);
    if (!qty || qty <= 0) return;
    setBusyItemId(item.id);
    setError("");
    try {
      const updated = await receiveItem(purchaseOrder.id, item.id, qty);
      onReceived(updated);
      setQuantities((q) => ({ ...q, [item.id]: "" }));
    } catch (err) {
      setError(err?.response?.data?.detail || "Couldn't receive this item.");
    } finally {
      setBusyItemId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`${t("purchases.receiveItems")} — ${purchaseOrder.reference_number}`} size="lg">
      <div className="space-y-3">
        {purchaseOrder.items.map((item) => {
          const remaining = item.quantity_ordered - item.quantity_received;
          return (
            <div key={item.id} className="flex items-center justify-between border border-surface-200 rounded-lg p-3">
              <div>
                <div className="font-medium text-ink-900">{item.product_name}</div>
                <div className="font-figures text-xs text-ink-400">
                  {item.product_sku} — {item.quantity_ordered} / {item.quantity_received}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {remaining <= 0 ? (
                  <Badge tone="success">{t("purchases.fullyReceived")}</Badge>
                ) : (
                  <>
                    <input
                      type="number"
                      min="0"
                      max={remaining}
                      placeholder={`${remaining}`}
                      value={quantities[item.id] || ""}
                      onChange={(e) => setQuantities((q) => ({ ...q, [item.id]: e.target.value }))}
                      className="input w-24 font-figures"
                    />
                    <Button
                      size="sm"
                      variant="brand"
                      disabled={busyItemId === item.id}
                      onClick={() => handleReceive(item)}
                    >
                      {busyItemId === item.id ? "…" : t("purchases.receive")}
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {error && <p className="text-danger-600 text-sm">{error}</p>}
      </div>
    </Modal>
  );
}
