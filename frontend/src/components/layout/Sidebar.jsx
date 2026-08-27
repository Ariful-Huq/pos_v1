import { NavLink } from "react-router-dom";
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
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/sales", label: "Sales", icon: ShoppingCart },
  { to: "/purchases", label: "Purchases", icon: Truck },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/products", label: "Products", icon: Package },
  { to: "/expenses", label: "Expenses", icon: Wallet },
  { to: "/accounting", label: "Accounting", icon: Receipt },
  { to: "/staff", label: "Staff", icon: Users },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
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
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                 ${isActive ? "bg-white/15 text-white" : "text-brand-100/80 hover:bg-white/10 hover:text-white"}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
