import axios from "axios";

export const FRIENDLY_NETWORK_ERROR_AR =
  "تعذّر الاتصال بالخادم. يرجى التحقق من الاتصال بالإنترنت والمحاولة مرة أخرى.";
export const FRIENDLY_SERVER_ERROR_AR = "حدث خطأ في الخادم. يرجى المحاولة مرة أخرى لاحقًا.";
export const FRIENDLY_AUTH_ERROR_AR = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
export const FRIENDLY_VALIDATION_ERROR_AR = "يرجى التحقق من البيانات المدخلة والمحاولة مرة أخرى.";
export const FRIENDLY_GENERIC_ERROR_AR = "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.";

// Field names as they appear in a 422 `detail[].loc` array (FastAPI/pydantic
// convention), mapped to their existing Arabic label so the message names
// the actual field instead of a generic "check your input".
const VALIDATION_FIELD_LABELS_AR: Record<string, string> = {
  email: "البريد الإلكتروني",
  password: "كلمة المرور",
  full_name: "الاسم",
  phone: "رقم الهاتف",
  file: "الصورة",
};

type ValidationDetailItem = { loc?: (string | number)[]; msg?: string; type?: string };

// Turns a 422 response's `detail` array into a readable Arabic message
// naming the offending field(s), instead of surfacing the raw English
// pydantic error text. Falls back to the generic validation message if
// `detail` is missing, empty, or names no field this app recognizes.
function formatValidationErrorAr(detail: unknown): string {
  if (!Array.isArray(detail) || detail.length === 0) return FRIENDLY_VALIDATION_ERROR_AR;

  const fieldLabels = new Set<string>();
  for (const item of detail as ValidationDetailItem[]) {
    const fieldKey = Array.isArray(item?.loc) ? item.loc[item.loc.length - 1] : undefined;
    if (typeof fieldKey === "string" && VALIDATION_FIELD_LABELS_AR[fieldKey]) {
      fieldLabels.add(VALIDATION_FIELD_LABELS_AR[fieldKey]);
    }
  }

  if (fieldLabels.size === 0) return FRIENDLY_VALIDATION_ERROR_AR;
  return `يرجى التحقق من: ${Array.from(fieldLabels).join("، ")}`;
}

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
    if (status === 422) {
      return new ApiError(formatValidationErrorAr(error.response?.data?.detail), { status, isRetryable: false });
    }
    if (status === 400) {
      return new ApiError(FRIENDLY_VALIDATION_ERROR_AR, { status, isRetryable: false });
    }
    if (status && status >= 400) {
      return new ApiError(FRIENDLY_GENERIC_ERROR_AR, { status, isRetryable: false });
    }
  }

  return new ApiError(FRIENDLY_GENERIC_ERROR_AR, { isRetryable: false });
}
