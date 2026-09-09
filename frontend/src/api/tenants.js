import client from "./client";

// Same pattern as api/catalog.js's toRequestBody() for Product.image —
// builds multipart/form-data only when a logo File is actually present,
// otherwise sends plain JSON exactly as before (no behavior change for
// text-only saves).
function toRequestBody(payload) {
  if (!payload.logo || !(payload.logo instanceof File)) {
    const { logo, ...rest } = payload; // eslint-disable-line no-unused-vars
    return rest;
  }
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    formData.append(key, value);
  });
  return formData;
}

export async function getOrganization() {
  const { data } = await client.get("/tenants/organization/");
  return data;
}

export async function updateOrganization(payload) {
  const body = toRequestBody(payload);
  const { data } = await client.patch("/tenants/organization/", body);
  return data;
}

export async function listBranches() {
  const { data } = await client.get("/tenants/branches/", { params: { page_size: 100 } });
  return data.results;
}

export async function createBranch(payload) {
  const { data } = await client.post("/tenants/branches/", payload);
  return data;
}

export async function updateBranch(id, payload) {
  const { data } = await client.patch(`/tenants/branches/${id}/`, payload);
  return data;
}

export async function deleteBranch(id) {
  await client.delete(`/tenants/branches/${id}/`);
}
