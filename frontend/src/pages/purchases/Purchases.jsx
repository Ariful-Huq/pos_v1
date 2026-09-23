import { useState, useEffect, useCallback } from "react";
import { Plus, PackageCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Tabs from "../../components/ui/Tabs";
import DataTable from "../../components/ui/DataTable";
import ActionMenu from "../../components/ui/ActionMenu";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import PurchaseOrderFormModal from "./PurchaseOrderFormModal";
import ReceivePurchaseModal from "./ReceivePurchaseModal";
import SupplierFormModal from "./SupplierFormModal";
import ProductFormModal from "../products/ProductFormModal";
import {
  listPurchaseOrders, createPurchaseOrder, listSuppliers,
  createSupplier, updateSupplier, deleteSupplier,
} from "../../api/purchases";
import { listProducts, createProduct, listCategories, listUnits } from "../../api/catalog";

const STATUS_TONE = {
  draft: "neutral",
  ordered: "warning",
  partially_received: "warning",
  received: "success",
  cancelled: "danger",
};

export default function Purchases() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("orders");

  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState(null);

  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [deletingSupplier, setDeletingSupplier] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Lets a user create a product mid-PO without losing their PO form state.
  const [productFormOpen, setProductFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [poData, supplierData, productData, categoryData, unitData] = await Promise.all([
        listPurchaseOrders(),
        listSuppliers(),
        listProducts({ page_size: 200 }),
        listCategories(),
        listUnits(),
      ]);
      setOrders(poData);
      setSuppliers(supplierData);
      setProducts(productData.results);
      setCategories(categoryData);
      setUnits(unitData);
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

  async function handleNewProduct(form) {
    const product = await createProduct(form);
    setProductFormOpen(false);
    // Refresh the product list so the new item is immediately pickable
    // in the still-open PO form.
    const productData = await listProducts({ page_size: 200 });
    setProducts(productData.results);
    return product;
  }

  async function handleSupplierSubmit(form) {
    if (editingSupplier) {
      await updateSupplier(editingSupplier.id, form);
    } else {
      await createSupplier(form);
    }
    setSupplierFormOpen(false);
    setEditingSupplier(null);
    await load();
  }

  async function confirmDeleteSupplier() {
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteSupplier(deletingSupplier.id);
      setDeletingSupplier(null);
      await load();
    } catch (err) {
      setDeleteError(
        err?.response?.data?.detail ||
        t("purchases.supplierDeleteBlocked")
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  const orderColumns = [
    { key: "reference_number", header: t("purchases.reference"), sortable: true, render: (r) => (
      <div className="flex items-center gap-1.5">
        <span className="font-figures">{r.reference_number}</span>
        {r.is_supplier_reference && <Badge tone="neutral">{t("purchases.supplierRef")}</Badge>}
      </div>
    )},
    { key: "supplier_name", header: t("purchases.supplier"), sortable: true },
    { key: "branch_name", header: t("purchases.warehouse"), sortable: true, render: (r) => (
      <span>{r.branch_name} <span className="font-figures text-xs text-ink-400">({r.branch_code})</span></span>
    )},
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

  const supplierColumns = [
    { key: "name", header: t("purchases.supplierName"), sortable: true },
    { key: "phone", header: t("settings.phone"), render: (r) => r.phone || "—" },
    { key: "email", header: t("staff.email"), render: (r) => r.email || "—" },
    { key: "is_active", header: t("common.status"), render: (r) => (
      <Badge tone={r.is_active ? "success" : "neutral"}>{r.is_active ? t("common.active") : t("common.inactive")}</Badge>
    )},
    { key: "actions", header: "", render: (r) => (
      <ActionMenu items={[
        { label: t("common.edit"), onClick: () => { setEditingSupplier(r); setSupplierFormOpen(true); } },
        { divider: true },
        { label: t("common.delete"), danger: true, onClick: () => { setDeletingSupplier(r); setDeleteError(""); } },
      ]} />
    )},
  ];

  return (
    <div className="space-y-4">
      <Tabs
        tabs={[
          { value: "orders", label: t("purchases.purchaseOrders") },
          { value: "suppliers", label: t("purchases.suppliers") },
        ]}
        active={tab}
        onChange={setTab}
      />

      {error && <p className="text-danger-600 text-sm">{error}</p>}

      {loading ? (
        <div className="bg-white rounded-xl border border-surface-200 p-10 text-center text-ink-400">{t("common.loading")}</div>
      ) : tab === "orders" ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-400">{t("purchases.count", { count: orders.length })}</p>
            <Button variant="primary" onClick={() => setFormOpen(true)}>
              <Plus size={16} /> {t("purchases.newPO")}
            </Button>
          </div>
          <DataTable columns={orderColumns} data={orders} rowKey={(r) => r.id} emptyLabel={t("purchases.noOrders")} />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-400">{t("purchases.supplierCount", { count: suppliers.length })}</p>
            <Button variant="primary" onClick={() => { setEditingSupplier(null); setSupplierFormOpen(true); }}>
              <Plus size={16} /> {t("purchases.addSupplier")}
            </Button>
          </div>
          <DataTable columns={supplierColumns} data={suppliers} rowKey={(r) => r.id} emptyLabel={t("purchases.noSuppliers")} />
        </>
      )}

      <PurchaseOrderFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
        suppliers={suppliers}
        products={products}
        onRequestNewProduct={() => setProductFormOpen(true)}
      />

      <ProductFormModal
        open={productFormOpen}
        onClose={() => setProductFormOpen(false)}
        onSubmit={handleNewProduct}
        categories={categories}
        units={units}
        initial={null}
      />

      <ReceivePurchaseModal
        open={!!receiveTarget}
        onClose={() => setReceiveTarget(null)}
        purchaseOrder={receiveTarget}
        onReceived={handleReceived}
      />

      <SupplierFormModal
        open={supplierFormOpen}
        onClose={() => { setSupplierFormOpen(false); setEditingSupplier(null); }}
        onSubmit={handleSupplierSubmit}
        initial={editingSupplier}
      />

      <ConfirmDialog
        open={!!deletingSupplier}
        onClose={() => setDeletingSupplier(null)}
        onConfirm={confirmDeleteSupplier}
        title={t("purchases.deleteSupplierTitle")}
        message={
          <>
            <p className="mb-2">{t("purchases.deleteSupplierMessage", { name: deletingSupplier?.name })}</p>
            {deleteError && <p className="text-danger-600 text-sm">{deleteError}</p>}
          </>
        }
        confirmLabel={t("common.delete")}
        loading={deleteBusy}
      />
    </div>
  );
}
