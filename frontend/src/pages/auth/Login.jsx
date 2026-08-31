// frontend/src/pages/auth/Login.jsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { login } from "../../api/auth";
import { useAuth } from "../../context/AuthContext";
import { setLanguage } from "../../i18n";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { reloadUser } = useAuth();
  const { t, i18n } = useTranslation();

  function toggleLanguage() {
    setLanguage(i18n.language === "bn" ? "en" : "bn");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
      await reloadUser();
      navigate("/");
    } catch (err) {
      setError(t("login.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row relative">
      <button
        onClick={toggleLanguage}
        className="absolute top-4 right-4 z-20 flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg
                   bg-white/10 hover:bg-white/20 text-white md:text-ink-700 md:bg-surface-100 md:hover:bg-surface-200"
      >
        <Languages size={16} />
        {i18n.language === "bn" ? "বাং" : "EN"}
      </button>

      {/* Brand panel — a barcode motif grounds this in the subject: retail, scanning, checkout */}
      <div className="relative md:w-1/2 bg-brand-700 text-white flex flex-col justify-between overflow-hidden px-10 py-12 md:px-16 md:py-16">
        <BarcodePattern />
        <div className="relative z-10">
          <span className="font-mono text-sm tracking-widest text-brand-100/80 uppercase">
            {t("login.tagline")}
          </span>
          <h1 className="mt-4 text-4xl md:text-5xl font-display font-semibold leading-tight">
            {t("login.heading1")}
            <br />
            {t("login.heading2")}
          </h1>
        </div>
        <p className="relative z-10 max-w-sm text-brand-100/70 text-sm">
          {t("login.subtext")}
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-16 bg-surface-50">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <h2 className="text-2xl font-display font-semibold text-ink-900 mb-1">
            {t("login.signIn")}
          </h2>
          <p className="text-ink-400 text-sm mb-8">
            {t("login.signInSubtext")}
          </p>

          <label className="block text-sm font-medium text-ink-700 mb-1">
            {t("login.username")}
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            className="w-full mb-4 px-3 py-2.5 rounded-lg border border-surface-200 bg-white
                       text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />

          <label className="block text-sm font-medium text-ink-700 mb-1">
            {t("login.password")}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full mb-2 px-3 py-2.5 rounded-lg border border-surface-200 bg-white
                       text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />

          {error && (
            <p className="text-danger-600 text-sm mt-2 mb-2" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-6 py-2.5 rounded-lg bg-accent-500 hover:bg-accent-600
                       text-ink-900 font-semibold transition-colors disabled:opacity-60
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500"
          >
            {submitting ? t("login.signingIn") : t("login.signIn")}
          </button>
        </form>
      </div>
    </div>
  );
}

/* A decorative barcode pattern — varying-width vertical bars, not a
   functional/scannable barcode, purely a visual motif tying the login
   screen back to the product's subject matter. */
function BarcodePattern() {
  const bars = [2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 1, 3, 2, 1, 4, 1, 2, 2, 1, 3];
  return (
    <div
      className="absolute inset-y-0 right-0 w-40 md:w-56 flex items-stretch opacity-20"
      aria-hidden="true"
    >
      {bars.map((w, i) => (
        <div
          key={i}
          className="bg-white"
          style={{ width: `${w * 3}px`, marginRight: "4px" }}
        />
      ))}
    </div>
  );
}
