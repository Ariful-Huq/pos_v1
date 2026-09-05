const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/storefront";
export const CART_UPDATED_EVENT = "storefront:cart-updated";
export const AUTH_CHANGED_EVENT = "storefront:auth-changed";

const TOKEN_KEY = "storefront_token";

// Token can live in localStorage (persists across browser restarts — "Remember
// me" checked) or sessionStorage (cleared when the tab closes). Checking both
// on read means a stale copy in the other storage can never win by accident;
// setAuthToken() explicitly clears the one it isn't using.
function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY) || window.sessionStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token, remember) {
  if (typeof window === "undefined") return;
  if (remember) {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.sessionStorage.removeItem(TOKEN_KEY);
  } else {
    window.sessionStorage.setItem(TOKEN_KEY, token);
    window.localStorage.removeItem(TOKEN_KEY);
  }
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function clearAuthToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.sessionStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function hasAuthToken() {
  return Boolean(getToken());
}

/**
 * Mirrors the shape of frontend/src/api/client.js — a thin fetch wrapper,
 * not axios (kept dependency-light for the storefront). Attaches the
 * customer token when present. No X-Active-Branch header here — the
 * storefront is single-branch fulfillment by design (§1 of the ecommerce
 * SSOT), the backend resolves the branch server-side.
 */
async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };

  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    credentials: "include", // carries the session cookie for guest carts
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Fired after any request that changes cart contents, so components with
// no direct data relationship (e.g. the header's cart badge) can refetch
// without a global store — deliberately lightweight for this app's size.
function notifyCartUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CART_UPDATED_EVENT));
  }
}

export const api = {
  register: (data) => request("/auth/register/", { method: "POST", body: data, auth: false }),
  login: (data) => request("/auth/login/", { method: "POST", body: data, auth: false }),
  me: () => request("/auth/me/"),

  products: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/products/${qs ? `?${qs}` : ""}`, { auth: false });
  },
  product: (id) => request(`/products/${id}/`, { auth: false }),
  categories: () => request("/categories/", { auth: false }),

  cart: () => request("/cart/"),
  addToCart: async (data) => {
    const result = await request("/cart/", { method: "POST", body: data });
    notifyCartUpdated();
    return result;
  },
  updateCartItem: async (itemId, quantity) => {
    const result = await request(`/cart/items/${itemId}/`, { method: "PATCH", body: { quantity } });
    notifyCartUpdated();
    return result;
  },
  removeCartItem: async (itemId) => {
    const result = await request(`/cart/items/${itemId}/`, { method: "DELETE" });
    notifyCartUpdated();
    return result;
  },

  checkout: async (data) => {
    const result = await request("/checkout/", { method: "POST", body: data });
    notifyCartUpdated();
    return result;
  },

  orders: () => request("/orders/"),
  order: (id) => request(`/orders/${id}/`),
};
