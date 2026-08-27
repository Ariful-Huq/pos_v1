import client from "./client";

export async function login(username, password) {
  const { data } = await client.post("/auth/token/", { username, password });
  localStorage.setItem("access_token", data.access);
  localStorage.setItem("refresh_token", data.refresh);
  return data;
}

export async function fetchMe() {
  const { data } = await client.get("/authz/me/");
  return data;
}

export function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}
