import { useCallback, useState } from "react";
import { askAiVoice } from "@/features/voice/api";
import { useAudioRecorderHook } from "@/features/voice/useAudioRecorder";
import { useTtsPlayer } from "@/features/voice/useTtsPlayer";
import { ApiError } from "@/lib/api/errors";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  audioUrl?: string;
  serviceId?: string;
  serviceTitle?: string;
  timestamp: Date;
};

export type AssistantState = "idle" | "recording" | "thinking" | "speaking" | "error";

export function useVoiceAssistant(initialDocumentId?: number | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      role: "assistant",
      text: "أهلاً بك! أنا سهلها عليا. يمكنك التحدث معي بصوتك أو كتابة استفسارك في أي وقت لمساعدتك.",
      timestamp: new Date(),
    },
  ]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<number | null>(initialDocumentId ?? null);
  const [assistantState, setAssistantState] = useState<AssistantState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recorder = useAudioRecorderHook();
  const ttsPlayer = useTtsPlayer({
    onError: (msg) => {
      setErrorMessage(msg);
      setAssistantState("idle");
    },
  });

  const startListening = useCallback(async () => {
    setErrorMessage(null);
    ttsPlayer.stopCurrent();
    const ok = await recorder.startRecording();
    if (ok) {
      setAssistantState("recording");
    } else {
      setErrorMessage("تعذر الوصول إلى الميكروفون. يرجى التحقق من الأذونات.");
      setAssistantState("error");
    }
  }, [recorder, ttsPlayer]);

  const stopListeningAndAsk = useCallback(async () => {
    if (!recorder.isRecording) return;
    setAssistantState("thinking");

    const audioUri = await recorder.stopRecording();
    if (!audioUri) {
      setErrorMessage("لم يتم التقاط أي تسجيل صوتي.");
      setAssistantState("idle");
      return;
    }

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), 8000)
      );

      const res = await Promise.race([
        askAiVoice({
          documentId,
          sessionId,
          audioUri,
        }),
        timeoutPromise,
      ]);

      setSessionId(res.session_id);

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: res.question || "سؤال صوتي",
        timestamp: new Date(),
      };

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        text: res.answer || "تمت إجابة طلبك.",
        audioUrl: res.answer_audio_url || undefined,
        serviceId: res.service_id || undefined,
        serviceTitle: res.service_title || undefined,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg, aiMsg]);
      setAssistantState("idle");
    } catch (error) {
      const friendlyErr = error instanceof ApiError ? error.friendlyMessageAr : "حدث خطأ أو تأخر في الاتصال بالمساعد، يرجى المحاولة مرة أخرى.";
      setErrorMessage(friendlyErr);
      setAssistantState("error");
    }
  }, [documentId, recorder, sessionId]);

  const sendTextMessage = useCallback(
    async (questionText: string) => {
      if (!questionText || !questionText.trim()) return;
      setErrorMessage(null);
      ttsPlayer.stopCurrent();
      setAssistantState("thinking");

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: questionText.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);

      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT")), 8000)
        );

        const res = await Promise.race([
          askAiVoice({
            documentId,
            sessionId,
            question: questionText.trim(),
          }),
          timeoutPromise,
        ]);

        setSessionId(res.session_id);

        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          text: res.answer || "تمت الإجابة على سؤالك.",
          audioUrl: res.answer_audio_url || undefined,
          serviceId: res.service_id || undefined,
          serviceTitle: res.service_title || undefined,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiMsg]);
        setAssistantState("idle");
      } catch (error) {
        const friendlyErr = error instanceof ApiError ? error.friendlyMessageAr : "تعذّر الوصول إلى سيرفر الذكاء الاصطناعي حالياً.";
        setErrorMessage(friendlyErr);
        setAssistantState("error");
      }
    },
    [documentId, sessionId, ttsPlayer]
  );

  const replayMessageAudio = useCallback(
    async (msg: ChatMessage) => {
      setErrorMessage(null);
      if (msg.audioUrl) {
        setAssistantState("speaking");
        await ttsPlayer.playAudioUrl(msg.audioUrl, msg.id);
        setAssistantState("idle");
      } else {
        setAssistantState("speaking");
        await ttsPlayer.speakTextContent(msg.text, msg.id);
        setAssistantState("idle");
      }
    },
    [ttsPlayer]
  );

  const cancelRecording = useCallback(async () => {
    await recorder.cancelRecording();
    setAssistantState("idle");
  }, [recorder]);

  return {
    messages,
    sessionId,
    documentId,
    setDocumentId,
    assistantState,
    errorMessage,
    durationMillis: recorder.durationMillis,
    speakingId: ttsPlayer.speakingId,
    startListening,
    stopListeningAndAsk,
    cancelRecording,
    sendTextMessage,
    replayMessageAudio,
  };
}
