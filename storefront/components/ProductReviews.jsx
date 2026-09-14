"use client";

import { useEffect, useState } from "react";
import { Star, LogIn } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "./AuthProvider";
import { useLanguage } from "./LanguageProvider";

function StarRow({ value, size = 16, onSelect }) {
  const interactive = Boolean(onSelect);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          onClick={() => onSelect?.(n)}
          className={interactive ? "cursor-pointer" : "cursor-default"}
          aria-label={interactive ? `${n} stars` : undefined}
        >
          <Star
            size={size}
            className={n <= value ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600"}
          />
        </button>
      ))}
    </div>
  );
}

export default function ProductReviews({ slug }) {
  const { t } = useLanguage();
  const { isAuthenticated, openAuthModal } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [formRating, setFormRating] = useState(0);
  const [formComment, setFormComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  function load() {
    api.productReviews(slug).then(setData).catch((err) => setError(err.message));
  }

  useEffect(load, [slug]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (formRating === 0) {
      setSubmitError(t("review_rating_required"));
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.postReview(slug, { rating: formRating, comment: formComment });
      setFormRating(0);
      setFormComment("");
      load();
    } catch (err) {
      setSubmitError(err.message || t("generic_error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <p className="text-danger-600 text-sm">{error}</p>;
  if (!data) return <p className="text-gray-400 text-sm">{t("loading")}</p>;

  return (
    <div>
      {data.review_count > 0 && (
        <div className="flex items-center gap-2 mb-6">
          <StarRow value={Math.round(data.average_rating)} size={18} />
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {data.average_rating} · {t("items_count", { count: data.review_count })}
          </span>
        </div>
      )}

      {/* Eligibility states — write access is gated server-side; this just
          reflects that honestly rather than always showing a form. */}
      {!isAuthenticated && (
        <div className="flex items-center justify-between gap-3 bg-brand-50 dark:bg-gray-800 border border-brand-100 dark:border-gray-700 rounded-lg px-4 py-3 mb-6">
          <p className="text-sm text-brand-700 dark:text-brand-400">{t("review_signin_prompt")}</p>
          <button
            onClick={() => openAuthModal("login")}
            className="shrink-0 flex items-center gap-1.5 text-sm font-medium text-brand-700 dark:text-brand-400 hover:underline"
          >
            <LogIn className="h-4 w-4" /> {t("account_sign_in")}
          </button>
        </div>
      )}
      {isAuthenticated && data.already_reviewed && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t("review_already_submitted")}</p>
      )}
      {isAuthenticated && !data.already_reviewed && !data.can_review && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t("review_purchase_required")}</p>
      )}

      {isAuthenticated && data.can_review && (
        <form onSubmit={handleSubmit} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 mb-6 space-y-3">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t("review_form_heading")}</p>
          <StarRow value={formRating} size={22} onSelect={setFormRating} />
          <textarea
            value={formComment}
            onChange={(e) => setFormComment(e.target.value)}
            placeholder={t("review_comment_placeholder")}
            rows={3}
            className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm"
          />
          {submitError && <p className="text-danger-600 text-sm">{submitError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="bg-accent-500 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-accent-400 disabled:opacity-50"
          >
            {submitting ? t("loading") : t("review_submit")}
          </button>
        </form>
      )}

      {data.results.length === 0 ? (
        <p className="text-gray-400 dark:text-gray-500 text-sm italic">{t("reviews_none_yet")}</p>
      ) : (
        <div className="space-y-4">
          {data.results.map((review) => (
            <div key={review.id} className="border-b border-gray-100 dark:border-gray-800 pb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{review.customer_name}</span>
                <span className="text-xs text-gray-400">{new Date(review.created_at).toLocaleDateString()}</span>
              </div>
              <StarRow value={review.rating} size={14} />
              {review.comment && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5">{review.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
