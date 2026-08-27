import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { fetchMe, logout as apiLogout } from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [activeBranchId, setActiveBranchId] = useState(
    localStorage.getItem("active_branch_id") || null
  );
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const me = await fetchMe();
      setUser(me);
      // If no active branch chosen yet, default to the first one available.
      if (!activeBranchId && me.branch_access.length > 0) {
        const first = me.branch_access[0].branch_id;
        setActiveBranchId(first);
        if (first) localStorage.setItem("active_branch_id", first);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    loadUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function switchBranch(branchId) {
    setActiveBranchId(branchId);
    localStorage.setItem("active_branch_id", branchId || "");
  }

  function logout() {
    apiLogout();
    localStorage.removeItem("active_branch_id");
    setUser(null);
    setActiveBranchId(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, activeBranchId, switchBranch, logout, reloadUser: loadUser, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
