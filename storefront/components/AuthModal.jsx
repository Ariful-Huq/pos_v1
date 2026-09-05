"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, X, Mail, Lock, Eye, EyeOff, UserPlus, LogIn, User, Phone, MapPin } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useLanguage } from "./LanguageProvider";

const EMPTY_FIELDS = {
  full_name: "", email: "", phone: "", address: "", password: "", confirm_password: "",
};

export default function AuthModal() {
  const { modalOpen, modalMode, closeAuthModal, login, register } = useAuth();
  const { t } = useLanguage();
  const [mode, setMode] = useState(modalMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState(EMPTY_FIELDS);

  // modalMode is only the *initial* mode when the modal opens — once open,
  // the Sign in/Register tabs inside control `mode` locally so switching
  // doesn't require closing and reopening. Re-sync whenever the modal
  // transitions to open, in case it was last opened in the other mode.
  useEffect(() => {
    if (modalOpen) {
      setMode(modalMode);
      setError(null);
      setFields(EMPTY_FIELDS);
    }
  }, [modalOpen, modalMode]);

  if (!modalOpen) return null;

  function updateField(key, value) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (mode === "register" && fields.password !== fields.confirm_password) {
      setError(t("auth_password_mismatch"));
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        await login({ email: fields.email, password: fields.password, remember });
      } else {
        const { confirm_password, ...payload } = fields;
        await register({ ...payload, remember });
      }
    } catch (err) {
      setError(err.message || t("generic_error"));
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-md text-sm";
  const labelClass =
    "block text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400 uppercase mb-1";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={closeAuthModal}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-brand-700 text-white px-8 pt-8 pb-6 text-center">
          <button
            onClick={closeAuthModal}
            aria-label={t("close")}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="mx-auto w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center mb-3">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="font-heading text-xl font-bold">
            {mode === "login" ? t("auth_welcome_back") : t("auth_join_us")}
          </h2>
          <p className="text-sm text-white/80 mt-1">
            {mode === "login" ? t("auth_login_subtitle") : t("auth_register_subtitle")}
          </p>
        </div>

        <div className="p-6">
          <div className="flex border border-gray-200 dark:border-gray-800 rounded-lg p-1 mb-5">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition ${
                mode === "login"
                  ? "bg-brand-700 text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              <LogIn className="h-4 w-4" /> {t("auth_tab_signin")}
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition ${
                mode === "register"
                  ? "bg-brand-700 text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              <UserPlus className="h-4 w-4" /> {t("auth_tab_register")}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "register" && (
              <div>
                <label className={labelClass}>{t("field_full_name")}</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    required
                    value={fields.full_name}
                    onChange={(e) => updateField("full_name", e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            <div>
              <label className={labelClass}>{t("auth_email_label")}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  required
                  type="email"
                  placeholder="you@example.com"
                  value={fields.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {mode === "register" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>{t("field_phone")}</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        value={fields.phone}
                        onChange={(e) => updateField("phone", e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>{t("auth_address_label")}</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        value={fields.address}
                        onChange={(e) => updateField("address", e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>{t("auth_password_label")}</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        required
                        minLength={8}
                        type={showPassword ? "text" : "password"}
                        value={fields.password}
                        onChange={(e) => updateField("password", e.target.value)}
                        className={`${inputClass} pr-9`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? t("hide_password") : t("show_password")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>{t("auth_confirm_password_label")}</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        required
                        minLength={8}
                        type={showConfirmPassword ? "text" : "password"}
                        value={fields.confirm_password}
                        onChange={(e) => updateField("confirm_password", e.target.value)}
                        className={`${inputClass} pr-9`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((s) => !s)}
                        aria-label={showConfirmPassword ? t("hide_password") : t("show_password")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {mode === "login" && (
              <div>
                <label className={labelClass}>{t("auth_password_label")}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    value={fields.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    className={`${inputClass} pr-9`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? t("hide_password") : t("show_password")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === "login" && (
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-700"
                />
                {t("auth_remember_me")}
              </label>
            )}

            {error && <p className="text-danger-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-accent-500 text-white py-2.5 rounded-md font-medium hover:bg-accent-400 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mode === "login" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {submitting
                ? t("auth_submitting")
                : mode === "login"
                ? t("auth_tab_signin")
                : t("auth_create_account_cta")}
            </button>
          </form>
        </div>

        <div className="flex items-center justify-center gap-2 py-3 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-400">
          <ShieldCheck className="h-4 w-4 text-green-500" />
          {t("footer_secure_payment")}
        </div>
      </div>
    </div>
  );
}
