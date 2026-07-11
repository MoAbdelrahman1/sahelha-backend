import axios from "axios";

export const FRIENDLY_NETWORK_ERROR_AR =
  "تعذّر الاتصال بالخادم. يرجى التحقق من الاتصال بالإنترنت والمحاولة مرة أخرى.";
export const FRIENDLY_SERVER_ERROR_AR = "حدث خطأ في الخادم. يرجى المحاولة مرة أخرى لاحقًا.";
export const FRIENDLY_AUTH_ERROR_AR = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
export const FRIENDLY_VALIDATION_ERROR_AR = "يرجى التحقق من البيانات المدخلة والمحاولة مرة أخرى.";
export const FRIENDLY_GENERIC_ERROR_AR = "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.";

export class ApiError extends Error {
  friendlyMessageAr: string;
  status?: number;
  isRetryable: boolean;

  constructor(friendlyMessageAr: string, opts?: { status?: number; isRetryable?: boolean }) {
    super(friendlyMessageAr);
    this.name = "ApiError";
    this.friendlyMessageAr = friendlyMessageAr;
    this.status = opts?.status;
    this.isRetryable = opts?.isRetryable ?? false;
  }
}

// Classifies any thrown value into a friendly-Arabic-message ApiError.
// Retryable = network error, timeout, or 5xx. Never retryable = 4xx
// (400/401/422 etc.) — those are real errors and must surface immediately.
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    if (!error.response) {
      // No response at all: DNS/connection failure or a timed-out request
      // (ECONNABORTED) — always transient, worth retrying.
      return new ApiError(FRIENDLY_NETWORK_ERROR_AR, { isRetryable: true });
    }
    if (status === 401) {
      return new ApiError(FRIENDLY_AUTH_ERROR_AR, { status, isRetryable: false });
    }
    if (status && status >= 500) {
      return new ApiError(FRIENDLY_SERVER_ERROR_AR, { status, isRetryable: true });
    }
    if (status === 400 || status === 422) {
      return new ApiError(FRIENDLY_VALIDATION_ERROR_AR, { status, isRetryable: false });
    }
    if (status && status >= 400) {
      return new ApiError(FRIENDLY_GENERIC_ERROR_AR, { status, isRetryable: false });
    }
  }

  return new ApiError(FRIENDLY_GENERIC_ERROR_AR, { isRetryable: false });
}
