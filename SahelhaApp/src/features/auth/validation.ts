// Each field exposes two checks used by the three-state border system in
// components/auth/ValidatedField.tsx:
//   - a "hasInvalidChar" check: does the CURRENT (possibly incomplete) value
//     already contain something that can never be valid? Fires RED immediately.
//   - an "isValid" check: is the FINISHED value fully valid? Used for GREEN on
//     blur (and for gating submit).

const ALLOWED_EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com"];

// Spaces, Arabic letters, or more than one "@" can never appear in a valid
// email — those are rejected immediately. An otherwise-plain, still-partial
// address (e.g. "abc" or "abc@gm") is not an error yet, just incomplete.
export function emailHasInvalidChar(value: string): boolean {
  if (/[\s؀-ۿ]/.test(value)) return true;
  const atCount = (value.match(/@/g) ?? []).length;
  return atCount > 1;
}

export function isValidEmail(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/^[^\s@]+@([^\s@]+)$/);
  if (!match) return false;
  return ALLOWED_EMAIL_DOMAINS.includes(match[1]);
}

// Passwords have no disallowed characters — a short password while typing is
// simply incomplete, never a "bad character" situation.
export function passwordHasInvalidChar(_value: string): boolean {
  return false;
}

export function isValidPassword(value: string): boolean {
  return value.length >= 8;
}

// Standard Arabic letters (U+0621–U+064A) and spaces only — a digit or Latin
// letter is rejected immediately. Excludes Arabic-Indic digits (٠-٩), which
// fall outside this range.
const ARABIC_NAME_PATTERN = /^[ء-ي\s]+$/;

export function nameHasInvalidChar(value: string): boolean {
  return /[^ء-ي\s]/.test(value);
}

export function isValidArabicName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && ARABIC_NAME_PATTERN.test(trimmed);
}

// Digits plus common phone-formatting punctuation are allowed; any letter (or
// other stray character) is rejected immediately.
const PHONE_ALLOWED_CHARS = /^[0-9+\-() ]*$/;

export function phoneHasInvalidChar(value: string): boolean {
  return !PHONE_ALLOWED_CHARS.test(value);
}

export function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || !PHONE_ALLOWED_CHARS.test(trimmed)) return false;
  return /[0-9]/.test(trimmed);
}

// Kept as an alias — lib/api/auth.ts and existing callers referred to this name.
export const isValidPhoneDigitsOnly = isValidPhone;
