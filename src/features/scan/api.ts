import { apiClient } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";

// Mirrors the confirmed Swagger contract for POST /api/document/analyze —
// see docs/API.md. `fields` deliberately keeps arbitrary backend-chosen keys
// (see src/features/scan/fields.ts for how those get flattened).
export type AnalyzeDocumentResponse = {
  document_type: string;
  summary_arabic: string;
  fields: Array<Record<string, string>>;
  next_steps: string[];
  document_id: number;
};

// POST /api/document/analyze, multipart/form-data with a single "file" part
// (the captured photo). `text` and `session_id` are optional per the Swagger
// and are intentionally omitted.
//
// NOTE: /api/documents/upload also exists but only returns
// {doc_id, status, message} with no analysis — using it here would upload
// the same image twice for no benefit, so this screen calls /analyze only.
export async function analyzeDocument(photoUri: string): Promise<AnalyzeDocumentResponse> {
  const formData = new FormData();
  formData.append("file", {
    uri: photoUri,
    name: "document.jpg",
    type: "image/jpeg",
  } as unknown as Blob);

  try {
    const { data } = await apiClient.post<AnalyzeDocumentResponse>("/api/document/analyze", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}
