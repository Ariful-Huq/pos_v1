import client from "./client";

export async function getOrganization() {
  const { data } = await client.get("/tenants/organization/");
  return data;
}

export async function updateOrganization(payload) {
  const { data } = await client.patch("/tenants/organization/", payload);
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
