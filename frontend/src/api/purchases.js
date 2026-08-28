import client from "./client";

export async function listPurchaseOrders() {
  const { data } = await client.get("/purchases/purchase-orders/");
  return data.results;
}

export async function createPurchaseOrder(payload) {
  const { data } = await client.post("/purchases/purchase-orders/", payload);
  return data;
}

export async function receiveItem(poId, itemId, quantity) {
  const { data } = await client.post(
    `/purchases/purchase-orders/${poId}/items/${itemId}/receive/`,
    { quantity }
  );
  return data;
}

export async function listSuppliers() {
  const { data } = await client.get("/purchases/suppliers/", { params: { page_size: 200 } });
  return data.results;
}

export async function createSupplier(payload) {
  const { data } = await client.post("/purchases/suppliers/", payload);
  return data;
}
