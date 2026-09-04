import { useLanguage } from "./LanguageProvider";

const METHODS = [
  { code: "cod", labelKey: "payment_cod", live: true },
  { code: "bkash", labelKey: "payment_bkash", live: false },
  { code: "nagad", labelKey: "payment_nagad", live: false },
  { code: "card", labelKey: "payment_card", live: false },
];

export default function PaymentMethodTile({ selected, onSelect }) {
  const { t } = useLanguage();
  return (
    <div className="grid grid-cols-2 gap-3">
      {METHODS.map((m) => (
        <button
          key={m.code}
          type="button"
          onClick={() => onSelect(m.code)}
          className={`relative border rounded-md px-4 py-3 text-left ${
            selected === m.code
              ? "border-brand-500 bg-brand-50 dark:bg-gray-800"
              : "border-gray-300 dark:border-gray-700"
          }`}
        >
          <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{t(m.labelKey)}</p>
          {!m.live && <p className="text-xs text-gray-500 dark:text-gray-400">{t("payment_coming_soon")}</p>}
        </button>
      ))}
    </div>
  );
}
