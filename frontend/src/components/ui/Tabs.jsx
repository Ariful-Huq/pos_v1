export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="border-b border-surface-200 flex gap-6">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`relative pb-3 text-sm font-medium transition-colors
                      ${active === tab.value ? "text-brand-700" : "text-ink-400 hover:text-ink-700"}`}
        >
          {tab.label}
          {active === tab.value && (
            <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand-700 rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}
