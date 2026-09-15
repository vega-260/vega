let accessToken: string | null = null;
let refreshToken: string | null = null;

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  try {
    const fromSession = sessionStorage.getItem("token");
    if (fromSession) {
      accessToken = fromSession;
      return fromSession;
    }
    const authData = sessionStorage.getItem("vega_auth") || localStorage.getItem("vega_auth");
    if (authData) {
      const parsed = JSON.parse(authData);
      if (parsed?.token) {
        accessToken = parsed.token;
        return parsed.token;
      }
    }
    const fromLocal = localStorage.getItem("token");
    if (fromLocal) {
      accessToken = fromLocal;
      return fromLocal;
    }
  } catch {}
  return null;
}

export function getRefreshToken(): string | null {
  if (refreshToken) return refreshToken;
  try {
    const fromSession = sessionStorage.getItem("vega_refresh_token");
    if (fromSession) {
      refreshToken = fromSession;
      return fromSession;
    }
    const authData = sessionStorage.getItem("vega_auth") || localStorage.getItem("vega_auth");
    if (authData) {
      const parsed = JSON.parse(authData);
      if (parsed?.refreshToken) {
        refreshToken = parsed.refreshToken;
        return parsed.refreshToken;
      }
    }
    const fromLocal = localStorage.getItem("vega_refresh_token");
    if (fromLocal) {
      refreshToken = fromLocal;
      return fromLocal;
    }
  } catch {}
  return null;
}

export function setRefreshToken(token: string | null) {
  refreshToken = token;
  try {
    if (token) {
      sessionStorage.setItem("vega_refresh_token", token);
      localStorage.setItem("vega_refresh_token", token);
      const authData = sessionStorage.getItem("vega_auth") || localStorage.getItem("vega_auth");
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          parsed.refreshToken = token;
          sessionStorage.setItem("vega_auth", JSON.stringify(parsed));
          localStorage.setItem("vega_auth", JSON.stringify(parsed));
        } catch {}
      }
    } else {
      sessionStorage.removeItem("vega_refresh_token");
      localStorage.removeItem("vega_refresh_token");
    }
  } catch {}
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  try {
    if (token) {
      sessionStorage.setItem("token", token);
      localStorage.setItem("token", token);
      const authData = sessionStorage.getItem("vega_auth") || localStorage.getItem("vega_auth");
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          parsed.token = token;
          sessionStorage.setItem("vega_auth", JSON.stringify(parsed));
          localStorage.setItem("vega_auth", JSON.stringify(parsed));
        } catch {}
      }
    } else {
      sessionStorage.removeItem("token");
      localStorage.removeItem("token");
    }
  } catch {}
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  try {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("vega_refresh_token");
    sessionStorage.removeItem("vega_auth");
    sessionStorage.removeItem("vega_session_active");
    localStorage.removeItem("token");
    localStorage.removeItem("vega_refresh_token");
    localStorage.removeItem("vega_auth");
  } catch {}
}

