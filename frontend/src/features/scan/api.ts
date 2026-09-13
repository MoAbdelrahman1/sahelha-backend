import { Platform } from "react-native";

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
  if (Platform.OS === "web") {
    // The RN `{uri, name, type}` FormData part below only works on
    // Android/iOS, where the native networking layer streams the file from
    // that URI. A real browser's FormData just stringifies that object into
    // a text field, so the backend's `file: UploadFile` sees a string, not a
    // file part, and 422s. Fetch the picked blob: URI into a real Blob so
    // this also works under `expo start --web`.
    const blob = await (await fetch(photoUri)).blob();
    formData.append("file", blob, "document.jpg");
  } else {
    formData.append("file", {
      uri: photoUri,
      name: "document.jpg",
      type: "image/jpeg",
    } as unknown as Blob);
  }

  try {
    const { data } = await apiClient.post<AnalyzeDocumentResponse>("/api/document/analyze", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}

export type SpeakTextResponse = { audio_url: string };

// POST /api/voice/tts — see docs/API.md. Auth required: the shared
// `apiClient` request interceptor attaches the bearer token automatically,
// so this must go through `apiClient` and never a raw client.
export async function speakText(text: string): Promise<SpeakTextResponse> {
  try {
    const { data } = await apiClient.post<SpeakTextResponse>("/api/voice/tts", {
      text,
      language: "ar",
    });
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}
