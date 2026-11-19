import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiData } from "../api/client";
import type { StaffRole, StaffUser } from "../api/types";

const TOKEN_KEY = "cloud-reporting.access-token";
const USER_KEY = "cloud-reporting.staff-user";

interface AuthContextValue {
  token: string | null;
  user: StaffUser | null;
  loading: boolean;
  login: (email: string, password: string, facilityId: string) => Promise<void>;
  logout: () => void;
}

interface LoginResult {
  accessToken: string;
  user: StaffUser;
}

interface CurrentUser {
  userId: string;
  facilityId: string;
  role: StaffRole;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem(TOKEN_KEY),
  );
  const [user, setUser] = useState<StaffUser | null>(() => {
    const stored = sessionStorage.getItem(USER_KEY);
    return stored ? (JSON.parse(stored) as StaffUser) : null;
  });
  const [loading, setLoading] = useState(Boolean(token));

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let active = true;
    const restoreSession = async () => {
      try {
        const current = await apiData<CurrentUser>("/auth/me", { token });
        if (!active) return;
        const stored = sessionStorage.getItem(USER_KEY);
        const previous = stored ? (JSON.parse(stored) as StaffUser) : null;
        const restoredUser: StaffUser = {
          id: current.userId,
          email: previous?.email ?? "",
          facilityId: current.facilityId,
          facilityName: previous?.facilityName ?? "5C Networks",
          role: current.role,
        };
        sessionStorage.setItem(USER_KEY, JSON.stringify(restoredUser));
        setUser(restoredUser);
      } catch {
        if (active) logout();
      } finally {
        if (active) setLoading(false);
      }
    };

    void restoreSession();
    return () => {
      active = false;
    };
  }, [logout, token]);

  useEffect(() => {
    const handleExpiredSession = () => logout();
    window.addEventListener("staff-session-expired", handleExpiredSession);
    return () =>
      window.removeEventListener("staff-session-expired", handleExpiredSession);
  }, [logout]);

  const login = useCallback(
    async (email: string, password: string, facilityId: string) => {
      const result = await apiData<LoginResult>("/auth/login", {
        method: "POST",
        body: { email, password, facilityId },
      });
      sessionStorage.setItem(TOKEN_KEY, result.accessToken);
      sessionStorage.setItem(USER_KEY, JSON.stringify(result.user));
      setToken(result.accessToken);
      setUser(result.user);
    },
    [],
  );

  const value = useMemo(
    () => ({ token, user, loading, login, logout }),
    [token, user, loading, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
