import client from "./client";

export async function listExpenses() {
  const { data } = await client.get("/expenses/expenses/", { params: { page_size: 100 } });
  return data.results;
}

export async function createExpense(payload) {
  const { data } = await client.post("/expenses/expenses/", payload);
  return data;
}

export async function listExpenseCategories() {
  const { data } = await client.get("/expenses/categories/", { params: { page_size: 200 } });
  return data.results;
}

export async function createExpenseCategory(payload) {
  const { data } = await client.post("/expenses/categories/", payload);
  return data;
}
