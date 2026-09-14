"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useWishlist } from "./WishlistProvider";
import { useLanguage } from "./LanguageProvider";

export default function WishlistBadge() {
  const { t } = useLanguage();
  const { isAuthenticated, openAuthModal } = useAuth();
  const { wishlistIds } = useWishlist();
  const count = wishlistIds.size;

  // Same prominence as CartBadge — always visible in the header, not
  // buried in the account dropdown. Signed out: opens sign-in (wishlist
  // is account-only, see WishlistProvider's docstring), same pattern
  // AccountMenu already uses for its own signed-out state.
  if (!isAuthenticated) {
    return (
      <button
        onClick={() => openAuthModal("login")}
        aria-label={t("wishlist_heading")}
        className="h-9 px-3 flex items-center gap-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <Heart className="h-4 w-4" />
      </button>
    );
  }

  return (
    <Link
      href="/account/wishlist"
      aria-label={t("wishlist_heading")}
      className="relative h-9 px-3 flex items-center gap-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
    >
      <Heart className="h-4 w-4" fill={count > 0 ? "currentColor" : "none"} />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-brand-700 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
          {count}
        </span>
      )}
    </Link>
  );
}
