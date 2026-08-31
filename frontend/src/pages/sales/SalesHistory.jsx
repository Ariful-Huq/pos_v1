import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import DataTable from "../../components/ui/DataTable";
import ActionMenu from "../../components/ui/ActionMenu";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { listAllSales, voidSale } from "../../api/sales";

const STATUS_TONE = {
  completed: "success",
  draft: "warning",
  void: "danger",
  refunded: "neutral",
  partially_refunded: "neutral",
};

export default function SalesHistory() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidBusy, setVoidBusy] = useState(false);
  const [voidError, setVoidError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSales(await listAllSales());
    } catch {
      setError("Couldn't load sales.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function askVoid(sale) {
    setVoidTarget(sale);
    setVoidReason("");
    setVoidError("");
  }

  async function confirmVoid() {
    setVoidBusy(true);
    setVoidError("");
    try {
      await voidSale(voidTarget.id, voidReason);
      setVoidTarget(null);
      await load();
    } catch (err) {
      setVoidError(err?.response?.data?.detail || "Couldn't void this sale.");
    } finally {
      setVoidBusy(false);
    }
  }

  const columns = [
    { key: "sale_number", header: t("salesHistory.invoice"), sortable: true, render: (r) => (
      <span className="font-figures">{r.sale_number || "—"}</span>
    )},
    { key: "customer_name", header: t("dashboard.customer"), render: (r) => r.customer_name || t("pos.walkIn") },
    { key: "branch_code", header: t("salesHistory.branch"), render: (r) => <span className="font-figures">{r.branch_code}</span> },
    { key: "total_amount", header: t("pos.total"), sortable: true, render: (r) => (
      <span className="font-figures font-medium">৳{Number(r.total_amount).toFixed(2)}</span>
    )},
    { key: "status", header: t("common.status"), render: (r) => (
      <Badge tone={STATUS_TONE[r.status]}>{r.status.replace("_", " ")}</Badge>
    )},
    { key: "created_at", header: t("salesHistory.date"), render: (r) => new Date(r.created_at).toLocaleString() },
    { key: "actions", header: "", render: (r) => (
      <ActionMenu items={[
        { label: t("salesHistory.voidSale"), danger: true, disabled: r.status !== "completed", onClick: () => askVoid(r) },
      ]} />
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-400">{sales.length} sale{sales.length !== 1 ? "s" : ""}</p>
        <Button variant="primary" onClick={() => navigate("/pos")}>
          <Plus size={16} /> {t("pos.openRegister")}
        </Button>
      </div>

      {error && <p className="text-danger-600 text-sm">{error}</p>}

      {loading ? (
        <div className="bg-white rounded-xl border border-surface-200 p-10 text-center text-ink-400">{t("common.loading")}</div>
      ) : (
        <DataTable columns={columns} data={sales} rowKey={(r) => r.id} emptyLabel={t("dashboard.noSales")} />
      )}

      <ConfirmDialog
        open={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        onConfirm={confirmVoid}
        title={t("salesHistory.voidTitle")}
        message={
          <>
            <p className="mb-2">{t("salesHistory.voidMessage", { number: voidTarget?.sale_number })}</p>
            <input
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder={t("salesHistory.reasonPlaceholder")}
              className="input text-sm"
            />
            {voidError && <p className="text-danger-600 text-sm mt-2">{voidError}</p>}
          </>
        }
        confirmLabel={t("salesHistory.voidSale")}
        loading={voidBusy}
      />
    </div>
  );
}
