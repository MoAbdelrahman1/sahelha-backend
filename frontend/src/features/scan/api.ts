import { apiClient } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";
import { Platform } from "react-native";

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
export async function analyzeDocument(photoUri: string, webFile?: File | null): Promise<AnalyzeDocumentResponse> {
  const formData = new FormData();
  
  if (Platform.OS === "web" && webFile) {
    formData.append("file", webFile);
  } else if (Platform.OS === "web" && photoUri.startsWith("blob:")) {
    const res = await fetch(photoUri);
    const blob = await res.blob();
    formData.append("file", blob, "document.jpg");
  } else {
    formData.append("file", {
      uri: photoUri,
      name: "document.jpg",
      type: "image/jpeg",
    } as unknown as Blob);
  }

  try {
    // Override the default 15s timeout because the OCR+LLM pipeline is heavy
    const { data } = await apiClient.post<AnalyzeDocumentResponse>("/api/document/analyze", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000, 
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
