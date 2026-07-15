import type { AnalyzeDocumentResponse } from "@/features/scan/api";
import { flattenAnalyzeFields } from "@/features/scan/fields";
import { SCAN_ROW_KEY_MAP } from "@/features/scan/rowMapping";
import { SCAN_EXTRACT_ITEMS } from "@/features/scan/data";

export type ScanResultRow = { id: string; label: string; value: string };

const PLACEHOLDER = "—";

// TODO(asma): final copy
const SUMMARY_ROW_LABEL = "ملخص";

// Assembles the full row list the Scan screen renders: the summary row
// pinned on top, then the 7 hardcoded rows (populated from the analyze
// response, "—" for any that didn't match), then any leftover
// backend-provided fields that didn't match a known row — never dropped.
//
// Callers must only invoke this once a successful AnalyzeDocumentResponse
// exists — the Scan screen renders no result rows at all before then (see
// scan.tsx), so there is no "null result" case to handle here.
export function buildScanResultRows(result: AnalyzeDocumentResponse): ScanResultRow[] {
  const summaryRow: ScanResultRow = {
    id: "summary",
    label: SUMMARY_ROW_LABEL,
    value: result.summary_arabic,
  };

  const rowValues: Record<string, string> = {};
  const leftoverRows: ScanResultRow[] = [];

  for (const { label, value } of flattenAnalyzeFields(result.fields)) {
    const rowId = SCAN_ROW_KEY_MAP[label.trim().toLowerCase()];
    if (rowId) {
      // Multiple backend keys can land on the same row (e.g. issue_date +
      // expiry_date both map to "dates") — combine rather than overwrite.
      rowValues[rowId] = rowValues[rowId] ? `${rowValues[rowId]} / ${value}` : value;
    } else {
      leftoverRows.push({ id: `extra-${leftoverRows.length}-${label}`, label, value });
    }
  }

  // document_type and next_steps are dedicated, strongly-typed fields on
  // the response itself — more reliable than a guessed match inside the
  // loosely-typed `fields` array, so they win over anything set above.
  rowValues["doc-type"] = result.document_type;
  if (result.next_steps.length > 0) {
    // Presented as one line per step within the "الخطوة التالية" row.
    rowValues["next-step"] = result.next_steps.join("\n");
  }

  const hardcodedRows: ScanResultRow[] = SCAN_EXTRACT_ITEMS.map((item) => ({
    id: item.id,
    label: item.label,
    value: rowValues[item.id] ?? PLACEHOLDER,
  }));

  return [summaryRow, ...hardcodedRows, ...leftoverRows];
}
