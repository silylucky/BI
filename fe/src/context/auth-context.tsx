import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";
import {
  apiFetch,
  isHeadlessAuthContext,
  registerUnauthorizedHandler,
} from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth-token";
import { shouldClearAuthSession } from "@/lib/auth-session";
import type { SessionRole } from "@/lib/session";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  roles: SessionRole[];
  permissions?: string[];
  isRoot?: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
  refresh: () => Promise<AuthUser | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(getAuthToken()));

  const logout = useCallback(() => {
    clearAuthToken();
    setUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  const refresh = useCallback(async (): Promise<AuthUser | null> => {
    if (!getAuthToken()) {
      setUser(null);
      setIsLoading(false);
      return null;
    }
    setIsLoading(true);
    try {
      const me = await apiFetch<{
        id: string;
        username: string;
        displayName?: string;
        email?: string;
        roles: string[];
        permissions?: string[];
        isRoot?: boolean;
      }>("/api/v1/me");
      const next: AuthUser = {
        id: me.id,
        username: me.username,
        displayName: me.displayName ?? me.username,
        email: me.email ?? `${me.username}@vitalspan.local`,
        roles: me.roles as SessionRole[],
        permissions: me.permissions ?? [],
        isRoot: me.isRoot ?? false,
      };
      setUser(next);
      return next;
    } catch (err) {
      if (shouldClearAuthSession(err)) {
        clearAuthToken();
        setUser(null);
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isHeadlessAuthContext()) {
      setIsLoading(false);
      return;
    }
    const unregisterUnauthorizedHandler = registerUnauthorizedHandler(() => {
      if (isHeadlessAuthContext()) {
        clearAuthToken();
        setUser(null);
        return;
      }
      logout();
    });
    void refresh();
    return unregisterUnauthorizedHandler;
  }, [logout, refresh]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      // 本地 token 仍在时视为已登录，避免 /me 瞬时失败（后端 reload、超时）误踢回登录页
      isAuthenticated: Boolean(user) || Boolean(getAuthToken()),
      logout,
      refresh,
    }),
    [user, isLoading, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
