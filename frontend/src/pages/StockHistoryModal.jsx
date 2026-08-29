import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../components/ui/Modal";
import Badge from "../components/ui/Badge";
import { listMovements } from "../api/inventory";

const TYPE_TONE = {
  purchase: "success",
  sale: "brand",
  adjustment: "warning",
  transfer_in: "success",
  transfer_out: "warning",
  return_in: "success",
  return_out: "warning",
};

export default function StockHistoryModal({ open, onClose, stockLevel }) {
  const { t } = useTranslation();
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && stockLevel) {
      setLoading(true);
      listMovements(stockLevel.product).then(setMovements).finally(() => setLoading(false));
    }
  }, [open, stockLevel]);

  if (!stockLevel) return null;

  return (
    <Modal open={open} onClose={onClose} title={`${t("inventory.history")} — ${stockLevel.product_name}`} size="lg">
      {loading ? (
        <p className="text-center text-ink-400 py-6">{t("common.loading")}</p>
      ) : movements.length === 0 ? (
        <p className="text-center text-ink-400 py-6">{t("inventory.noMovements")}</p>
      ) : (
        <div className="max-h-96 overflow-y-auto space-y-2">
          {movements.map((m) => (
            <div key={m.id} className="flex items-center justify-between border-b border-surface-100 pb-2">
              <div>
                <Badge tone={TYPE_TONE[m.movement_type] || "neutral"}>{m.movement_type.replace("_", " ")}</Badge>
                {m.notes && <p className="text-xs text-ink-400 mt-1">{m.notes}</p>}
              </div>
              <div className="text-right">
                <p className={`font-figures font-medium ${Number(m.quantity) < 0 ? "text-danger-600" : "text-brand-700"}`}>
                  {Number(m.quantity) > 0 ? "+" : ""}{m.quantity}
                </p>
                <p className="text-xs text-ink-400">{new Date(m.created_at).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
