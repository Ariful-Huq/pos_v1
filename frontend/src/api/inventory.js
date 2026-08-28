import client from "./client";

export async function listStockLevels() {
  const { data } = await client.get("/inventory/stock-levels/", { params: { page_size: 200 } });
  return data.results;
}

export async function adjustStock(product, quantity, notes = "") {
  const { data } = await client.post("/inventory/stock-levels/adjust/", { product, quantity, notes });
  return data;
}

export async function listMovements(productId) {
  const { data } = await client.get("/inventory/movements/", {
    params: { product: productId, page_size: 50 },
  });
  return data.results;
}
