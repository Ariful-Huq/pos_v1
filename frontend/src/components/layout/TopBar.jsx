import { Menu, LogOut, User as UserIcon, Languages, Monitor } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import ActionMenu from "../ui/ActionMenu";
import { setLanguage } from "../../i18n";

export default function TopBar({ onOpenMobileMenu, title }) {
  const { user, logout, activeBranchId, switchBranch } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  function toggleLanguage() {
    setLanguage(i18n.language === "bn" ? "en" : "bn");
  }

  return (
    <header className="h-16 bg-white border-b border-surface-200 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-lg text-ink-700 hover:bg-surface-100"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <h1 className="font-display font-semibold text-lg text-ink-900">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/pos")}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-surface-200 hover:bg-surface-100"
          title={t("pos.openRegister")}
        >
          <Monitor size={16} />
        </button>

        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-surface-200 hover:bg-surface-100"
          title={t("common.language")}
        >

          {i18n.language === "bn" ? "বাং" : "EN"}
        </button>

        {user?.branch_access?.length > 1 && (
          <select
            value={activeBranchId || ""}
            onChange={(e) => switchBranch(e.target.value)}
            className="text-sm border border-surface-200 rounded-lg px-3 py-2 bg-white font-mono
                       focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {user.branch_access.map((b) => (
              <option key={b.branch_id || "global"} value={b.branch_id || ""}>
                {b.branch_name}
              </option>
            ))}
          </select>
        )}

        <ActionMenu
          items={[
            { label: user?.username, icon: <UserIcon size={14} />, disabled: true },
            { divider: true },
            { label: t("common.signOut"), icon: <LogOut size={14} />, danger: true, onClick: logout },
          ]}
        />
      </div>
    </header>
  );
}
