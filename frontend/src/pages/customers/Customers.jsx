import { useState, useEffect, useCallback } from "react";
import { Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import DataTable from "../../components/ui/DataTable";
import ActionMenu from "../../components/ui/ActionMenu";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import CustomerFormModal from "./CustomerFormModal";
import {
  listCustomers, createCustomer, updateCustomer, deleteCustomer,
} from "../../api/customers";

export default function Customers() {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async (searchTerm) => {
    setLoading(true);
    setError("");
    try {
      setCustomers(await listCustomers({ search: searchTerm || undefined }));
    } catch {
      setError(t("customers.couldntLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(search); }, [load, search]);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  async function handleSubmit(form) {
    if (editing) {
      await updateCustomer(editing.id, form);
    } else {
      await createCustomer(form);
    }
    setFormOpen(false);
    setEditing(null);
    await load(search);
  }

  async function confirmDelete() {
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteCustomer(deleting.id);
      setDeleting(null);
      await load(search);
    } catch (err) {
      setDeleteError(err?.response?.data?.detail || t("customers.couldntSave"));
    } finally {
      setDeleteBusy(false);
    }
  }

  const columns = [
    { key: "name", header: t("customers.name"), sortable: true, render: (r) => r.name || "—" },
    { key: "phone", header: t("customers.phone"), render: (r) => r.phone || "—" },
    { key: "loyalty_points", header: t("customers.loyaltyPoints"), sortable: true, render: (r) => (
      <span className="font-figures">{r.loyalty_points}</span>
    )},
    { key: "is_active", header: t("common.status"), render: (r) => (
      <Badge tone={r.is_active ? "success" : "neutral"}>{r.is_active ? t("common.active") : t("common.inactive")}</Badge>
    )},
    { key: "actions", header: "", render: (r) => (
      <ActionMenu items={[
        { label: t("common.edit"), onClick: () => { setEditing(r); setFormOpen(true); } },
        { divider: true },
        { label: t("common.delete"), danger: true, onClick: () => { setDeleting(r); setDeleteError(""); } },
      ]} />
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-ink-400">{t("customers.count", { count: customers.length })}</p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("customers.searchPlaceholder")}
              className="input !pl-8 py-1.5 text-sm w-56"
            />
          </div>
          <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus size={16} /> {t("customers.addCustomer")}
          </Button>
        </div>
      </div>

      {error && <p className="text-danger-600 text-sm">{error}</p>}

      {loading ? (
        <div className="bg-white rounded-xl border border-surface-200 p-10 text-center text-ink-400">{t("common.loading")}</div>
      ) : (
        <DataTable columns={columns} data={customers} rowKey={(r) => r.id} emptyLabel={t("customers.noCustomers")} />
      )}

      <CustomerFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSubmit={handleSubmit}
        initial={editing}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={t("customers.deleteCustomerTitle")}
        message={
          <>
            <p className="mb-2">{t("customers.deleteCustomerMessage", { name: deleting?.name || t("pos.walkIn") })}</p>
            {deleteError && <p className="text-danger-600 text-sm">{deleteError}</p>}
          </>
        }
        confirmLabel={t("common.delete")}
        loading={deleteBusy}
      />
    </div>
  );
}
