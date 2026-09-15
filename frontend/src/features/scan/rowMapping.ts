// ---------------------------------------------------------------------------
// SINGLE EDIT POINT. The real backend keys inside POST /api/document/analyze's
// `fields` array are not yet known — the keys below are best-guess names.
// Once Asma sees one real response, update the left-hand keys here to match
// exactly; nothing else needs to change. Matching (see resultRows.ts) is
// case-insensitive and trims whitespace, so only the key text matters, not
// its casing.
//
// Anything from `fields` that doesn't match a key below is NEVER dropped —
// it's rendered as an extra row below the 7 (see resultRows.ts), so a wrong
// guess here just means an extra unmatched row, not lost data.
// ---------------------------------------------------------------------------
export const SCAN_ROW_KEY_MAP: Record<string, string> = {
  // -> "doc-type" (نوع المستند)
  document_type: "doc-type",
  doc_type: "doc-type",
  type: "doc-type",
  "نوع المستند": "doc-type",

  // -> "issuer" (الجهة الحكومية)
  issuer: "issuer",
  government_office: "issuer",
  agency: "issuer",
  "الجهة الحكومية": "issuer",

  // -> "amount" (المبلغ المطلوب)
  amount: "amount",
  amount_due: "amount",
  fee: "amount",
  "المبلغ المطلوب": "amount",

  // -> "dates" (تاريخ الإصدار وتاريخ الانتهاء)
  issue_date: "dates",
  issued_at: "dates",
  expiry_date: "dates",
  expires_at: "dates",
  dates: "dates",
  "تاريخ الإصدار وتاريخ الانتهاء": "dates",
  "تاريخ الإصدار والانتهاء": "dates",

  // -> "doc-number" (رقم المستند)
  document_number: "doc-number",
  doc_number: "doc-number",
  reference_number: "doc-number",
  national_number: "doc-number",
  national_id: "doc-number",
  id_number: "doc-number",
  "رقم المستند": "doc-number",
  "الرقم القومي": "doc-number",

  // -> "actions" (الإجراءات المطلوبة)
  actions: "actions",
  required_actions: "actions",
  action_required: "actions",
  "الإجراءات المطلوبة": "actions",

  // -> "next-step" (الخطوة التالية)
  next_step: "next-step",
  "الخطوة التالية": "next-step",
};
