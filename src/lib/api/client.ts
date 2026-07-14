import axios from "axios";

import { API_BASE_URL, API_TIMEOUT_MS } from "../config";
import { getAccessToken } from "./tokenStore";
import { attachResilience } from "./resilience";
import { startFailQueueAutoDrain } from "./failQueue";

// Bare instance used only for the token-refresh call (see resilience.ts) so
// that refreshing never re-enters the retry/refresh interceptor chain below.
export const rawClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
});

// The one axios instance every API call in this app should go through.
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
});

apiClient.interceptors.request.use(async (config) => {
  console.log('INTERCEPTOR: about to read token');
  const token = await getAccessToken();
  console.log('INTERCEPTOR: token read OK');
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
});

attachResilience(apiClient, rawClient);
startFailQueueAutoDrain(apiClient);
