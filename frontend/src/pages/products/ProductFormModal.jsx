import { useState, useEffect, useRef } from "react";
import { Plus, ScanLine, ImagePlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { createCategory, createUnit } from "../../api/catalog";
import { adjustStock } from "../../api/inventory";
import { listBranches } from "../../api/tenants";

const EMPTY = {
  sku: "",
  name: "",
  category: "",
  base_unit: "",
  cost_price: "",
  selling_price: "",
  tax_rate: "0",
};

export default function ProductFormModal({ open, onClose, onSubmit, categories, units, initial }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Inline category/unit creation — same pattern as the Expenses page,
  // so a missing category or unit is never a dead end.
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParent, setNewCategoryParent] = useState("");
  const [localCategories, setLocalCategories] = useState(categories);

  const [addingUnit, setAddingUnit] = useState(false);
  const [newUnitCode, setNewUnitCode] = useState("");
  const [newUnitName, setNewUnitName] = useState("");
  const [localUnits, setLocalUnits] = useState(units);

  // Barcode scan → fills the SKU field. A USB/handheld scanner behaves
  // like a keyboard typing digits then Enter — this input just needs to
  // be focused when the scan happens.
  const [scanValue, setScanValue] = useState("");
  const scanInputRef = useRef(null);

  // Product image
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // Opening stock — only meaningful when CREATING a product (not editing),
  // since it's a one-time "here's what we already have on the shelf" entry,
  // not something that makes sense to redo later (use Inventory adjust for
  // ongoing corrections instead).
  const [branches, setBranches] = useState([]);
  const [openingStock, setOpeningStock] = useState({}); // { branchId: "qty" }

  useEffect(() => { setLocalCategories(categories); }, [categories]);
  useEffect(() => { setLocalUnits(units); }, [units]);

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...EMPTY, ...initial } : EMPTY);
      setError("");
      setScanValue("");
      setImageFile(null);
      setImagePreview(initial?.image || null);
      setAddingCategory(false);
      setAddingUnit(false);
      setOpeningStock({});
      if (!initial) {
        listBranches().then(setBranches).catch(() => setBranches([]));
      }
    }
  }, [open, initial]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleScanKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (scanValue.trim()) {
        set("sku", scanValue.trim());
        setScanValue("");
      }
    }
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    const created = await createCategory({
      name: newCategoryName.trim(),
      parent: newCategoryParent || null,
    });
    setLocalCategories((cs) => [...cs, created]);
    set("category", created.id);
    setNewCategoryName("");
    setNewCategoryParent("");
    setAddingCategory(false);
  }

  async function handleAddUnit() {
    if (!newUnitCode.trim()) return;
    const created = await createUnit({
      code: newUnitCode.trim(),
      name: newUnitName.trim() || newUnitCode.trim(),
    });
    setLocalUnits((us) => [...us, created]);
    set("base_unit", created.id);
    setNewUnitCode("");
    setNewUnitName("");
    setAddingUnit(false);
  }

  function setOpeningQty(branchId, value) {
    setOpeningStock((s) => ({ ...s, [branchId]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form };
      if (imageFile) payload.image = imageFile;

      const product = await onSubmit(payload);

      // Opening stock: only fires for a NEW product, and only for
      // branches where a non-zero quantity was actually entered.
      if (!initial && product?.id) {
        const entries = Object.entries(openingStock).filter(([, qty]) => parseFloat(qty) > 0);
        for (const [branchId, qty] of entries) {
          await adjustStock(product.id, parseFloat(qty), t("products.openingStockNote"), branchId);
        }
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "Something went wrong — check the fields and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? t("products.editProduct") : t("products.addProduct")}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>{t("common.cancel")}</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? t("common.saving") : t("products.saveProduct")}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* Image + barcode scan + SKU */}
        <div className="flex gap-4">
          <label className="shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-surface-200 flex items-center justify-center cursor-pointer overflow-hidden hover:border-brand-500">
            {imagePreview ? (
              <img src={imagePreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImagePlus size={22} className="text-ink-400" />
            )}
            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </label>

          <div className="flex-1 space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("products.sku")}>
                <input value={form.sku} onChange={(e) => set("sku", e.target.value)} required className="input font-figures" />
              </Field>
              <Field label={t("products.scanBarcode")}>
                <div className="relative">
                  <ScanLine className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" size={14} />
                  <input
                    ref={scanInputRef}
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    onKeyDown={handleScanKeyDown}
                    placeholder={t("products.scanIntoSku")}
                    className="input !pl-8 font-figures"
                  />
                </div>
              </Field>
            </div>
            <Field label={t("products.name")}>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} required className="input" />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Category with inline create (supports a parent = sub-category) */}
          <label className="block">
            <span className="block text-sm font-medium text-ink-700 mb-1">{t("products.category")}</span>
            {addingCategory ? (
              <div className="space-y-1.5 border border-surface-200 rounded-lg p-2">
                <input
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={t("products.newCategoryPlaceholder")}
                  className="input text-sm"
                />
                <select value={newCategoryParent} onChange={(e) => setNewCategoryParent(e.target.value)} className="input text-sm">
                  <option value="">{t("products.noParentCategory")}</option>
                  {localCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="flex gap-1.5">
                  <Button type="button" size="sm" variant="outline" onClick={handleAddCategory}>{t("common.save")}</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setAddingCategory(false)}>{t("common.cancel")}</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-1">
                <select value={form.category} onChange={(e) => set("category", e.target.value)} className="input flex-1">
                  <option value="">{t("common.none")}</option>
                  {localCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.parent_name ? `${c.parent_name} / ${c.name}` : c.name}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setAddingCategory(true)} className="px-2 text-brand-700" title={t("products.addCategory")}>
                  <Plus size={18} />
                </button>
              </div>
            )}
          </label>

          {/* Base unit with inline create */}
          <label className="block">
            <span className="block text-sm font-medium text-ink-700 mb-1">{t("products.baseUnit")}</span>
            {addingUnit ? (
              <div className="space-y-1.5 border border-surface-200 rounded-lg p-2">
                <input
                  autoFocus
                  value={newUnitCode}
                  onChange={(e) => setNewUnitCode(e.target.value)}
                  placeholder={t("products.newUnitCodePlaceholder")}
                  className="input text-sm"
                />
                <input
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  placeholder={t("products.newUnitNamePlaceholder")}
                  className="input text-sm"
                />
                <div className="flex gap-1.5">
                  <Button type="button" size="sm" variant="outline" onClick={handleAddUnit}>{t("common.save")}</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setAddingUnit(false)}>{t("common.cancel")}</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-1">
                <select value={form.base_unit} onChange={(e) => set("base_unit", e.target.value)} required className="input flex-1">
                  <option value="">{t("common.selectEllipsis")}</option>
                  {localUnits.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}
                </select>
                <button type="button" onClick={() => setAddingUnit(true)} className="px-2 text-brand-700" title={t("products.addUnit")}>
                  <Plus size={18} />
                </button>
              </div>
            )}
          </label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label={t("products.costPrice")}>
            <input type="number" step="0.01" value={form.cost_price} onChange={(e) => set("cost_price", e.target.value)} className="input font-figures" />
          </Field>
          <Field label={t("products.sellingPrice")}>
            <input type="number" step="0.01" value={form.selling_price} onChange={(e) => set("selling_price", e.target.value)} required className="input font-figures" />
          </Field>
          <Field label={t("products.taxPercent")}>
            <input type="number" step="0.01" value={form.tax_rate} onChange={(e) => set("tax_rate", e.target.value)} className="input font-figures" />
          </Field>
        </div>

        {/* Opening stock + branch wiring — creation only */}
        {!initial && branches.length > 0 && (
          <div className="border border-surface-200 rounded-lg p-3">
            <p className="text-sm font-medium text-ink-700 mb-1">{t("products.openingStock")}</p>
            <p className="text-xs text-ink-400 mb-2">{t("products.openingStockHint")}</p>
            <div className="space-y-1.5">
              {branches.map((b) => (
                <div key={b.id} className="flex items-center gap-2">
                  <span className="text-sm text-ink-700 flex-1">{b.name} <span className="font-figures text-xs text-ink-400">({b.code})</span></span>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder="0"
                    value={openingStock[b.id] || ""}
                    onChange={(e) => setOpeningQty(b.id, e.target.value)}
                    className="input w-28 font-figures text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-danger-600 text-sm">{error}</p>}
      </form>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink-700 mb-1">{label}</span>
      {children}
    </label>
  );
}
