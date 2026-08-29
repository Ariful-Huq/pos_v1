import { useState, useEffect, useCallback } from "react";
import { History, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import Badge from "../components/ui/Badge";
import DataTable from "../components/ui/DataTable";
import ActionMenu from "../components/ui/ActionMenu";
import AdjustStockModal from "./AdjustStockModal";
import StockHistoryModal from "./StockHistoryModal";
import { listStockLevels } from "../api/inventory";

const LOW_STOCK_THRESHOLD = 10;

export default function Inventory() {
  const { t } = useTranslation();
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [adjustTarget, setAdjustTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setLevels(await listStockLevels());
    } catch (err) {
      setError("Couldn't load stock levels — check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleAdjusted() {
    setAdjustTarget(null);
    load();
  }

  const columns = [
    { key: "product_sku", header: t("inventory.sku"), sortable: true, render: (r) => (
      <span className="font-figures">{r.product_sku}</span>
    )},
    { key: "product_name", header: t("inventory.product"), sortable: true },
    { key: "branch_name", header: t("inventory.branch"), sortable: true },
    { key: "quantity", header: t("inventory.stock"), sortable: true, render: (r) => (
      <span className="font-figures font-medium">{r.quantity}</span>
    )},
    { key: "status", header: "", render: (r) => (
      Number(r.quantity) <= 0
        ? <Badge tone="danger">{t("inventory.outOfStock")}</Badge>
        : Number(r.quantity) <= LOW_STOCK_THRESHOLD
          ? <Badge tone="warning">{t("inventory.lowStock")}</Badge>
          : null
    )},
    { key: "actions", header: "", render: (r) => (
      <ActionMenu items={[
        { label: t("inventory.adjustStock"), icon: <SlidersHorizontal size={14} />, onClick: () => setAdjustTarget(r) },
        { label: t("inventory.viewHistory"), icon: <History size={14} />, onClick: () => setHistoryTarget(r) },
      ]} />
    )},
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-400">{t("inventory.count", { count: levels.length })}</p>

      {error && <p className="text-danger-600 text-sm">{error}</p>}

      {loading ? (
        <div className="bg-white rounded-xl border border-surface-200 p-10 text-center text-ink-400">{t("common.loading")}</div>
      ) : (
        <DataTable columns={columns} data={levels} rowKey={(r) => r.id} emptyLabel={t("inventory.noRecords")} />
      )}

      <AdjustStockModal
        open={!!adjustTarget}
        onClose={() => setAdjustTarget(null)}
        stockLevel={adjustTarget}
        onAdjusted={handleAdjusted}
      />

      <StockHistoryModal
        open={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        stockLevel={historyTarget}
      />
    </div>
  );
}
