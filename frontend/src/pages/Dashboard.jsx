import { useState } from "react";
import { Plus } from "lucide-react";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Tabs from "../components/ui/Tabs";
import DataTable from "../components/ui/DataTable";
import ActionMenu from "../components/ui/ActionMenu";
import ConfirmDialog from "../components/ui/ConfirmDialog";

// Placeholder data — replace with real API calls once the sales/products
// endpoints exist. This exists to prove out DataTable/ActionMenu/Badge.
const SAMPLE_SALES = [
  { id: "1", sale_number: "DHK-01-000001", customer: "Walk-in", total: 175.0, status: "completed" },
  { id: "2", sale_number: "DHK-01-000002", customer: "Walk-in", total: 420.0, status: "draft" },
  { id: "3", sale_number: "DHK-01-000003", customer: "Rahim Uddin", total: 95.5, status: "void" },
];

const STATUS_TONE = {
  completed: "success",
  draft: "warning",
  void: "danger",
  refunded: "neutral",
};

export default function Dashboard() {
  const [tab, setTab] = useState("recent");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetSale, setTargetSale] = useState(null);

  function askVoid(sale) {
    setTargetSale(sale);
    setConfirmOpen(true);
  }

  const columns = [
    { key: "sale_number", header: "Invoice", sortable: true, render: (r) => (
      <span className="font-figures">{r.sale_number}</span>
    )},
    { key: "customer", header: "Customer", sortable: true },
    { key: "total", header: "Total", sortable: true, render: (r) => (
      <span className="font-figures">৳{r.total.toFixed(2)}</span>
    )},
    { key: "status", header: "Status", render: (r) => (
      <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
    )},
    { key: "actions", header: "", render: (r) => (
      <ActionMenu items={[
        { label: "View", onClick: () => {} },
        { label: "Print invoice", onClick: () => {} },
        { divider: true },
        { label: "Void sale", danger: true, disabled: r.status !== "completed", onClick: () => askVoid(r) },
      ]} />
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Tabs
          tabs={[
            { value: "recent", label: "Recent Sales" },
            { value: "held", label: "Held Sales" },
          ]}
          active={tab}
          onChange={setTab}
        />
        <Button variant="primary">
          <Plus size={16} /> New Sale
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={SAMPLE_SALES}
        rowKey={(r) => r.id}
        emptyLabel="No sales yet"
      />

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
        title="Void this sale?"
        message={`This will reverse the stock deduction for ${targetSale?.sale_number}. This cannot be undone.`}
        confirmLabel="Void sale"
      />
    </div>
  );
}
