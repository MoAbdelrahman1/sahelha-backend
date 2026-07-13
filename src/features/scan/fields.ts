export type ScanFieldPair = { label: string; value: string };

// POST /api/document/analyze's `fields` is an ARRAY of OBJECTS with
// backend-chosen keys (Swagger's "additionalProp1/2/3" just means "arbitrary
// keys", not literal ones). This walks both levels — the array, then each
// object's entries — into one flat, ordered {label, value} list.
//
// Never throws: malformed/missing input just yields fewer (or zero) pairs.
export function flattenAnalyzeFields(fields: unknown): ScanFieldPair[] {
  if (!Array.isArray(fields)) return [];

  const pairs: ScanFieldPair[] = [];
  for (const entry of fields) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) continue;
    for (const [label, value] of Object.entries(entry as Record<string, unknown>)) {
      if (value === null || value === undefined) continue;
      pairs.push({ label, value: String(value) });
    }
  }
  return pairs;
}
