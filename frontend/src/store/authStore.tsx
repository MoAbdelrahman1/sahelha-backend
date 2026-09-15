import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clearTokens, getAccessToken } from "@/lib/api/tokenStore";
import { getMe, type AuthUser } from "@/features/auth/api";

type AuthState = {
  user: AuthUser | null;
  isLoggedIn: boolean;
  loading: boolean;
  loginUser: (user: AuthUser) => void;
  logoutUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const USER_STORAGE_KEY = "sahelha_auth_user_v1";

function loadCachedUser(): AuthUser | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = window.localStorage.getItem(USER_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    }
  } catch {
    // Ignore read errors
  }
  return null;
}

function saveCachedUser(user: AuthUser | null) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      if (user) {
        window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      } else {
        window.localStorage.removeItem(USER_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore write errors
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => loadCachedUser());
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setUser(null);
        saveCachedUser(null);
        return;
      }
      const data = await getMe();
      setUser(data);
      saveCachedUser(data);
    } catch {
      // If token is invalid or expired
      setUser(null);
      saveCachedUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const loginUser = useCallback((userData: AuthUser) => {
    setUser(userData);
    saveCachedUser(userData);
  }, []);

  const logoutUser = useCallback(async () => {
    await clearTokens();
    setUser(null);
    saveCachedUser(null);
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem("sahelha_documents_v1");
    }
  }, []);

  const isLoggedIn = Boolean(user);

  const value = useMemo(
    () => ({
      user,
      isLoggedIn,
      loading,
      loginUser,
      logoutUser,
      refreshUser,
    }),
    [user, isLoggedIn, loading, loginUser, logoutUser, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
