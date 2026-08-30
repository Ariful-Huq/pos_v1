import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import StatCard from "../../components/ui/StatCard";
import DataTable from "../../components/ui/DataTable";
import { getSummary } from "../../api/reports";
import { listRecentSales } from "../../api/sales";

const STATUS_TONE = {
  completed: "success",
  draft: "warning",
  void: "danger",
  refunded: "neutral",
  partially_refunded: "neutral",
};

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSummary(1), listRecentSales(5)]).then(([s, sales]) => {
      setSummary(s);
      setRecentSales(sales);
      setLoading(false);
    });
  }, []);

  const columns = [
    { key: "sale_number", header: t("dashboard.invoice"), render: (r) => <span className="font-figures">{r.sale_number}</span> },
    { key: "customer_name", header: t("dashboard.customer"), render: (r) => r.customer_name || t("pos.walkIn") },
    { key: "total_amount", header: t("pos.total"), render: (r) => (
      <span className="font-figures">৳{Number(r.total_amount).toFixed(2)}</span>
    )},
    { key: "status", header: t("common.status"), render: (r) => (
      <Badge tone={STATUS_TONE[r.status]}>{r.status.replace("_", " ")}</Badge>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => navigate("/sales")}>
            <Plus size={16} /> {t("pos.newSale")}
          </Button>
          <Button variant="outline" onClick={() => navigate("/products")}>
            <Package size={16} /> {t("products.addProduct")}
          </Button>
        </div>
      </div>

      {loading || !summary ? (
        <div className="bg-white rounded-xl border border-surface-200 p-10 text-center text-ink-400">{t("common.loading")}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label={t("dashboard.todaysSales")} value={`৳${Number(summary.sales_total).toFixed(2)}`} sub={t("reports.saleCount", { count: summary.sales_count })} tone="success" />
          <StatCard label={t("dashboard.todaysExpenses")} value={`৳${Number(summary.expenses_total).toFixed(2)}`} tone="danger" />
          <StatCard label={t("dashboard.outOfStock")} value={summary.out_of_stock_count} tone={summary.out_of_stock_count > 0 ? "danger" : "neutral"} />
          <StatCard label={t("dashboard.lowStock")} value={summary.low_stock_count} tone={summary.low_stock_count > 0 ? "warning" : "neutral"} />
        </div>
      )}

      <div>
        <h3 className="font-display font-semibold text-sm text-ink-900 mb-3">{t("dashboard.recentSales")}</h3>
        <DataTable columns={columns} data={recentSales} rowKey={(r) => r.id} emptyLabel={t("dashboard.noSales")} />
      </div>
    </div>
  );
}
