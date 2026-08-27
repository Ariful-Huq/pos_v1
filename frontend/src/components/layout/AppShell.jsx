import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

const TITLES = {
  "/": "Dashboard",
  "/sales": "Sales",
  "/purchases": "Purchases",
  "/inventory": "Inventory",
  "/products": "Products",
  "/expenses": "Expenses",
  "/accounting": "Accounting",
  "/staff": "Staff",
  "/reports": "Reports",
  "/settings": "Settings",
};

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const title = TITLES[location.pathname] || "POS";

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
