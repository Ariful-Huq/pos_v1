import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import Button from "../components/ui/Button";
import DataTable from "../components/ui/DataTable";
import ExpenseFormModal from "./ExpenseFormModal";
import { listExpenses, createExpense, listExpenseCategories } from "../api/expenses";

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [expenseData, categoryData] = await Promise.all([listExpenses(), listExpenseCategories()]);
      setExpenses(expenseData);
      setCategories(categoryData);
    } catch (err) {
      setError("Couldn't load expenses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(form) {
    await createExpense(form);
    setFormOpen(false);
    await load();
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const columns = [
    { key: "expense_date", header: "Date", sortable: true },
    { key: "category_name", header: "Category", sortable: true },
    { key: "description", header: "Description" },
    { key: "payment_method", header: "Method" },
    { key: "amount", header: "Amount", sortable: true, render: (r) => (
      <span className="font-figures font-medium">৳{Number(r.amount).toFixed(2)}</span>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-400">
          {expenses.length} expense{expenses.length !== 1 ? "s" : ""} — total{" "}
          <span className="font-figures text-ink-900 font-medium">৳{total.toFixed(2)}</span>
        </p>
        <Button variant="primary" onClick={() => setFormOpen(true)}>
          <Plus size={16} /> Add Expense
        </Button>
      </div>

      {error && <p className="text-danger-600 text-sm">{error}</p>}

      {loading ? (
        <div className="bg-white rounded-xl border border-surface-200 p-10 text-center text-ink-400">Loading…</div>
      ) : (
        <DataTable columns={columns} data={expenses} rowKey={(r) => r.id} emptyLabel="No expenses recorded yet." />
      )}

      <ExpenseFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
        categories={categories}
        onCategoryAdded={(c) => setCategories((cs) => [...cs, c])}
      />
    </div>
  );
}
