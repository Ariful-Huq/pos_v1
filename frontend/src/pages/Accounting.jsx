import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import Tabs from "../components/ui/Tabs";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import { listAccounts, listJournalEntries } from "../api/accounting";

const TYPE_TONE = {
  asset: "brand", liability: "warning", equity: "neutral", income: "success", expense: "danger",
};

export default function Accounting() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("accounts");
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, e] = await Promise.all([listAccounts(), listJournalEntries()]);
    setAccounts(a);
    setEntries(e);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const accountColumns = [
    { key: "code", header: t("accounting.code"), sortable: true, render: (r) => <span className="font-figures">{r.code}</span> },
    { key: "name", header: t("accounting.account"), sortable: true },
    { key: "account_type", header: t("accounting.type"), render: (r) => (
      <Badge tone={TYPE_TONE[r.account_type]}>{r.account_type}</Badge>
    )},
    { key: "balance", header: t("accounting.balance"), sortable: true, render: (r) => (
      <span className="font-figures font-medium">৳{Number(r.balance).toFixed(2)}</span>
    )},
  ];

  return (
    <div className="space-y-4">
      <Tabs
        tabs={[
          { value: "accounts", label: t("accounting.chartOfAccounts") },
          { value: "journal", label: t("accounting.journalEntries") },
        ]}
        active={tab}
        onChange={setTab}
      />

      {loading ? (
        <div className="bg-white rounded-xl border border-surface-200 p-10 text-center text-ink-400">{t("common.loading")}</div>
      ) : tab === "accounts" ? (
        <DataTable columns={accountColumns} data={accounts} rowKey={(r) => r.id} emptyLabel={t("accounting.noAccounts")} />
      ) : (
        <div className="space-y-3">
          {entries.length === 0 && (
            <div className="bg-white rounded-xl border border-surface-200 p-10 text-center text-ink-400">
              {t("accounting.noEntries")}
            </div>
          )}
          {entries.map((entry) => (
            <div key={entry.id} className="bg-white rounded-xl border border-surface-200 p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-ink-900">{entry.description || entry.reference_type}</span>
                <span className="text-xs text-ink-400">{entry.entry_date} — {entry.branch_code}</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {entry.lines.map((line) => (
                    <tr key={line.id} className="border-t border-surface-100">
                      <td className="py-1.5 text-ink-700">{line.account_code} — {line.account_name}</td>
                      <td className="py-1.5 text-right font-figures">{Number(line.debit) > 0 ? `Dr ${Number(line.debit).toFixed(2)}` : ""}</td>
                      <td className="py-1.5 text-right font-figures">{Number(line.credit) > 0 ? `Cr ${Number(line.credit).toFixed(2)}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
