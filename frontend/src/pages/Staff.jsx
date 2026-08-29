import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import DataTable from "../components/ui/DataTable";
import StaffFormModal from "./StaffFormModal";
import { listStaff, createStaff } from "../api/staff";

export default function Staff() {
  const { t } = useTranslation();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setStaff(await listStaff());
    } catch (err) {
      setError("Couldn't load staff.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(form) {
    await createStaff(form);
    setFormOpen(false);
    await load();
  }

  const columns = [
    { key: "full_name", header: t("staff.name"), sortable: true },
    { key: "employee_id", header: t("staff.employeeId"), sortable: true, render: (r) => (
      <span className="font-figures">{r.employee_id}</span>
    )},
    { key: "designation", header: t("staff.designation") },
    { key: "primary_branch_name", header: t("staff.primaryBranch"), render: (r) => r.primary_branch_name || "—" },
    { key: "is_active", header: t("common.status"), render: (r) => (
      <Badge tone={r.is_active ? "success" : "neutral"}>{r.is_active ? t("common.active") : t("common.inactive")}</Badge>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-400">{t("staff.count", { count: staff.length })}</p>
        <Button variant="primary" onClick={() => setFormOpen(true)}>
          <Plus size={16} /> {t("staff.addStaff")}
        </Button>
      </div>

      {error && <p className="text-danger-600 text-sm">{error}</p>}

      {loading ? (
        <div className="bg-white rounded-xl border border-surface-200 p-10 text-center text-ink-400">{t("common.loading")}</div>
      ) : (
        <DataTable columns={columns} data={staff} rowKey={(r) => r.id} emptyLabel={t("staff.noStaff")} />
      )}

      <StaffFormModal open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleCreate} />
    </div>
  );
}
