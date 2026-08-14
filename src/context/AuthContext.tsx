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
      let persisted: any = null;

      const savedAuth =
        localStorage.getItem("vega_auth");

      if (savedAuth) {
        try {
          persisted = JSON.parse(savedAuth);
        } catch {
          localStorage.removeItem("vega_auth");
        }
      }

      /*
       * Do NOT require localStorage before attempting refresh.
       *
       * The HttpOnly refresh cookie is the real source of truth.
       */
      const data = await refreshSession();

      if (cancelled) return;

      setAccessToken(data.token);
      setToken(data.token);

      const restoredUser =
        data.user || persisted?.user || null;

      setUser(restoredUser);
      setProfile(persisted?.profile || null);

      localStorage.setItem(
        "vega_auth",
        JSON.stringify({
          user: restoredUser,
          profile: persisted?.profile || null,
        })
      );
    } catch {
      if (cancelled) return;

      /*
       * No valid refresh cookie means the user is genuinely
       * logged out.
       */
      setAccessToken(null);
      setToken(null);
      setUser(null);
      setProfile(null);

      localStorage.removeItem("vega_auth");
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
    localStorage.setItem("vega_auth", JSON.stringify({ user: data.user, profile: data.profile }));
  };

  const updateProfile = (newProfile: any) => {
    setProfile(newProfile);
    const savedAuth = localStorage.getItem("vega_auth");
    if (savedAuth) {
      const auth = JSON.parse(savedAuth);
      auth.profile = newProfile;
      localStorage.setItem("vega_auth", JSON.stringify(auth));
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout", {}); } catch {}
    setUser(null);
    setToken(null);
    setAccessToken(null);
    setProfile(null);
    localStorage.removeItem("vega_auth");
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
