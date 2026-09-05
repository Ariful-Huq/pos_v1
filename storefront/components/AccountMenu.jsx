"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { User, LogOut, Package } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useLanguage } from "./LanguageProvider";

export default function AccountMenu() {
  const { isAuthenticated, isLoading, customer, openAuthModal, logout } = useAuth();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Avoids a flash of the "Sign in" button before we know whether a token
  // exists — same idea as ThemeToggle waiting for its effect before
  // rendering the "real" icon.
  if (isLoading) {
    return <div className="h-9 w-9" />;
  }

  if (!isAuthenticated) {
    return (
      <button
        onClick={() => openAuthModal("login")}
        className="h-9 px-3 flex items-center gap-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 text-sm font-medium"
      >
        <User className="h-4 w-4" />
        <span className="hidden sm:inline">{t("account_sign_in")}</span>
      </button>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="h-9 px-3 flex items-center gap-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-medium"
      >
        <User className="h-4 w-4" />
        <span className="hidden sm:inline max-w-32 truncate">{customer?.full_name}</span>
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg py-1 z-50">
          <div className="px-4 py-2 text-xs text-gray-400 truncate border-b border-gray-100 dark:border-gray-800">
            {customer?.email}
          </div>
          <Link
            href="/account/orders"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Package className="h-4 w-4" /> {t("account_my_orders")}
          </Link>
          <button
            onClick={() => {
              logout();
              setMenuOpen(false);
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger-600 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <LogOut className="h-4 w-4" /> {t("account_sign_out")}
          </button>
        </div>
      )}
    </div>
  );
}
