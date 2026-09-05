"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
import { setAuthToken, clearAuthToken, hasAuthToken, AUTH_CHANGED_EVENT } from "../lib/api";

const AuthContext = createContext({
  customer: null,
  isLoading: true,
  isAuthenticated: false,
  modalOpen: false,
  modalMode: "login",
  openAuthModal: () => {},
  closeAuthModal: () => {},
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("login"); // "login" | "register"

  function loadProfile() {
    if (!hasAuthToken()) {
      setCustomer(null);
      setIsLoading(false);
      return;
    }
    api.me()
      .then(setCustomer)
      .catch(() => setCustomer(null))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadProfile();
    // If another tab logs in/out, or logout() fires here, stay in sync —
    // same event-driven pattern CartBadge uses for CART_UPDATED_EVENT.
    window.addEventListener(AUTH_CHANGED_EVENT, loadProfile);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, loadProfile);
  }, []);

  function openAuthModal(mode = "login") {
    setModalMode(mode);
    setModalOpen(true);
  }

  function closeAuthModal() {
    setModalOpen(false);
  }

  async function login({ email, password, remember }) {
    const { token } = await api.login({ email, password });
    setAuthToken(token, remember);
    // AUTH_CHANGED_EVENT (fired by setAuthToken) triggers loadProfile via
    // the listener above — no need to call it again here.
    setModalOpen(false);
  }

  async function register({ full_name, email, phone, password, remember }) {
    const result = await api.register({ full_name, email, phone, password });
    setAuthToken(result.token, remember);
    setModalOpen(false);
  }

  function logout() {
    clearAuthToken();
    setCustomer(null);
  }

  return (
    <AuthContext.Provider
      value={{
        customer,
        isLoading,
        isAuthenticated: Boolean(customer),
        modalOpen,
        modalMode,
        openAuthModal,
        closeAuthModal,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
