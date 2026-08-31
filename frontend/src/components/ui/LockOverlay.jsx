import { useState } from "react";
import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { login } from "../../api/auth";
import Button from "./Button";

export default function LockOverlay({ username, onUnlock }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleUnlock(e) {
    e.preventDefault();
    setChecking(true);
    setError("");
    try {
      await login(username, password);
      setPassword("");
      onUnlock();
    } catch {
      setError(t("common.incorrectPassword"));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-ink-900/90 backdrop-blur-sm flex items-center justify-center">
      <form onSubmit={handleUnlock} className="bg-white rounded-2xl p-8 w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-full bg-surface-50 flex items-center justify-center mx-auto mb-4">
          <Lock size={22} className="text-ink-700" />
        </div>
        <h2 className="font-display font-semibold text-lg text-ink-900 mb-1">{t("common.sessionLocked")}</h2>
        <p className="text-sm text-ink-400 mb-5">{username}</p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("login.password")}
          autoFocus
          required
          className="input text-center mb-3"
        />
        {error && <p className="text-danger-600 text-sm mb-3">{error}</p>}

        <Button type="submit" variant="primary" className="w-full" disabled={checking}>
          {checking ? t("common.loading") : t("common.unlock")}
        </Button>
      </form>
    </div>
  );
}
