const VARIANTS = {
  primary: "bg-accent-500 hover:bg-accent-600 text-ink-900 focus:ring-accent-500",
  brand: "bg-brand-700 hover:bg-brand-900 text-white focus:ring-brand-500",
  outline: "bg-white hover:bg-surface-100 text-ink-900 border border-surface-200 focus:ring-brand-500",
  danger: "bg-danger-500 hover:bg-danger-600 text-white focus:ring-danger-500",
  ghost: "bg-transparent hover:bg-surface-100 text-ink-700 focus:ring-brand-500",
};

const SIZES = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-base",
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  children,
  ...props
}) {
  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium
                  transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
                  disabled:opacity-60 disabled:cursor-not-allowed
                  ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
