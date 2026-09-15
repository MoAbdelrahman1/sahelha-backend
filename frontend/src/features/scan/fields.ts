export type ScanFieldPair = { label: string; value: string };

// Unpacks fields array into a normalized list of { label, value } pairs.
// Handles both { key: value } and { field_key, field_label_ar, field_value } representations safely.
export function flattenAnalyzeFields(fields: unknown): ScanFieldPair[] {
  if (!Array.isArray(fields)) return [];

  const pairs: ScanFieldPair[] = [];
  for (const entry of fields) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;

    // Case 1: Legacy triple-key shape: { field_key, field_label_ar, field_value }
    if ("field_value" in record) {
      const label = String(record.field_key || record.field_label_ar || "").trim();
      const value = String(record.field_value ?? "").trim();
      if (label && value) {
        pairs.push({ label, value });
      }
      continue;
    }

    // Case 2: Clean key-value dict: { [label]: value }
    for (const [label, value] of Object.entries(record)) {
      if (value === null || value === undefined) continue;
      const strVal = String(value).trim();
      if (strVal) {
        pairs.push({ label: label.trim(), value: strVal });
      }
    }
  }
  return pairs;
}
