import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import DataTable from "../components/ui/DataTable";
import StaffFormModal from "./StaffFormModal";
import { listStaff, createStaff } from "../api/staff";

export default function Staff() {
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
    { key: "full_name", header: "Name", sortable: true },
    { key: "employee_id", header: "Employee ID", sortable: true, render: (r) => (
      <span className="font-figures">{r.employee_id}</span>
    )},
    { key: "designation", header: "Designation" },
    { key: "primary_branch_name", header: "Primary Branch", render: (r) => r.primary_branch_name || "—" },
    { key: "is_active", header: "Status", render: (r) => (
      <Badge tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "Active" : "Inactive"}</Badge>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-400">{staff.length} staff member{staff.length !== 1 ? "s" : ""}</p>
        <Button variant="primary" onClick={() => setFormOpen(true)}>
          <Plus size={16} /> Add Staff
        </Button>
      </div>

      {error && <p className="text-danger-600 text-sm">{error}</p>}

      {loading ? (
        <div className="bg-white rounded-xl border border-surface-200 p-10 text-center text-ink-400">Loading…</div>
      ) : (
        <DataTable columns={columns} data={staff} rowKey={(r) => r.id} emptyLabel="No staff added yet." />
      )}

      <StaffFormModal open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleCreate} />
    </div>
  );
}
