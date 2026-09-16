// Mirrors backend/app/services/reminder_service.py::parse_expiry_date so the
// "New Reminder" form can pre-fill the date/time when a document with a
// readable expiry_date is selected. The AI pipeline returns expiry_date as
// free-form text (Arabic-Indic digits, Arabic month names, various
// separators) with no format guarantee — parse defensively, same as the
// backend does, and return null rather than guess when it can't be read.
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

const ARABIC_MONTHS: Record<string, number> = {
  يناير: 1, فبراير: 2, مارس: 3, أبريل: 4, ابريل: 4, مايو: 5,
  يونيو: 6, يونية: 6, يوليو: 7, يولية: 7, أغسطس: 8, اغسطس: 8,
  سبتمبر: 9, أكتوبر: 10, اكتوبر: 10, نوفمبر: 11, ديسمبر: 12,
};

const DATE_SUBSTRING_RE = /\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}/;

function normalizeDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC_DIGITS.indexOf(d)));
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function makeDate(year: number, month: number, day: number): Date | null {
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

function tryFormats(text: string): Date | null {
  // %Y-%m-%d / %Y-%m-%dT...
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return makeDate(+m[1], +m[2], +m[3]);

  // %d/%m/%Y, %d-%m-%Y, %d.%m.%Y
  m = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) return makeDate(+m[3], +m[2], +m[1]);

  // %Y/%m/%d
  m = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) return makeDate(+m[1], +m[2], +m[3]);

  // %m/%Y
  m = text.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return makeDate(+m[2], +m[1], 1);

  return null;
}

function tryArabicMonthName(text: string): Date | null {
  for (const [name, monthNum] of Object.entries(ARABIC_MONTHS)) {
    if (!text.includes(name)) continue;
    const digits = text.match(/\d+/g);
    if (digits && digits.length >= 2) {
      const day = Number(digits[0]);
      let year = Number(digits[digits.length - 1]);
      if (year < 100) year += 2000;
      return makeDate(year, monthNum, day);
    }
  }
  return null;
}

export function parseExpiryDate(raw: string | null | undefined): { dateStr: string; timeStr: string } | null {
  if (!raw || !raw.trim()) return null;
  const normalized = normalizeDigits(raw.trim());

  let date = tryFormats(normalized);
  if (!date) date = tryArabicMonthName(normalized);
  if (!date) {
    const match = normalized.match(DATE_SUBSTRING_RE);
    if (match) date = tryFormats(match[0]);
  }
  if (!date) return null;

  return {
    dateStr: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
    timeStr: "09:00",
  };
}
