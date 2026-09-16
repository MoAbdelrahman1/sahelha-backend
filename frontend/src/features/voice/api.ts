import { Platform } from "react-native";
import { apiClient } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";

export type VoiceTranscribeResponse = {
  transcript: string;
  language: string;
};

export type VoiceSynthesizeResponse = {
  audio_url: string;
};

export type AiAskResponse = {
  session_id: string;
  question: string;
  answer: string;
  answer_audio_url?: string | null;
  service_id?: string | null;
  service_title?: string | null;
};

async function createFormFile(uri: string, defaultName: string = "recording.m4a"): Promise<any> {
  if (Platform.OS === "web") {
    try {
      const res = await fetch(uri);
      const blob = await res.blob();
      const rawType = blob.type || "audio/webm";
      let ext = ".webm";
      if (rawType.includes("wav")) ext = ".wav";
      else if (rawType.includes("mp4") || rawType.includes("m4a")) ext = ".m4a";
      else if (rawType.includes("mp3") || rawType.includes("mpeg")) ext = ".mp3";
      else if (rawType.includes("ogg")) ext = ".ogg";
      else if (rawType.includes("webm")) ext = ".webm";

      const finalName = `recording_${Date.now()}${ext}`;
      return new File([blob], finalName, { type: rawType });
    } catch {
      // Fallback if fetch fails
    }
  }

  const filename = uri.split("/").pop() || defaultName;
  const mimeType = filename.endsWith(".wav")
    ? "audio/wav"
    : filename.endsWith(".mp3")
    ? "audio/mp3"
    : filename.endsWith(".webm")
    ? "audio/webm"
    : "audio/m4a";

  return {
    uri,
    name: filename,
    type: mimeType,
  };
}

/**
 * Send recorded audio file to POST /api/voice/stt for Arabic transcription.
 */
export async function transcribeAudio(audioUri: string, fieldType?: string): Promise<VoiceTranscribeResponse> {
  const formData = new FormData();
  const fileObj = await createFormFile(audioUri, "recording.m4a");
  formData.append("file", fileObj);
  if (fieldType) {
    formData.append("field_type", fieldType);
  }

  try {
    const { data } = await apiClient.post<VoiceTranscribeResponse>("/api/voice/stt", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}

/**
 * Send audio or text to POST /api/ai/ask for multi-turn AI Voice Q&A.
 */
export async function askAiVoice(params: {
  documentId?: number | null;
  sessionId?: string | null;
  question?: string;
  audioUri?: string;
}): Promise<AiAskResponse> {
  const formData = new FormData();

  if (params.documentId) {
    formData.append("document_id", String(params.documentId));
  }
  if (params.sessionId) {
    formData.append("session_id", params.sessionId);
  }
  if (params.question) {
    formData.append("question", params.question);
  }
  if (params.audioUri) {
    const fileObj = await createFormFile(params.audioUri, "user_question.m4a");
    formData.append("audio", fileObj);
  }

  try {
    const { data } = await apiClient.post<AiAskResponse>("/api/ai/ask", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      // Voice requests add a server-side transcription step (Groq Whisper, with a
      // slower local fallback) on top of the LLM answer + TTS, so they routinely
      // exceed the default API timeout that text-only asks comfortably meet.
      timeout: params.audioUri ? 60000 : undefined,
    });
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}
