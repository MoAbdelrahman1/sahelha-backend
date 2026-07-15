import React, { useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { CameraPreviewPlaceholder } from "@/features/scan/components/CameraPreviewPlaceholder";
import { ExtractRow } from "@/features/scan/components/ExtractRow";
import { analyzeDocument, type AnalyzeDocumentResponse } from "@/features/scan/api";
import { buildScanResultRows } from "@/features/scan/resultRows";
import { useTtsPlayer } from "@/features/scan/useTtsPlayer";
import { useScreenReaderEnabled } from "@/features/scan/useScreenReaderEnabled";
import { ApiError } from "@/lib/api/errors";

// Feature 1 — مسح المستندات الذكي. Flow: capture with the SYSTEM camera
// (expo-image-picker's launchCameraAsync) -> confirm -> POST
// /api/document/analyze -> populate the result rows. Deliberately no
// expo-camera / live viewfinder: a live preview is not useful to a blind
// user, and the system camera already ships with Android's own
// accessibility support.
//
// RTL note: hand-mirrored (row-reverse containers + right-aligned text) like
// the rest of the app, not via I18nManager.

type FlowState = "idle" | "captured" | "analyzing";

// TODO(Asma): confirm final Arabic copy for every string below.
const PERMISSION_DENIED_MESSAGE_AR =
  "يحتاج التطبيق إلى إذن الكاميرا لالتقاط صورة المستند. يرجى المحاولة مرة أخرى.";
const PERMISSION_BLOCKED_MESSAGE_AR =
  "تم رفض إذن الكاميرا بشكل دائم. افتح إعدادات التطبيق وفعّل إذن الكاميرا يدويًا.";
const CAPTURE_FAILED_MESSAGE_AR = "تعذّر التقاط الصورة. يرجى المحاولة مرة أخرى.";
const ANALYZE_FAILED_FALLBACK_AR = "تعذّر تحليل المستند. يرجى المحاولة مرة أخرى.";
const ANALYZING_TEXT_AR = "جارٍ تحليل المستند…";
const ANALYZING_ANNOUNCEMENT_AR = "جارٍ تحليل المستند، يرجى الانتظار";
const RETAKE_LABEL_AR = "أعد التصوير";
const CONFIRM_LABEL_AR = "تأكيد وتحليل";
const OPEN_SETTINGS_LABEL_AR = "فتح الإعدادات";
const CAPTURE_LABEL_AR = "صوّر المستند";

export default function ScanScreen() {
  const router = useRouter();
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  // Kept for later use (not displayed this round) — the analyze response's
  // document_id, needed once follow-up features (archive, sharing, etc.)
  // exist. Storing the whole response is enough; nothing extra is needed.
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeDocumentResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  const screenReaderEnabled = useScreenReaderEnabled();
  const { speak, speakingId } = useTtsPlayer({
    onError: (message) => {
      setErrorMessage(message);
      // This announcement is TTS-failure copy, never the row text TTS was
      // about to speak, and only fires when TTS itself failed to start — so
      // it can never double up with TTS audio (see the mic handler below
      // for the matching anti-clash rule on the other side of this flow).
      if (screenReaderEnabled) AccessibilityInfo.announceForAccessibility(message);
    },
  });

  const capturePhoto = async () => {
    setErrorMessage(null);

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setPermissionBlocked(!permission.canAskAgain);
      setErrorMessage(permission.canAskAgain ? PERMISSION_DENIED_MESSAGE_AR : PERMISSION_BLOCKED_MESSAGE_AR);
      return;
    }
    setPermissionBlocked(false);

    try {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      setPhotoUri(result.assets[0].uri);
      setAnalyzeResult(null);
      setFlowState("captured");
    } catch {
      setErrorMessage(CAPTURE_FAILED_MESSAGE_AR);
    }
  };

  const confirmAndAnalyze = async () => {
    if (!photoUri) return;
    setErrorMessage(null);
    setFlowState("analyzing");
    AccessibilityInfo.announceForAccessibility(ANALYZING_ANNOUNCEMENT_AR);

    try {
      const result = await analyzeDocument(photoUri);
      setAnalyzeResult(result);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.friendlyMessageAr : ANALYZE_FAILED_FALLBACK_AR);
    } finally {
      setFlowState("captured");
    }
  };

  // Gated on a real, successful analyze response — no rows (not even
  // placeholder "—" rows) render during idle/captured/analyzing/error states.
  const rows = analyzeResult ? buildScanResultRows(analyzeResult) : [];

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 24 }}
    >
      <View className="flex-row-reverse items-center gap-4">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="رجوع"
          className="h-14 w-14 items-center justify-center rounded-full border-2 border-line bg-white active:opacity-80"
        >
          <Ionicons name="arrow-forward" size={26} color="#000000" />
        </Pressable>

        <View className="flex-1">
          <Text className="text-right text-3xl font-extrabold text-ink">
            تصوير المستندات وتلخيصها
          </Text>
          <Text className="mt-1 text-right text-lg font-bold text-ink">
            صوّر أي مستند واسمع أهم المعلومات فيه
          </Text>
        </View>
      </View>

      <CameraPreviewPlaceholder photoUri={photoUri} />

      {errorMessage ? (
        <View className="rounded-card border-2 border-red-600 bg-red-50 px-4 py-3">
          <Text className="text-right text-lg font-bold text-red-700">{errorMessage}</Text>
          {permissionBlocked ? (
            <Pressable
              onPress={() => Linking.openSettings()}
              accessibilityRole="button"
              accessibilityLabel={OPEN_SETTINGS_LABEL_AR}
              className="mt-3 min-h-[56px] items-center justify-center rounded-full bg-brandBlueDeep px-6 py-3 active:opacity-80"
            >
              <Text className="text-lg font-bold text-white">{OPEN_SETTINGS_LABEL_AR}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {flowState === "idle" ? (
        <Pressable
          onPress={capturePhoto}
          accessibilityRole="button"
          accessibilityLabel={CAPTURE_LABEL_AR}
          className="min-h-[64px] w-full flex-row-reverse items-center justify-center gap-3 rounded-card bg-brandBlueDeep px-6 py-5 active:opacity-80"
        >
          <Ionicons name="camera" size={28} color="#FFFFFF" />
          <Text className="text-2xl font-extrabold text-white">{CAPTURE_LABEL_AR}</Text>
        </Pressable>
      ) : flowState === "analyzing" ? (
        <View className="min-h-[64px] flex-row-reverse items-center justify-center gap-3 rounded-card border-2 border-line bg-soft px-6 py-5">
          <ActivityIndicator color="#2563EB" />
          <Text className="text-xl font-extrabold text-ink">{ANALYZING_TEXT_AR}</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Pressable
            onPress={confirmAndAnalyze}
            accessibilityRole="button"
            accessibilityLabel={CONFIRM_LABEL_AR}
            className="min-h-[64px] w-full flex-row-reverse items-center justify-center gap-3 rounded-card bg-brandBlueDeep px-6 py-5 active:opacity-80"
          >
            <Ionicons name="checkmark-circle" size={28} color="#FFFFFF" />
            <Text className="text-2xl font-extrabold text-white">{CONFIRM_LABEL_AR}</Text>
          </Pressable>
          <Pressable
            onPress={capturePhoto}
            accessibilityRole="button"
            accessibilityLabel={RETAKE_LABEL_AR}
            className="min-h-[64px] w-full flex-row-reverse items-center justify-center gap-3 rounded-card border-2 border-brandBlueDeep bg-white px-6 py-5 active:opacity-80"
          >
            <Ionicons name="camera-reverse" size={28} color="#1D4ED8" />
            <Text className="text-2xl font-extrabold text-brandBlueDeep">{RETAKE_LABEL_AR}</Text>
          </Pressable>
        </View>
      )}

      {rows.length > 0 ? (
        <View>
          <Text className="mb-2 text-right text-lg font-extrabold text-ink">يستخرج تلقائياً</Text>
          <View className="rounded-card border-2 border-line bg-white px-4">
            {rows.map((row, index) => (
              <ExtractRow
                key={row.id}
                label={row.label}
                value={row.value}
                showDivider={index < rows.length - 1}
                isSpeaking={speakingId === row.id}
                onSpeakerPress={() => {
                  // Anti-clash design: never call
                  // AccessibilityInfo.announceForAccessibility with this
                  // row's text here. TTS is about to speak this exact
                  // content out loud, and pairing that with a screen-reader
                  // announcement of the same text would produce two
                  // overlapping voices reading the same thing. TTS playback
                  // itself always starts on tap regardless of screen-reader
                  // state — only the announcement is what's being avoided.
                  void speak(row.value, row.id);
                }}
                speakerAccessibilityLabel={`استمع إلى ${row.label}`}
              />
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
