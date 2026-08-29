import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Truck,
  Wallet,
  Receipt,
  Users,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/", key: "dashboard", icon: LayoutDashboard, end: true },
  { to: "/sales", key: "sales", icon: ShoppingCart },
  { to: "/purchases", key: "purchases", icon: Truck },
  { to: "/inventory", key: "inventory", icon: Boxes },
  { to: "/products", key: "products", icon: Package },
  { to: "/expenses", key: "expenses", icon: Wallet },
  { to: "/accounting", key: "accounting", icon: Receipt },
  { to: "/staff", key: "staff", icon: Users },
  { to: "/reports", key: "reports", icon: BarChart3 },
  { to: "/settings", key: "settings", icon: Settings },
];

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  const { t } = useTranslation();
  return (
    <>
      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-900/40 md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 md:z-auto
                    bg-brand-900 text-white flex flex-col
                    transition-transform duration-200 md:transition-[width]
                    ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
                    ${collapsed ? "md:w-[72px]" : "w-64 md:w-64"}`}
      >
        <div className="flex items-center justify-between px-4 h-16 border-b border-white/10">
          {!collapsed && (
            <span className="font-display font-semibold text-lg tracking-tight">POS</span>
          )}
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg hover:bg-white/10"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex p-1.5 rounded-lg hover:bg-white/10"
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map(({ to, key, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                 ${isActive ? "bg-white/15 text-white" : "text-brand-100/80 hover:bg-white/10 hover:text-white"}`
              }
              title={collapsed ? t(`nav.${key}`) : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{t(`nav.${key}`)}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
