import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

const TITLE_KEYS = {
  "/": "dashboard",
  "/sales": "sales",
  "/purchases": "purchases",
  "/inventory": "inventory",
  "/products": "products",
  "/expenses": "expenses",
  "/accounting": "accounting",
  "/staff": "staff",
  "/reports": "reports",
  "/settings": "settings",
};

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { t } = useTranslation();

  const titleKey = TITLE_KEYS[location.pathname];
  const title = titleKey ? t(`nav.${titleKey}`) : "POS";

  return (
    <div className="flex h-screen bg-surface-50">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onOpenMobileMenu={() => setMobileOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
