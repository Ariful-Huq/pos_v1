import client from "./client";

export async function getSummary(days = 7) {
  const { data } = await client.get("/reports/summary/", { params: { days } });
  return data;
}

export async function getTopProducts(days = 30, limit = 5) {
  const { data } = await client.get("/reports/top-products/", { params: { days, limit } });
  return data;
}
