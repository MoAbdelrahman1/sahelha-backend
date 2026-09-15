export type ScanExtractItem = {
  id: string;
  label: string;
};

// Single source of truth for the "what it extracts" preview list — the scan
// screen maps over this with one row component rather than hand-written rows.
export const SCAN_EXTRACT_ITEMS: ScanExtractItem[] = [
  { id: "doc-type", label: "نوع المستند" },
  { id: "name", label: "الاسم" },
  { id: "address-gov", label: "العنوان / المحافظة" },
  { id: "national-number", label: "الرقم القومي" },
  { id: "issuer", label: "الجهة الحكومية" },
  { id: "doc-number", label: "رقم المستند" },
  { id: "dates", label: "تواريخ مذكورة" },
  { id: "expiry", label: "تاريخ الانتهاء" },
  { id: "amount", label: "المبلغ المطلوب" },
  { id: "actions", label: "الإجراءات المطلوبة" },
  { id: "next-step", label: "الخطوة التالية" },
];
