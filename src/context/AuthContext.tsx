import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api, { refreshSession } from "../services/api";
import { setAccessToken } from "../services/tokenStore";


interface User {
  id: number;
  email: string;
  role: "STUDENT" | "COMPANY" | "ADMIN" | "SUPER_ADMIN" | "TPO";
  is_verified: boolean;
  sidebarPermissions?: string[] | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  profile: any | null;
  loading: boolean;
  login: (data: any) => void;
  logout: () => void;
  updateProfile: (profile: any) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const bootstrapSession = async () => {
      try {
        // Check if there is an active session initiated by explicit login in this browser session
        const sessionActive = sessionStorage.getItem("vega_session_active") === "true";
        const savedAuth = sessionStorage.getItem("vega_auth") || localStorage.getItem("vega_auth");

        // If no explicit active session was started, unauthenticated visitors remain logged out by default
        if (!sessionActive || !savedAuth) {
          localStorage.removeItem("vega_auth");
          sessionStorage.removeItem("vega_auth");
          sessionStorage.removeItem("vega_session_active");
          sessionStorage.removeItem("token");
          setAccessToken(null);
          setToken(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        let persisted: any = null;
        try {
          persisted = JSON.parse(savedAuth);
        } catch {
          sessionStorage.removeItem("vega_auth");
          sessionStorage.removeItem("vega_session_active");
          localStorage.removeItem("vega_auth");
        }

        /*
         * Refresh session only for explicitly authenticated active sessions
         */
        const data = await refreshSession();

        if (cancelled) return;

        if (data?.token && (data?.user || persisted?.user)) {
          const activeUser = data.user || persisted?.user;
          setAccessToken(data.token);
          setToken(data.token);
          setUser(activeUser);
          setProfile(persisted?.profile || null);

          const authPayload = JSON.stringify({
            user: activeUser,
            profile: persisted?.profile || null,
            token: data.token,
          });
          sessionStorage.setItem("vega_session_active", "true");
          sessionStorage.setItem("vega_auth", authPayload);
          sessionStorage.setItem("token", data.token);
        } else {
          throw new Error("Unable to establish active session");
        }
      } catch {
        if (cancelled) return;

        /*
         * No valid session or refresh failed means the user is logged out.
         */
        setAccessToken(null);
        setToken(null);
        setUser(null);
        setProfile(null);

        sessionStorage.removeItem("vega_auth");
        sessionStorage.removeItem("vega_session_active");
        sessionStorage.removeItem("token");
        localStorage.removeItem("vega_auth");
        localStorage.removeItem("token");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = (data: any) => {
    setUser(data.user);
    setToken(data.token);
    setAccessToken(data.token || null);
    setProfile(data.profile);
    const authData = JSON.stringify({ user: data.user, profile: data.profile, token: data.token });
    sessionStorage.setItem("vega_session_active", "true");
    sessionStorage.setItem("vega_auth", authData);
    if (data.token) {
      sessionStorage.setItem("token", data.token);
    }
  };

  const updateProfile = (newProfile: any) => {
    setProfile(newProfile);
    const savedAuth = sessionStorage.getItem("vega_auth");
    if (savedAuth) {
      const auth = JSON.parse(savedAuth);
      auth.profile = newProfile;
      sessionStorage.setItem("vega_auth", JSON.stringify(auth));
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout", {}); } catch {}
    setUser(null);
    setToken(null);
    setAccessToken(null);
    setProfile(null);
    sessionStorage.removeItem("vega_auth");
    sessionStorage.removeItem("vega_session_active");
    sessionStorage.removeItem("token");
    localStorage.removeItem("vega_auth");
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider value={{ user, token, profile, loading, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
