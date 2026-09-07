import client from "./client";

export async function listProducts(params = {}) {
  const { data } = await client.get("/catalog/products/", { params });
  return data; // { count, next, previous, results }
}

// Builds a multipart/form-data body when an image File is present, since
// a plain JSON body can't carry a file. Falls back to plain JSON when
// there's no image, keeping the request identical to before in that case.
function toRequestBody(payload) {
  if (!payload.image || !(payload.image instanceof File)) {
    const { image, ...rest } = payload; // eslint-disable-line no-unused-vars
    return rest;
  }
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    formData.append(key, value);
  });
  return formData;
}

export async function createProduct(payload) {
  const body = toRequestBody(payload);
  const { data } = await client.post("/catalog/products/", body);
  return data;
}

export async function updateProduct(id, payload) {
  const body = toRequestBody(payload);
  const { data } = await client.patch(`/catalog/products/${id}/`, body);
  return data;
}

export async function deleteProduct(id) {
  await client.delete(`/catalog/products/${id}/`);
}

export async function listCategories() {
  const { data } = await client.get("/catalog/categories/", { params: { page_size: 200 } });
  return data.results;
}

export async function createCategory(payload) {
  const { data } = await client.post("/catalog/categories/", payload);
  return data;
}

export async function listUnits() {
  const { data } = await client.get("/catalog/units/", { params: { page_size: 200 } });
  return data.results;
}

export async function createUnit(payload) {
  const { data } = await client.post("/catalog/units/", payload);
  return data;
}
