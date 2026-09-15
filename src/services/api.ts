import axios from "axios";
import { getAccessToken, setAccessToken, getRefreshToken, setRefreshToken, clearTokens } from "./tokenStore";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

let refreshPromise: Promise<any> | null = null;

/**
 * Only one refresh request can run per browser tab at a time.
 * This prevents React StrictMode and simultaneous 401s from
 * rotating the same refresh token multiple times.
 */
export async function refreshSession() {
  if (!refreshPromise) {
    const rfToken = getRefreshToken();
    refreshPromise = axios
      .post(
        "/api/auth/refresh-token",
        rfToken ? { refreshToken: rfToken } : {},
        {
          withCredentials: true,
        }
      )
      .then(({ data }) => {
        if (!data?.success || !data?.token) {
          throw new Error("Unable to refresh session");
        }

        setAccessToken(data.token);
        if (data.refreshToken) {
          setRefreshToken(data.refreshToken);
        }

        return data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    if (config.headers && typeof (config.headers as any).set === "function") {
      (config.headers as any).set("Authorization", `Bearer ${token}`);
    } else if (config.headers) {
      (config.headers as any)["Authorization"] = `Bearer ${token}`;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      originalRequest.url?.includes("/auth/refresh-token")
    ) {
      if (error.response?.status === 401 && !originalRequest?.url?.includes("/auth/refresh-token")) {
        clearTokens();
        if (window.location.pathname !== "/login" && window.location.pathname !== "/") {
          setTimeout(() => {
            window.location.href = "/login?expired=true";
          }, 100);
        }
        if (error.response?.data) {
          error.response.data.message = "Your session has expired. Please log in again to continue.";
        }
      }
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const data = await refreshSession();

      if (originalRequest.headers && typeof (originalRequest.headers as any).set === "function") {
        (originalRequest.headers as any).set("Authorization", `Bearer ${data.token}`);
      } else if (originalRequest.headers) {
        (originalRequest.headers as any)["Authorization"] = `Bearer ${data.token}`;
      }

      return api(originalRequest);
    } catch (refreshError: any) {
      clearTokens();

      if (window.location.pathname !== "/login" && window.location.pathname !== "/") {
        setTimeout(() => {
          window.location.href = "/login?expired=true";
        }, 100);
      }

      return Promise.reject({
        ...refreshError,
        response: {
          ...(refreshError?.response || {}),
          status: 401,
          data: {
            success: false,
            message: "Your session has expired. Please log in again to continue.",
            code: "TOKEN_EXPIRED",
            expired: true,
          },
        },
        message: "Your session has expired. Please log in again to continue.",
      });
    }
  }
);

export default api;