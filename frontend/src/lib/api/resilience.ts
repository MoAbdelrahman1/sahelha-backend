import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { router } from "expo-router";

import { API_MAX_RETRIES, API_RETRY_BASE_DELAY_MS } from "../config";
import { clearTokens, getRefreshToken, saveTokens } from "./tokenStore";
import { toApiError } from "./errors";
import { enqueueFailedRequest } from "./failQueue";

type RetryableConfig = AxiosRequestConfig & {
  __retryCount?: number;
  __isAuthRetry?: boolean;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isAuthEndpoint = (url?: string) =>
  typeof url === "string" &&
  (url.includes("/auth/login") || url.includes("/auth/register") || url.includes("/auth/refresh"));

// Wires retry-with-backoff, the single-flight 401 refresh, and the fail
// queue onto `client`. `rawClient` is a bare axios instance (no interceptors)
// used only for the refresh call itself, so refreshing never re-enters this
// same interceptor chain.
export function attachResilience(client: AxiosInstance, rawClient: AxiosInstance): void {
  let refreshPromise: Promise<string> | null = null;

  async function performRefresh(): Promise<string> {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      throw new Error("No refresh token stored");
    }
    // NOTE: the backend contract doesn't confirm a refresh route/payload
    // shape yet — this assumes POST /api/auth/refresh with
    // { refresh_token } returning the same {access_token, refresh_token,
    // token_type, user} shape as login/register. Update this one call when
    // the real contract lands.
    const { data } = await rawClient.post("/api/auth/refresh", { refresh_token: refreshToken });
    await saveTokens(data.access_token, data.refresh_token);
    return data.access_token as string;
  }

  function getOrStartRefresh(): Promise<string> {
    if (!refreshPromise) {
      refreshPromise = performRefresh().finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  }

  client.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (!axios.isAxiosError(error) || !error.config) {
        return Promise.reject(toApiError(error));
      }

      const config = error.config as RetryableConfig;
      const status = error.response?.status;

      // 401 on a real (non-auth-endpoint) request: try a single-flight
      // refresh, then replay this request once with the new token. Any other
      // request that 401s while a refresh is already in flight piggybacks on
      // the same in-flight promise instead of firing its own refresh.
      if (status === 401 && !isAuthEndpoint(config.url) && !config.__isAuthRetry) {
        config.__isAuthRetry = true;
        try {
          const newAccessToken = await getOrStartRefresh();
          config.headers = { ...(config.headers ?? {}), Authorization: `Bearer ${newAccessToken}` };
          return client(config);
        } catch (refreshError) {
          await clearTokens();
          // Refresh failed — the session is gone. Retarget point: where an
          // expired/invalid session sends the user.
          router.replace("/login");
          return Promise.reject(toApiError(refreshError));
        }
      }

      const apiError = toApiError(error);

      if (apiError.isRetryable) {
        const retryCount = config.__retryCount ?? 0;
        if (retryCount < API_MAX_RETRIES) {
          config.__retryCount = retryCount + 1;
          const backoff = API_RETRY_BASE_DELAY_MS * 2 ** retryCount + Math.floor(Math.random() * 100);
          await sleep(backoff);
          return client(config);
        }
        // Retries exhausted — keep it for a later manual/auto redrive instead
        // of losing it outright.
        enqueueFailedRequest(config);
      }

      return Promise.reject(apiError);
    }
  );
}
