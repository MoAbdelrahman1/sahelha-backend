// Central place for env-driven tunables used by lib/api/*. Nothing outside
// this file should read process.env directly — when the backend contract or
// deployment target changes, this is the only file (plus lib/api/auth.ts for
// endpoint shapes) that should need edits.
//
// EXPO_PUBLIC_ variables are inlined into the JS bundle at build time and are
// visible to anyone who inspects the app — they are NOT secret. Fine for a
// base URL or a timeout; never put API keys or credentials behind one.
//
// See .env.example at the project root for the full list of keys.

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://REPLACE_ME";

// Per-request timeout, in ms. A hanging request rejects instead of freezing the UI.
export const API_TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS ?? 15000);

// Max automatic retries for transient failures (network error / timeout / 5xx).
export const API_MAX_RETRIES = Number(process.env.EXPO_PUBLIC_API_MAX_RETRIES ?? 3);

// Base delay for exponential backoff between retries, in ms
// (attempt N waits roughly API_RETRY_BASE_DELAY_MS * 2^N, plus jitter).
export const API_RETRY_BASE_DELAY_MS = Number(process.env.EXPO_PUBLIC_API_RETRY_BASE_DELAY_MS ?? 500);
