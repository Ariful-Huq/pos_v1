const TONES = {
  neutral: "bg-surface-100 text-ink-700",
  brand: "bg-brand-100 text-brand-900",
  success: "bg-brand-100 text-brand-900",
  warning: "bg-accent-100 text-accent-600",
  danger: "bg-danger-100 text-danger-600",
};

export default function Badge({ tone = "neutral", children }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
