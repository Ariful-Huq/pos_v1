import { useState, useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { useTranslation } from "react-i18next";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";

// A print-only stylesheet, injected once, that hides everything except
// the label sheet when the browser print dialog is triggered — this is
// what makes "Print" actually produce just labels, not the whole app.
const PRINT_STYLE_ID = "label-print-style";
function ensurePrintStyle() {
  if (document.getElementById(PRINT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = `
    @media print {
      body * { visibility: hidden; }
      #label-print-sheet, #label-print-sheet * { visibility: visible; }
      #label-print-sheet {
        position: fixed; inset: 0; margin: 0; padding: 8mm;
      }
    }
  `;
  document.head.appendChild(style);
}

function Label({ product, showPrice, showName }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, product.sku, {
        format: "CODE128",
        displayValue: true,
        fontSize: 12,
        height: 36,
        width: 1.4,
        margin: 4,
      });
    } catch {
      // SKU has characters CODE128 can't encode (rare) — leave blank
      // rather than crash the whole label sheet.
    }
  }, [product.sku]);

  return (
    <div className="border border-dashed border-surface-300 rounded p-2 flex flex-col items-center justify-center text-center"
         style={{ width: "50mm", height: "30mm" }}>
      {showName && <p className="text-[9px] font-medium leading-tight mb-0.5 line-clamp-1">{product.name}</p>}
      <svg ref={svgRef} />
      {showPrice && <p className="text-[10px] font-semibold mt-0.5">৳{Number(product.selling_price).toFixed(2)}</p>}
    </div>
  );
}

export default function PrintLabelsModal({ open, onClose, product }) {
  const { t } = useTranslation();
  const [copies, setCopies] = useState(1);
  const [showPrice, setShowPrice] = useState(true);
  const [showName, setShowName] = useState(true);

  useEffect(() => { if (open) ensurePrintStyle(); }, [open]);
  useEffect(() => { if (open) setCopies(1); }, [open]);

  if (!product) return null;

  function handlePrint() {
    window.print();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("products.printLabels")}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" onClick={handlePrint}>{t("products.print")}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm">
            {t("products.copies")}
            <input
              type="number"
              min="1"
              max="100"
              value={copies}
              onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
              className="input w-20 font-figures"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} />
            {t("products.showName")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />
            {t("products.showPrice")}
          </label>
        </div>

        <p className="text-xs text-ink-400">{t("products.printLabelsHint")}</p>

        <div id="label-print-sheet" className="flex flex-wrap gap-2 max-h-96 overflow-y-auto border border-surface-200 rounded-lg p-3 bg-surface-50">
          {Array.from({ length: copies }).map((_, i) => (
            <Label key={i} product={product} showPrice={showPrice} showName={showName} />
          ))}
        </div>
      </div>
    </Modal>
  );
}
