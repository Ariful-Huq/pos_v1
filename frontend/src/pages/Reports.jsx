import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, PackageX } from "lucide-react";
import { useTranslation } from "react-i18next";
import StatCard from "../components/ui/StatCard";
import MiniBarChart from "../components/ui/MiniBarChart";
import DataTable from "../components/ui/DataTable";
import Tabs from "../components/ui/Tabs";
import { getSummary, getTopProducts } from "../api/reports";

const PERIOD_VALUES = [7, 30, 90];

export default function Reports() {
  const { t } = useTranslation();
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (period) => {
    setLoading(true);
    const [summaryData, topData] = await Promise.all([
      getSummary(period),
      getTopProducts(period, 5),
    ]);
    setSummary(summaryData);
    setTopProducts(topData);
    setLoading(false);
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  const chartData = summary?.daily_sales.map((d) => ({
    label: d.date.slice(5),
    value: Number(d.total),
  })) || [];

  const productColumns = [
    { key: "sku", header: t("products.sku"), render: (r) => <span className="font-figures">{r.sku}</span> },
    { key: "name", header: t("products.name") },
    { key: "quantity_sold", header: t("reports.unitsSold"), sortable: true, render: (r) => (
      <span className="font-figures">{r.quantity_sold}</span>
    )},
    { key: "revenue", header: t("reports.revenue"), sortable: true, render: (r) => (
      <span className="font-figures font-medium">৳{Number(r.revenue).toFixed(2)}</span>
    )},
  ];

  return (
    <div className="space-y-6">
      <Tabs
        tabs={PERIOD_VALUES.map((p) => ({ value: p, label: t("reports.daysLabel", { count: p }) }))}
        active={days}
        onChange={setDays}
      />

      {loading || !summary ? (
        <div className="bg-white rounded-xl border border-surface-200 p-10 text-center text-ink-400">{t("common.loading")}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label={t("reports.sales")} value={`৳${Number(summary.sales_total).toFixed(2)}`} sub={t("reports.saleCount", { count: summary.sales_count })} tone="success" />
            <StatCard label={t("reports.expenses")} value={`৳${Number(summary.expenses_total).toFixed(2)}`} tone="danger" />
            <StatCard label={t("reports.grossProfit")} value={`৳${Number(summary.gross_profit).toFixed(2)}`} tone={summary.gross_profit >= 0 ? "success" : "danger"} />
            <StatCard label={t("reports.avgSale")} value={`৳${Number(summary.avg_sale).toFixed(2)}`} />
          </div>

          {(summary.low_stock_count > 0 || summary.out_of_stock_count > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {summary.out_of_stock_count > 0 && (
                <div className="flex items-center gap-3 bg-danger-100 border border-danger-500/20 rounded-xl p-4">
                  <PackageX className="text-danger-600" size={20} />
                  <div>
                    <p className="font-medium text-danger-600">{t("reports.outOfStockAlert", { count: summary.out_of_stock_count })}</p>
                    <p className="text-xs text-ink-400">{t("reports.checkInventory")}</p>
                  </div>
                </div>
              )}
              {summary.low_stock_count > 0 && (
                <div className="flex items-center gap-3 bg-accent-100 border border-accent-500/20 rounded-xl p-4">
                  <AlertTriangle className="text-accent-600" size={20} />
                  <div>
                    <p className="font-medium text-accent-600">{t("reports.lowStockAlert", { count: summary.low_stock_count })}</p>
                    <p className="text-xs text-ink-400">{t("reports.considerPO")}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl border border-surface-200 p-4">
            <h3 className="font-display font-semibold text-sm text-ink-900 mb-3">{t("reports.salesTrend")}</h3>
            <MiniBarChart data={chartData} />
          </div>

          <div>
            <h3 className="font-display font-semibold text-sm text-ink-900 mb-3">{t("reports.topProducts")}</h3>
            <DataTable columns={productColumns} data={topProducts} rowKey={(r) => r.sku} emptyLabel={t("reports.noSalesPeriod")} />
          </div>
        </>
      )}
    </div>
  );
}
