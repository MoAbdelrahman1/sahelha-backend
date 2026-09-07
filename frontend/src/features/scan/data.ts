export type ScanExtractItem = {
  id: string;
  label: string;
};

// Single source of truth for the "what it extracts" preview list — the scan
// screen maps over this with one row component rather than hand-written rows.
export const SCAN_EXTRACT_ITEMS: ScanExtractItem[] = [
  { id: "doc-type", label: "نوع المستند" },
  { id: "issuer", label: "الجهة الحكومية" },
  { id: "amount", label: "المبلغ المطلوب" },
  { id: "dates", label: "تاريخ الإصدار وتاريخ الانتهاء" },
  { id: "doc-number", label: "رقم المستند" },
  { id: "actions", label: "الإجراءات المطلوبة" },
  { id: "next-step", label: "الخطوة التالية" },
];
