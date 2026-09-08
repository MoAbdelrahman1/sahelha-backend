import type { Document } from "@/types/document";

// Seed documents for the demo document list (Home/Archive/Detail/Chat), reused
// verbatim from the design mockup — written specifically for this product's
// real field/tag names, not lorem ipsum. Self-consistent demo island, separate
// from Scan's existing real (legacy-endpoint) call — see the refactor plan.
export const DEMO_DOCUMENTS: Document[] = [
  {
    id: 1,
    status: "done",
    doc_type: "national_id",
    ai_summary:
      "دي بطاقة الرقم القومي بتاعة محمود السيد عبد الرحمن، صادرة من الجيزة. تاريخ الانتهاء أول يناير ٢٠٢٧، يعني قدامك حوالي أربع شهور لتجديدها.",
    ocr_text:
      "جمهورية مصر العربية - بطاقة تحقيق شخصية - الاسم: محمود السيد عبد الرحمن - الرقم القومي: ٢٩٠٠٥١٥١٢٣٤٥٦٧ - العنوان: ١٥ شارع الجمهورية، الدقي - تاريخ الانتهاء: ١ يناير ٢٠٢٧",
    entities: {
      name: "محمود السيد عبد الرحمن",
      address: "١٥ شارع الجمهورية، الدقي",
      governorate: "الجيزة",
      national_number: "٢٩٠٠٥١٥١٢٣٤٥٦٧",
    },
    dates: ["١ يناير ٢٠٢٠", "١ يناير ٢٠٢٧"],
    amounts: [],
    expiry_date: "١ يناير ٢٠٢٧",
    expirySoon: true,
    reminderSet: true,
    tags: ["identity", "government", "arabic"],
    image_url: null,
    created_at: "2026-07-13T10:05:00+00:00",
  },
  {
    id: 2,
    status: "done",
    doc_type: "utility_bill",
    ai_summary: "فاتورة كهرباء لشهر أغسطس ٢٠٢٦. المطلوب دفعه ٢٤٥.٥٠ جنيه، وآخر يوم للسداد ٢٠ سبتمبر ٢٠٢٦.",
    ocr_text: "شركة توزيع كهرباء الجيزة - فاتورة استهلاك أغسطس ٢٠٢٦ - المطلوب: ٢٤٥.٥٠ جنيه - آخر ميعاد للسداد: ٢٠ سبتمبر ٢٠٢٦",
    entities: { name: "", address: "١٥ شارع الجمهورية، الدقي", governorate: "الجيزة" },
    dates: ["٢٠ سبتمبر ٢٠٢٦"],
    amounts: ["٢٤٥.٥٠ جنيه"],
    expiry_date: null,
    reminderSet: false,
    tags: ["financial", "government"],
    image_url: null,
    created_at: "2026-08-02T09:00:00+00:00",
  },
  {
    id: 3,
    status: "processing",
    doc_type: null,
    ai_summary: null,
    ocr_text: null,
    entities: {},
    dates: [],
    amounts: [],
    expiry_date: null,
    reminderSet: false,
    tags: [],
    image_url: null,
    created_at: "2026-09-06T08:20:00+00:00",
  },
  {
    id: 4,
    status: "failed",
    doc_type: "birth_certificate",
    ai_summary: "الصورة مش واضحة، حاول تصويرها تاني في إضاءة أحسن.",
    ocr_text: null,
    entities: {},
    dates: [],
    amounts: [],
    expiry_date: null,
    reminderSet: false,
    tags: ["government"],
    image_url: null,
    created_at: "2026-09-01T11:40:00+00:00",
  },
];

export const CHAT_SEED: Record<number, { from: "assistant" | "user"; text: string }[]> = {
  1: [
    { from: "assistant", text: "أهلاً محمود، أنا هنا لو عندك أي سؤال عن بطاقة الرقم القومي." },
    { from: "user", text: "امتى تاريخ انتهاء البطاقة؟" },
    { from: "assistant", text: "تاريخ الانتهاء هو ١ يناير ٢٠٢٧، يعني قدامك حوالي أربع شهور لسه." },
  ],
};
