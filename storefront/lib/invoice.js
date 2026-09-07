// Client-side PDF generation via jsPDF — a real one-click download, not a
// "use your browser's print dialog" workaround. Draws directly from the
// Order object returned by GET /orders/{id}/ (already has everything:
// items, shipping_address, subtotal/shipping_cost/tax_amount/total) — no
// separate invoice endpoint needed, the data was already real.
//
// CURRENCY NOTE: jsPDF's built-in fonts (Helvetica etc.) only support
// WinAnsi encoding — no Bengali glyphs. Passing "৳" silently renders a
// wrong substitute character AND throws off jsPDF's text-width math for
// right-alignment (that's what caused the earlier column-overflow bug,
// not just the wrong symbol). Using "Tk" avoids both problems at once.
// The rest of the storefront (HTML) is unaffected — browsers render "৳"
// correctly; this only applies inside generated PDFs. Swap CURRENCY_PREFIX
// for a proper embedded Bengali-supporting font later if you want the real
// glyph in the PDF too.
const CURRENCY_PREFIX = "Tk ";
const money = (n) => `${CURRENCY_PREFIX}${Number(n).toFixed(2)}`;

export async function downloadInvoice(order) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 48;
  const contentRight = pageWidth - marginX;
  let y = 56;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("PonnoSomver", marginX, y);
  doc.setFontSize(20);
  doc.text("INVOICE", contentRight, y, { align: "right" });

  y += 28;
  doc.setDrawColor(200);
  doc.line(marginX, y, contentRight, y);
  y += 24;

  // Order meta
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`Order #: ${order.order_number || "Pending confirmation"}`, marginX, y);
  doc.text(`Date: ${new Date(order.created_at).toLocaleDateString()}`, contentRight, y, { align: "right" });
  y += 16;
  doc.text(`Status: ${order.status.replace("_", " ")}`, marginX, y);
  y += 28;

  // Ship to
  const addr = order.shipping_address;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20);
  doc.text("Ship To", marginX, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  if (addr) {
    const lines = [
      addr.full_name,
      addr.line1,
      addr.line2,
      [addr.city, addr.area].filter(Boolean).join(", "),
      addr.phone,
    ].filter(Boolean);
    lines.forEach((line) => {
      doc.text(line, marginX, y);
      y += 14;
    });
  }
  if (order.guest_email) {
    doc.text(order.guest_email, marginX, y);
    y += 14;
  }
  y += 14;

  // Line items table (drawn manually — no autotable plugin dependency).
  // Column x positions: SL / Item / Qty / Price / Tax / Total, all
  // confined within [marginX, contentRight] — the header band below uses
  // the exact same bounds so nothing overshoots the page margin.
  const col = {
    sl: marginX,
    item: marginX + 28,
    qty: contentRight - 220,
    price: contentRight - 150,
    tax: contentRight - 80,
    total: contentRight,
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255);
  doc.setFillColor(15, 118, 110); // brand-700
  doc.rect(marginX, y - 12, contentRight - marginX, 20, "F");
  doc.text("SL", col.sl + 2, y + 2);
  doc.text("Item", col.item, y + 2);
  doc.text("Qty", col.qty, y + 2, { align: "right" });
  doc.text("Price", col.price, y + 2, { align: "right" });
  doc.text("Tax", col.tax, y + 2, { align: "right" });
  doc.text("Total", col.total, y + 2, { align: "right" });
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  order.items.forEach((item, index) => {
    const lineTotal = Number(item.unit_price_snapshot) * item.quantity;
    doc.text(String(index + 1), col.sl + 2, y);
    doc.text(item.product_name_snapshot, col.item, y, { maxWidth: col.qty - col.item - 12 });
    doc.text(String(item.quantity), col.qty, y, { align: "right" });
    doc.text(money(item.unit_price_snapshot), col.price, y, { align: "right" });
    doc.text(`${Number(item.tax_rate_snapshot || 0).toFixed(1)}%`, col.tax, y, { align: "right" });
    doc.text(money(lineTotal), col.total, y, { align: "right" });
    y += 20;
  });

  y += 8;
  doc.setDrawColor(220);
  doc.line(marginX, y, contentRight, y);
  y += 20;

  // Totals
  const labelX = contentRight - 160;
  const row = (label, value, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11 : 10);
    doc.text(label, labelX, y);
    doc.text(value, contentRight, y, { align: "right" });
    y += bold ? 20 : 16;
  };
  row("Subtotal", money(order.subtotal));
  row("Shipping", money(order.shipping_cost || 0));
  row("Tax", money(order.tax_amount || 0));
  y += 4;
  doc.line(labelX - 12, y - 12, contentRight, y - 12);
  row("Total", money(order.total), true);

  y += 30;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text("Thank you for your order.", marginX, y);

  doc.save(`invoice-${order.order_number || order.id}.pdf`);
}
