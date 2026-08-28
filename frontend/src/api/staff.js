import client from "./client";

export async function listStaff() {
  const { data } = await client.get("/staff/staff/", { params: { page_size: 100 } });
  return data.results;
}

export async function createStaff(payload) {
  const { data } = await client.post("/staff/staff/", payload);
  return data;
}

export async function updateStaff(id, payload) {
  const { data } = await client.patch(`/staff/staff/${id}/`, payload);
  return data;
}
