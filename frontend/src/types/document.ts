// Mirrors the real backend shape (API_DOCUMENTATION.md §5, §13) so swapping the
// demo data source (src/features/documents/demoData.ts) for a real
// GET /api/documents/ call later is a drop-in — no shape changes needed upstream.

export type DocStatus = "processing" | "done" | "failed";

export type DocType =
  | "national_id"
  | "passport"
  | "birth_certificate"
  | "utility_bill"
  | "receipt"
  | "invoice"
  | "work_permit"
  | "marriage_certificate"
  | "death_certificate"
  | "property_record"
  | "unknown";

export type DocEntities = {
  name?: string;
  address?: string;
  governorate?: string;
  national_number?: string;
};

export type Document = {
  id: number;
  status: DocStatus;
  doc_type: DocType | null;
  ai_summary: string | null;
  ocr_text: string | null;
  entities: DocEntities;
  dates: string[];
  amounts: string[];
  expiry_date: string | null;
  /** true once analysis found an expiry date close enough to flag on the list ("قريب من الانتهاء"). */
  expirySoon?: boolean;
  reminderSet?: boolean;
  tags: string[];
  image_url: string | null;
  created_at: string;
};

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  national_id: "بطاقة الرقم القومي",
  passport: "جواز السفر",
  birth_certificate: "شهادة الميلاد",
  utility_bill: "فاتورة مرافق",
  receipt: "إيصال",
  invoice: "فاتورة ضريبية",
  work_permit: "تصريح عمل",
  marriage_certificate: "عقد زواج",
  death_certificate: "شهادة وفاة",
  property_record: "مستند ملكية",
  unknown: "مستند غير معروف",
};
