import { Delete } from "lucide-react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "backspace"];

export default function NumericKeypad({ onKeyPress }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onKeyPress(key)}
          className="h-14 rounded-lg bg-surface-50 hover:bg-surface-100 border border-surface-200
                     text-lg font-figures font-medium text-ink-900 flex items-center justify-center
                     active:bg-surface-200 transition-colors"
        >
          {key === "backspace" ? <Delete size={20} /> : key}
        </button>
      ))}
    </div>
  );
}
