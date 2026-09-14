"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
import { AUTH_CHANGED_EVENT, hasAuthToken } from "../lib/api";

const WishlistContext = createContext({
  wishlistIds: new Set(),
  isWishlisted: () => false,
  toggle: async () => {},
});

export function WishlistProvider({ children }) {
  const [wishlistIds, setWishlistIds] = useState(new Set());

  function loadWishlist() {
    if (!hasAuthToken()) {
      setWishlistIds(new Set());
      return;
    }
    api.wishlist()
      .then((items) => setWishlistIds(new Set(items.map((i) => i.product.id))))
      .catch(() => setWishlistIds(new Set()));
  }

  useEffect(() => {
    loadWishlist();
    // Signing in/out elsewhere (AuthModal, AccountMenu) should update the
    // wishlist too — same event AuthProvider already dispatches.
    window.addEventListener(AUTH_CHANGED_EVENT, loadWishlist);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, loadWishlist);
  }, []);

  function isWishlisted(productId) {
    return wishlistIds.has(productId);
  }

  async function toggle(product) {
    const { wishlisted } = await api.toggleWishlist({ product: product.id });
    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (wishlisted) next.add(product.id);
      else next.delete(product.id);
      return next;
    });
    return wishlisted;
  }

  return (
    <WishlistContext.Provider value={{ wishlistIds, isWishlisted, toggle }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  return useContext(WishlistContext);
}
