import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import Tabs from "../../components/ui/Tabs";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import DataTable from "../../components/ui/DataTable";
import ActionMenu from "../../components/ui/ActionMenu";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import BranchFormModal from "./BranchFormModal";
import {
  getOrganization,
  updateOrganization,
  listBranches,
  createBranch,
  updateBranch,
  deleteBranch,
} from "../../api/tenants";

export default function Settings() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("profile");

  const [org, setOrg] = useState(null);
  const [orgForm, setOrgForm] = useState(null);
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgSaved, setOrgSaved] = useState(false);

  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [orgData, branchData] = await Promise.all([getOrganization(), listBranches()]);
    setOrg(orgData);
    setOrgForm(orgData);
    setBranches(branchData);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSaveOrg(e) {
    e.preventDefault();
    setOrgSaving(true);
    setOrgSaved(false);
    try {
      const updated = await updateOrganization(orgForm);
      setOrg(updated);
      setOrgSaved(true);
    } finally {
      setOrgSaving(false);
    }
  }

  function openAddBranch() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEditBranch(branch) {
    setEditing(branch);
    setFormOpen(true);
  }

  async function handleBranchSubmit(form) {
    if (editing) {
      await updateBranch(editing.id, form);
    } else {
      await createBranch(form);
    }
    setFormOpen(false);
    await load();
  }

  function askDeleteBranch(branch) {
    setDeleting(branch);
    setDeleteError("");
    setConfirmOpen(true);
  }

  async function confirmDeleteBranch() {
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteBranch(deleting.id);
      setConfirmOpen(false);
      await load();
    } catch (err) {
      setDeleteError(err?.response?.data?.detail || "Couldn't delete this branch.");
    } finally {
      setDeleteBusy(false);
    }
  }

  const branchColumns = [
    { key: "code", header: t("settings.branchCode"), sortable: true, render: (r) => <span className="font-figures">{r.code}</span> },
    { key: "name", header: t("settings.branchName"), sortable: true },
    { key: "phone", header: t("settings.phone") },
    { key: "is_active", header: t("common.status"), render: (r) => (
      <Badge tone={r.is_active ? "success" : "neutral"}>{r.is_active ? t("common.active") : t("common.inactive")}</Badge>
    )},
    { key: "actions", header: "", render: (r) => (
      <ActionMenu items={[
        { label: t("common.edit"), onClick: () => openEditBranch(r) },
        { divider: true },
        { label: t("common.delete"), danger: true, onClick: () => askDeleteBranch(r) },
      ]} />
    )},
  ];

  return (
    <div className="space-y-4">
      <Tabs
        tabs={[
          { value: "profile", label: t("settings.businessProfile") },
          { value: "branches", label: t("settings.branches") },
        ]}
        active={tab}
        onChange={setTab}
      />

      {loading ? (
        <div className="bg-white rounded-xl border border-surface-200 p-10 text-center text-ink-400">{t("common.loading")}</div>
      ) : tab === "profile" ? (
        <form onSubmit={handleSaveOrg} className="bg-white rounded-xl border border-surface-200 p-6 max-w-lg space-y-3">
          <label className="block">
            <span className="block text-sm font-medium text-ink-700 mb-1">{t("settings.businessName")}</span>
            <input value={orgForm.name} onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))} required className="input" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-ink-700 mb-1">{t("settings.legalName")}</span>
            <input value={orgForm.legal_name} onChange={(e) => setOrgForm((f) => ({ ...f, legal_name: e.target.value }))} className="input" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-ink-700 mb-1">{t("settings.contactEmail")}</span>
              <input type="email" value={orgForm.contact_email} onChange={(e) => setOrgForm((f) => ({ ...f, contact_email: e.target.value }))} className="input" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-ink-700 mb-1">{t("settings.contactPhone")}</span>
              <input value={orgForm.contact_phone} onChange={(e) => setOrgForm((f) => ({ ...f, contact_phone: e.target.value }))} className="input" />
            </label>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" variant="primary" disabled={orgSaving}>
              {orgSaving ? t("common.saving") : t("common.save")}
            </Button>
            {orgSaved && <span className="text-sm text-brand-700">{t("settings.saved")}</span>}
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="primary" onClick={openAddBranch}>
              <Plus size={16} /> {t("settings.addBranch")}
            </Button>
          </div>
          {deleteError && <p className="text-danger-600 text-sm">{deleteError}</p>}
          <DataTable columns={branchColumns} data={branches} rowKey={(r) => r.id} emptyLabel={t("settings.noBranches")} />
        </div>
      )}

      <BranchFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleBranchSubmit}
        initial={editing}
      />

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmDeleteBranch}
        title={t("settings.deleteBranchTitle")}
        message={t("settings.deleteBranchMessage", { name: deleting?.name })}
        confirmLabel={t("common.delete")}
        loading={deleteBusy}
      />
    </div>
  );
}
