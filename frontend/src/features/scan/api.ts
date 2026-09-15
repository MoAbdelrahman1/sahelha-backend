import { apiClient } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";
import { Platform } from "react-native";

export type AnalyzeDocumentResponse = {
  document_type: string;
  summary_arabic: string;
  fields: Array<Record<string, string>>;
  next_steps: string[];
  document_id: number;
};

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
    const { data } = await apiClient.post<AnalyzeDocumentResponse>("/api/document/analyze", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 180000, // 3 minutes to accommodate local Ollama/OCR model inference
    });
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}

export type SpeakTextResponse = { audio_url: string };

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
