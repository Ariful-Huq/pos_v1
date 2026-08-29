export default function StatCard({ label, value, sub, tone = "neutral" }) {
  const toneClasses = {
    neutral: "text-ink-900",
    success: "text-brand-700",
    danger: "text-danger-600",
    warning: "text-accent-600",
  };

  return (
    <div className="bg-white rounded-xl border border-surface-200 p-4">
      <p className="text-xs uppercase tracking-wide text-ink-400 mb-1">{label}</p>
      <p className={`font-figures text-2xl font-semibold ${toneClasses[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-ink-400 mt-1">{sub}</p>}
    </div>
  );
}
