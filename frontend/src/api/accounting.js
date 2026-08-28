import client from "./client";

export async function listAccounts() {
  const { data } = await client.get("/accounting/accounts/", { params: { page_size: 100 } });
  return data.results;
}

export async function listJournalEntries() {
  const { data } = await client.get("/accounting/journal-entries/", { params: { page_size: 50 } });
  return data.results;
}
