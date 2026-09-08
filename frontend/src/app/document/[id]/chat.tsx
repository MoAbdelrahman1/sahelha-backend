import React, { useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { AppHeader } from "@/components/ui/AppHeader";
import { useAppearance } from "@/store/appearanceStore";
import { useDocuments } from "@/store/documentsStore";
import { useToast } from "@/store/toastStore";
import { palette } from "@/styles/theme";
import { CHAT_SEED } from "@/features/documents/demoData";
import { DOC_TYPE_LABELS } from "@/types/document";

type Message = { from: "assistant" | "user"; text: string };

const DEMO_REPLY = "تمام، هحاول أساعدك في ده. تقدر كمان تسمع الرد بالصوت من زر الاستماع.";

// The emotional core of the product — a conversation, not a form. Chat-bubble
// layout with every bubble also announced/playable as audio (per the brief);
// press-and-hold recording is the primary input path, typing is the
// secondary one. Demo conversation only for this pass — the real backend call
// is POST /api/ai/ask, scoped to this document_id.
export default function DocumentChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { highContrast, haptics } = useAppearance();
  const { getDocument } = useDocuments();
  const { showToast } = useToast();
  const c = palette(highContrast);
  const docId = Number(id);
  const doc = getDocument(docId);
  const typeLabel = doc?.doc_type ? DOC_TYPE_LABELS[doc.doc_type] : "المستند";

  const [messages, setMessages] = useState<Message[]>(
    CHAT_SEED[docId] ?? [{ from: "assistant", text: "أهلاً، اسألني أي سؤال عن المستند ده." }]
  );
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [typing, setTyping] = useState(false);

  const respondTo = (userText: string) => {
    setMessages((m) => [...m, { from: "user", text: userText }]);
    setTyping(true);
    setTimeout(() => {
      setMessages((m) => [...m, { from: "assistant", text: DEMO_REPLY }]);
      setTyping(false);
    }, 1100);
  };

  const sendText = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    respondTo(text);
  };

  const toggleRecording = () => {
    if (recording) {
      setRecording(false);
      return;
    }
    setRecording(true);
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    AccessibilityInfo.announceForAccessibility("بدأ التسجيل");
    setTimeout(() => {
      setRecording(false);
      if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      respondTo("وده صادر منين؟");
    }, 1300);
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
                  maxWidth: "78%",
                  gap: 6,
                  padding: 12,
                  paddingHorizontal: 14,
                  borderRadius: 16,
                  backgroundColor: isUser ? c.primaryBg : c.surface,
                  borderWidth: isUser ? 0 : 1,
                  borderColor: c.border,
                }}
              >
                <Text
                  style={{
                    fontFamily: "IBMPlexSansArabic_600SemiBold",
                    fontSize: 15,
                    lineHeight: 24,
                    color: isUser ? c.primaryFg : c.ink,
                    textAlign: "right",
                  }}
                >
                  {m.text}
                </Text>
                <Pressable onPress={() => showToast("جاري تشغيل الرد صوتيًا")} accessibilityRole="button" accessibilityLabel="استماع">
                  <Text
                    style={{
                      fontFamily: "IBMPlexSansArabic_700Bold",
                      fontSize: 12,
                      color: isUser ? c.primaryFg : c.ink,
                      textDecorationLine: "underline",
                    }}
                  >
                    ▶ استماع
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
        {typing ? (
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
              <Text style={{ fontFamily: "IBMPlexSansArabic_400Regular", fontSize: 14, color: c.secondary }}>
                بيرد دلوقتي...
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ padding: 18, borderTopWidth: 1, borderTopColor: c.border, alignItems: "center", gap: 12 }}>
        <Pressable
          onPress={toggleRecording}
          accessibilityRole="button"
          accessibilityLabel={recording ? "إيقاف التسجيل" : "ابدأ التسجيل الصوتي"}
          style={{
            width: 76,
            height: 76,
            borderRadius: 38,
            backgroundColor: recording ? "#B3261E" : c.primaryBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="mic" size={30} color="#FFFFFF" />
        </Pressable>
        <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 13, color: c.secondary }}>
          {recording ? "بيسجل... اضغط تاني للإيقاف" : "اضغط وسجّل سؤالك"}
        </Text>
        <View style={{ flexDirection: "row-reverse", gap: 8, width: "100%" }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="أو اكتب سؤالك هنا..."
            placeholderTextColor={c.secondary}
            accessibilityLabel="اكتب سؤالك"
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: c.border,
              backgroundColor: c.surface,
              color: c.ink,
              fontFamily: "IBMPlexSansArabic_400Regular",
              fontSize: 15,
              textAlign: "right",
            }}
          />
          <Pressable
            onPress={sendText}
            accessibilityRole="button"
            accessibilityLabel="إرسال"
            style={{ paddingHorizontal: 18, borderRadius: 12, backgroundColor: c.primaryBg, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 14, color: c.primaryFg }}>إرسال</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
