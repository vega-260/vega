import axios from "axios";
import { getAccessToken, setAccessToken } from "./tokenStore";

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
    refreshPromise = axios
      .post(
        "/api/auth/refresh-token",
        {},
        {
          withCredentials: true,
        }
      )
      .then(({ data }) => {
        if (!data?.success || !data?.token) {
          throw new Error("Unable to refresh session");
        }

        setAccessToken(data.token);

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
    config.headers.Authorization = `Bearer ${token}`;
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
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const data = await refreshSession();

      originalRequest.headers =
        originalRequest.headers || {};

      originalRequest.headers.Authorization =
        `Bearer ${data.token}`;

      return api(originalRequest);
    } catch (refreshError) {
      setAccessToken(null);
      localStorage.removeItem("vega_auth");
      localStorage.removeItem("token");
      sessionStorage.removeItem("vega_auth");
      sessionStorage.removeItem("vega_session_active");
      sessionStorage.removeItem("token");

      if (window.location.pathname !== "/login" && window.location.pathname !== "/") {
        window.location.href = "/login";
      }

      return Promise.reject(refreshError);
    }
  }
);

export default api;