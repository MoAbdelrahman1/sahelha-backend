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

// Shape returned by GET /api/documents — one entry per saved document.
export type ScannedDocument = {
  id: number;
  doc_type: string | null;
  ai_summary: string;
  created_at: string;
  image_url: string | null;
  status: string;
};

// POST /api/document/analyze, multipart/form-data with a single "file" part
// (the captured photo). `text` and `session_id` are optional per the Swagger
// and are intentionally omitted.
export async function analyzeDocument(
  photoUri: string,
  webFile?: File | null
): Promise<AnalyzeDocumentResponse> {
  const formData = new FormData();

  if (Platform.OS === "web") {
    if (webFile) {
      formData.append("file", webFile, webFile.name || "document.jpg");
    } else {
      try {
        const response = await fetch(photoUri);
        const blob = await response.blob();
        formData.append("file", blob, "document.jpg");
      } catch (err) {
        console.error("[ANALYZE FETCH BLOB ERROR]", err);
        if (photoUri.startsWith("data:")) {
          const arr = photoUri.split(",");
          const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          const blob = new Blob([u8arr], { type: mime });
          formData.append("file", blob, "document.jpg");
        } else {
          formData.append("file", photoUri);
        }
      }
    }
  } else {
    formData.append("file", {
      uri: photoUri,
      name: "document.jpg",
      type: "image/jpeg",
    } as unknown as Blob);
  }

  try {
    const { data } = await apiClient.post<AnalyzeDocumentResponse>(
      "/api/document/analyze",
      formData,
      {
        timeout: 120000,
        headers: Platform.OS === "web" ? undefined : { "Content-Type": "multipart/form-data" },
      }
    );
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

// GET /api/documents — returns all documents saved by the current user,
// newest first. Returns [] if the backend is unreachable.
export async function fetchDocuments(): Promise<ScannedDocument[]> {
  try {
    const { data } = await apiClient.get<ScannedDocument[]>("/api/documents");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
