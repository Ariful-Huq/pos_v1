import client from "./client";

export async function createDraftSale(customerId = null) {
  const { data } = await client.post("/sales/sales/", customerId ? { customer: customerId } : {});
  return data;
}

export async function listRecentSales(limit = 5) {
  const { data } = await client.get("/sales/sales/", { params: { status: "completed", page_size: limit } });
  return data.results;
}

export async function listAllSales(limit = 100) {
  const { data } = await client.get("/sales/sales/", { params: { page_size: limit } });
  return data.results;
}

export async function listHeldSales() {
  const { data } = await client.get("/sales/sales/", { params: { status: "draft" } });
  return data.results;
}

export async function addItem(saleId, { product, quantity = 1, unit_price }) {
  const { data } = await client.post(`/sales/sales/${saleId}/items/`, {
    product, quantity, unit_price,
  });
  return data;
}

export async function removeItem(saleId, itemId) {
  const { data } = await client.post(`/sales/sales/${saleId}/items/${itemId}/remove/`);
  return data;
}

export async function updateItemQuantity(saleId, itemId, quantity) {
  const { data } = await client.post(`/sales/sales/${saleId}/items/${itemId}/quantity/`, { quantity });
  return data;
}

export async function completeSale(saleId, payments) {
  const { data } = await client.post(`/sales/sales/${saleId}/complete/`, { payments });
  return data;
}

export async function voidSale(saleId, reason) {
  const { data } = await client.post(`/sales/sales/${saleId}/void/`, { reason });
  return data;
}

export async function lookupProduct(code) {
  const { data } = await client.get("/catalog/products/lookup/", { params: { code } });
  return data;
}
