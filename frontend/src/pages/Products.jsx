import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import DataTable from "../components/ui/DataTable";
import ActionMenu from "../components/ui/ActionMenu";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import ProductFormModal from "./ProductFormModal";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  listCategories,
  listUnits,
} from "../api/catalog";

export default function Products() {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [productData, categoryData, unitData] = await Promise.all([
        listProducts(),
        listCategories(),
        listUnits(),
      ]);
      setProducts(productData.results);
      setCategories(categoryData);
      setUnits(unitData);
    } catch (err) {
      setError("Couldn't load products — check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(product) {
    setEditing(product);
    setFormOpen(true);
  }

  async function handleSubmit(form) {
    if (editing) {
      await updateProduct(editing.id, form);
    } else {
      await createProduct(form);
    }
    setFormOpen(false);
    await load();
  }

  function askDelete(product) {
    setDeleting(product);
    setConfirmOpen(true);
  }

  async function confirmDelete() {
    setDeleteBusy(true);
    try {
      await deleteProduct(deleting.id);
      setConfirmOpen(false);
      await load();
    } finally {
      setDeleteBusy(false);
    }
  }

  const columns = [
    { key: "sku", header: t("products.sku"), sortable: true, render: (r) => (
      <span className="font-figures">{r.sku}</span>
    )},
    { key: "name", header: t("products.name"), sortable: true },
    { key: "category_name", header: t("products.category"), render: (r) => r.category_name || "—" },
    { key: "selling_price", header: t("products.price"), sortable: true, render: (r) => (
      <span className="font-figures">৳{Number(r.selling_price).toFixed(2)}</span>
    )},
    { key: "is_active", header: t("common.status"), render: (r) => (
      <Badge tone={r.is_active ? "success" : "neutral"}>{r.is_active ? t("common.active") : t("common.inactive")}</Badge>
    )},
    { key: "actions", header: "", render: (r) => (
      <ActionMenu items={[
        { label: t("common.edit"), onClick: () => openEdit(r) },
        { divider: true },
        { label: t("common.delete"), danger: true, onClick: () => askDelete(r) },
      ]} />
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-400">{t("products.count", { count: products.length })}</p>
        <Button variant="primary" onClick={openAdd}>
          <Plus size={16} /> {t("products.addProduct")}
        </Button>
      </div>

      {error && <p className="text-danger-600 text-sm">{error}</p>}

      {loading ? (
        <div className="bg-white rounded-xl border border-surface-200 p-10 text-center text-ink-400">
          {t("common.loading")}
        </div>
      ) : (
        <DataTable columns={columns} data={products} rowKey={(r) => r.id} emptyLabel={t("products.noProducts")} />
      )}

      <ProductFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        categories={categories}
        units={units}
        initial={editing}
      />

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
        title={t("products.deleteTitle")}
        message={t("products.deleteMessage", { name: deleting?.name })}
        confirmLabel={t("common.delete")}
        loading={deleteBusy}
      />
    </div>
  );
}
