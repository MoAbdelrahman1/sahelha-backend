import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthUser, getMe, login as apiLogin } from "@/features/auth/api";
import { clearTokens, getAccessToken } from "@/lib/api/tokenStore";

type AuthContextType = {
  user: AuthUser | null;
  isLoggedIn: boolean;
  loading: boolean;
  loginUser: (email: string, pass: string) => Promise<AuthUser>;
  logoutUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  loading: true,
  loginUser: async () => { throw new Error("AuthProvider not mounted"); },
  logoutUser: async () => {},
  refreshUser: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      const currentUser = await getMe();
      setUser(currentUser);
    } catch (err) {
      console.warn("[AUTH] Error loading current user:", err);
      setUser(null);
      await clearTokens();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const loginUser = async (email: string, pass: string): Promise<AuthUser> => {
    const res = await apiLogin(email, pass);
    setUser(res.user);
    return res.user;
  };

  const logoutUser = async () => {
    await clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        loading,
        loginUser,
        logoutUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
