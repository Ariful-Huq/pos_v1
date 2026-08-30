import { useState, useEffect, useCallback } from "react";
import { Plus, PackageCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import DataTable from "../../components/ui/DataTable";
import ActionMenu from "../../components/ui/ActionMenu";
import PurchaseOrderFormModal from "./PurchaseOrderFormModal";
import ReceivePurchaseModal from "./ReceivePurchaseModal";
import { listPurchaseOrders, createPurchaseOrder, listSuppliers } from "../../api/purchases";
import { listProducts } from "../../api/catalog";

const STATUS_TONE = {
  draft: "neutral",
  ordered: "warning",
  partially_received: "warning",
  received: "success",
  cancelled: "danger",
};

export default function Purchases() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [poData, supplierData, productData] = await Promise.all([
        listPurchaseOrders(),
        listSuppliers(),
        listProducts({ page_size: 200 }),
      ]);
      setOrders(poData);
      setSuppliers(supplierData);
      setProducts(productData.results);
    } catch (err) {
      setError("Couldn't load purchases — check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(payload) {
    await createPurchaseOrder(payload);
    setFormOpen(false);
    await load();
  }

  function handleReceived(updatedPO) {
    setOrders((os) => os.map((o) => (o.id === updatedPO.id ? updatedPO : o)));
    setReceiveTarget(updatedPO);
  }

  const columns = [
    { key: "reference_number", header: t("purchases.reference"), sortable: true, render: (r) => (
      <span className="font-figures">{r.reference_number}</span>
    )},
    { key: "supplier_name", header: t("purchases.supplier"), sortable: true },
    { key: "order_date", header: t("purchases.orderDate"), sortable: true },
    { key: "status", header: t("common.status"), render: (r) => (
      <Badge tone={STATUS_TONE[r.status]}>{r.status.replace("_", " ")}</Badge>
    )},
    { key: "actions", header: "", render: (r) => (
      <ActionMenu items={[
        { label: t("purchases.receiveItems"), icon: <PackageCheck size={14} />, disabled: r.status === "received", onClick: () => setReceiveTarget(r) },
      ]} />
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-400">{t("purchases.count", { count: orders.length })}</p>
        <Button variant="primary" onClick={() => setFormOpen(true)}>
          <Plus size={16} /> {t("purchases.newPO")}
        </Button>
      </div>

      {error && <p className="text-danger-600 text-sm">{error}</p>}

      {loading ? (
        <div className="bg-white rounded-xl border border-surface-200 p-10 text-center text-ink-400">{t("common.loading")}</div>
      ) : (
        <DataTable columns={columns} data={orders} rowKey={(r) => r.id} emptyLabel={t("purchases.noOrders")} />
      )}

      <PurchaseOrderFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
        suppliers={suppliers}
        products={products}
      />

      <ReceivePurchaseModal
        open={!!receiveTarget}
        onClose={() => setReceiveTarget(null)}
        purchaseOrder={receiveTarget}
        onReceived={handleReceived}
      />
    </div>
  );
}
