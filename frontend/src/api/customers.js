// frontend/src/api/customers.js

import client from "./client";

export async function listCustomers({ search } = {}) {
  const { data } = await client.get("/sales/customers/", {
    params: { page_size: 200, search: search || undefined },
  });
  return data.results;
}

export async function getCustomer(id) {
  const { data } = await client.get(`/sales/customers/${id}/`);
  return data;
}

export async function createCustomer(payload) {
  const { data } = await client.post("/sales/customers/", payload);
  return data;
}

export async function updateCustomer(id, payload) {
  const { data } = await client.patch(`/sales/customers/${id}/`, payload);
  return data;
}

export async function deleteCustomer(id) {
  await client.delete(`/sales/customers/${id}/`);
}

export async function getCustomerSales(id) {
  const { data } = await client.get(`/sales/customers/${id}/sales/`);
  return data;
}
