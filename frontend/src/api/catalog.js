import client from "./client";

export async function listProducts(params = {}) {
  const { data } = await client.get("/catalog/products/", { params });
  return data; // { count, next, previous, results }
}

export async function createProduct(payload) {
  const { data } = await client.post("/catalog/products/", payload);
  return data;
}

export async function updateProduct(id, payload) {
  const { data } = await client.patch(`/catalog/products/${id}/`, payload);
  return data;
}

export async function deleteProduct(id) {
  await client.delete(`/catalog/products/${id}/`);
}

export async function listCategories() {
  const { data } = await client.get("/catalog/categories/", { params: { page_size: 200 } });
  return data.results;
}

export async function listUnits() {
  const { data } = await client.get("/catalog/units/", { params: { page_size: 200 } });
  return data.results;
}
