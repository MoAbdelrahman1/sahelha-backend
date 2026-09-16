import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { AppHeader } from "@/components/ui/AppHeader";
import { useAppearance } from "@/store/appearanceStore";
import { useDocuments } from "@/store/documentsStore";
import { useToast } from "@/store/toastStore";
import { palette } from "@/styles/theme";
import { CHAT_SEED } from "@/features/documents/demoData";
import { DOC_TYPE_LABELS, type Document } from "@/types/document";
import { apiClient } from "@/lib/api/client";
import { askAiVoice, transcribeAudio } from "@/features/voice/api";
import { useAudioRecorderHook } from "@/features/voice/useAudioRecorder";
import { stopGlobalTts, useTtsPlayer } from "@/features/voice/useTtsPlayer";

type Message = { from: "assistant" | "user"; text: string };

export default function DocumentChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { highContrast, haptics } = useAppearance();
  const { getDocument, addDocument } = useDocuments();
  const { showToast } = useToast();
  const c = palette(highContrast);
  const docId = Number(id);

  const contextDoc = getDocument(docId);
  const [fetchedDoc, setFetchedDoc] = useState<Document | null>(null);

  const recorder = useAudioRecorderHook();
  const tts = useTtsPlayer();

  useEffect(() => {
    if (!contextDoc && docId) {
      let isMounted = true;
      (async () => {
        try {
          const { data } = await apiClient.get<Document>(`/api/documents/${docId}`);
          if (data && isMounted) {
            setFetchedDoc(data);
            addDocument(data);
          }
        } catch (e) {
          console.warn("[DOCUMENT CHAT] fetch failed for id", docId, e);
        }
      })();
      return () => { isMounted = false; };
    }
  }, [docId, contextDoc, addDocument]);

  const doc = contextDoc || fetchedDoc;
  const typeLabel = doc?.doc_type ? DOC_TYPE_LABELS[doc.doc_type] : "المستند";

  const [messages, setMessages] = useState<Message[]>(
    CHAT_SEED[docId] ?? [
      { from: "assistant", text: `أهلاً بك، أنا المساعد الذكي. اسألني أي سؤال عن (${typeLabel}) وسأجيبك فورياً.` },
    ]
  );
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  // Send question text to backend AI ask endpoint with 7s timeout & local fallback
  const processQuestion = async (userQuestion: string) => {
    if (!userQuestion.trim()) return;

    tts.stopCurrent();
    setMessages((m) => [...m, { from: "user", text: userQuestion }]);
    setTyping(true);

    try {
      // 7-second timeout for AI voice ask call so UI never hangs indefinitely
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AI_TIMEOUT")), 7000)
      );

      const res = await Promise.race([
        askAiVoice({
          documentId: docId,
          question: userQuestion,
        }),
        timeoutPromise,
      ]);

      const aiAnswer = res.answer || "عذراً، لم أتمكن من الحصول على إجابة دقيقة من المستند.";
      setMessages((m) => [...m, { from: "assistant", text: aiAnswer }]);
      tts.speakTextContent(aiAnswer, `ai-reply-${Date.now()}`);
    } catch (err) {
      // Smart Fallback AI answer based on local document text and extracted metadata
      let fallbackAnswer = "";
      if (doc?.ai_summary) {
        fallbackAnswer = `بناءً على معلومات هذا المستند: ${doc.ai_summary}`;
      } else if (doc?.entities && Object.keys(doc.entities).length > 0) {
        const details = Object.entries(doc.entities)
          .filter(([_, v]) => Boolean(v))
          .map(([k, v]) => `${k}: ${v}`)
          .join("، ");
        fallbackAnswer = `إليك تفاصيل المستند المتاحة: ${details}`;
      } else {
        fallbackAnswer = `مستندك من نوع (${typeLabel}). يمكنك الاستفسار عن تفاصيله أو إعادة المحاولة.`;
      }
      setMessages((m) => [...m, { from: "assistant", text: fallbackAnswer }]);
      tts.speakTextContent(fallbackAnswer, `ai-fallback-${Date.now()}`);
    } finally {
      setTyping(false);
    }
  };

  const sendText = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    processQuestion(text);
  };

  // Toggle real voice recording
  const handleToggleRecording = async () => {
    tts.stopCurrent();
    if (recorder.isRecording) {
      if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setTranscribing(true);

      try {
        const audioUri = await recorder.stopRecording();
        if (!audioUri) {
          showToast("لم يتم التقاط أي صوت، حاول مجدداً.");
          setTranscribing(false);
          return;
        }

        // Transcribe real audio with Whisper (or timeout after 6s)
        const transcribeTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("STT_TIMEOUT")), 6000)
        );

        const transcribeRes = await Promise.race([
          transcribeAudio(audioUri, "text"),
          transcribeTimeout,
        ]);

        const spokenText = transcribeRes.transcript?.trim() || "";

        // Immediately clear transcribing state before starting AI processing
        setTranscribing(false);

        if (spokenText) {
          await processQuestion(spokenText);
        } else {
          showToast("لم نتمكن من إملاء صوتك بوضوح، يرجى المحاولة مرة أخرى.");
        }
      } catch (err) {
        setTranscribing(false);
        showToast("حدث خطأ أو تأخر في معالجة الصوت، يمكنك كتابة سؤالك نصياً.");
      }
    } else {
      if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const ok = await recorder.startRecording();
      if (!ok) {
        showToast("تعذر الوصول للميكروفون، يرجى التأكد من الأذونات.");
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.pageBg }}>
      <AppHeader title={`اسأل عن: ${typeLabel}`} showBack />

      <ScrollView contentContainerStyle={{ padding: 18, gap: 12, flexGrow: 1 }}>
        {messages.map((m, i) => {
          const isUser = m.from === "user";
          return (
            <View key={i} style={{ flexDirection: "row", justifyContent: isUser ? "flex-start" : "flex-end" }}>
              <View
                style={{
                  maxWidth: "85%",
                  gap: 6,
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: isUser ? c.primaryBg : c.surface,
                  borderWidth: isUser ? 0 : 1.5,
                  borderColor: c.border,
                }}
              >
                <Text
                  style={{
                    fontFamily: "IBMPlexSansArabic_600SemiBold",
                    fontSize: 16,
                    lineHeight: 26,
                    color: isUser ? c.primaryFg : c.ink,
                    textAlign: "right",
                  }}
                >
                  {m.text}
                </Text>

                <Pressable
                  onPress={() => tts.speakTextContent(m.text, `msg-${i}`)}
                  accessibilityRole="button"
                  accessibilityLabel="استماع"
                  style={{ alignSelf: "flex-end", marginTop: 2 }}
                >
                  <Text
                    style={{
                      fontFamily: "IBMPlexSansArabic_700Bold",
                      fontSize: 12.5,
                      color: isUser ? c.primaryFg : c.primaryBg,
                      textDecorationLine: "underline",
                    }}
                  >
                    ▶ استماع بالصوت
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {transcribing ? (
          <View style={{ flexDirection: "row", justifyContent: "flex-start" }}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FDE68A", flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
              <ActivityIndicator color="#B45309" size="small" />
              <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 14, color: "#B45309" }}>
                جارٍ تحويل صوتك إلى نص عبر Whisper…
              </Text>
            </View>
          </View>
        ) : null}

        {typing ? (
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border, flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
              <ActivityIndicator color={c.primaryBg} size="small" />
              <Text style={{ fontFamily: "IBMPlexSansArabic_600SemiBold", fontSize: 14, color: c.secondary }}>
                الذكاء الاصطناعي يجيب الآن…
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Mic & Text Input Controls */}
      <View style={{ padding: 18, borderTopWidth: 1, borderTopColor: c.border, alignItems: "center", gap: 12, backgroundColor: c.cardBg }}>
        <Pressable
          onPress={handleToggleRecording}
          disabled={transcribing}
          accessibilityRole="button"
          accessibilityLabel={recorder.isRecording ? "إيقاف التسجيل وتفريغ الصوت" : "اضغط لبدء تسجيل سؤالك بصوتك"}
          style={{
            minHeight: 64,
            width: "100%",
            flexDirection: "row-reverse",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            borderRadius: 18,
            backgroundColor: recorder.isRecording ? "#DC2626" : c.primaryBg,
            shadowColor: recorder.isRecording ? "#DC2626" : c.primaryBg,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 6,
            elevation: 3,
          }}
        >
          <Ionicons name={recorder.isRecording ? "stop-circle" : "mic"} size={28} color="#FFFFFF" />
          <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 18, color: "#FFFFFF" }}>
            {recorder.isRecording ? "جارٍ الاستماع لسؤالك... اضغط للإنهاء ⏹️" : "🎙️ اضغط وتحدث بسؤالك بصوتك"}
          </Text>
        </Pressable>

        {/* Text fallback input */}
        <View style={{ flexDirection: "row-reverse", gap: 8, width: "100%" }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={sendText}
            placeholder="أو اكتب سؤالك هنا..."
            placeholderTextColor={c.secondary}
            accessibilityLabel="اكتب سؤالك"
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: c.border,
              backgroundColor: c.surface,
              color: c.ink,
              fontFamily: "IBMPlexSansArabic_600SemiBold",
              fontSize: 15,
              textAlign: "right",
            }}
          />
          <Pressable
            onPress={sendText}
            accessibilityRole="button"
            accessibilityLabel="إرسال"
            style={{ paddingHorizontal: 20, borderRadius: 14, backgroundColor: c.primaryBg, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 15, color: c.primaryFg }}>إرسال</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
