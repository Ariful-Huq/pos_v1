import { useState, useRef, useEffect } from "react";
import { MoreVertical } from "lucide-react";

export default function ActionMenu({ items, align = "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 rounded-lg text-ink-400 hover:bg-surface-100 hover:text-ink-900
                   focus:outline-none focus:ring-2 focus:ring-brand-500"
        aria-label="Open actions menu"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <MoreVertical size={18} />
      </button>

      {open && (
        <div
          className={`absolute z-20 mt-1 w-44 bg-white rounded-lg border border-surface-200
                      shadow-lg py-1 ${align === "right" ? "right-0" : "left-0"}`}
        >
          {items.map((item, i) =>
            item.divider ? (
              <div key={i} className="my-1 border-t border-surface-100" />
            ) : (
              <button
                key={i}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
                disabled={item.disabled}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2
                            hover:bg-surface-50 disabled:opacity-50 disabled:cursor-not-allowed
                            ${item.danger ? "text-danger-600" : "text-ink-700"}`}
              >
                {item.icon}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
