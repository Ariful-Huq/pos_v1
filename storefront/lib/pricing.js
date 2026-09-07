// Mirrors apps/ecommerce/services.py's calculate_shipping()/calculate_tax()
// exactly, so what the cart/checkout pages *show* always matches what
// checkout() actually *charges* server-side. The backend is still the
// authority — this is a preview, computed from the same real settings via
// /shipping-config/, not duplicated hardcoded numbers.

export function calculateOrderTotals(items, shippingConfig) {
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.unit_price_snapshot) * item.quantity,
    0
  );

  const tax = items.reduce((sum, item) => {
    const lineTotal = Number(item.unit_price_snapshot) * item.quantity;
    const rate = Number(item.tax_rate || 0);
    return sum + (lineTotal * rate) / 100;
  }, 0);

  const threshold = Number(shippingConfig?.free_shipping_threshold ?? Infinity);
  const flatCost = Number(shippingConfig?.flat_shipping_cost ?? 0);
  const shipping = subtotal >= threshold ? 0 : flatCost;

  const total = subtotal + tax + shipping;

  return {
    subtotal: round2(subtotal),
    tax: round2(tax),
    shipping: round2(shipping),
    total: round2(total),
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
