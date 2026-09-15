import React, { useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
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
import { useDocuments } from "@/store/documentsStore";
import { flattenAnalyzeFields } from "@/features/scan/fields";
import type { DocType } from "@/types/document";

type FlowState = "idle" | "captured" | "analyzing";

const PERMISSION_DENIED_MESSAGE_AR =
  "يحتاج التطبيق إلى إذن الكاميرا لالتقاط صورة المستند. يرجى المحاولة مرة أخرى.";
const PERMISSION_BLOCKED_MESSAGE_AR =
  "تم رفض إذن الكاميرا بشكل دائم. افتح إعدادات التطبيق وفعّل إذن الكاميرا يدويًا.";
const CAPTURE_FAILED_MESSAGE_AR = "تعذّر التقاط الصورة. يرجى المحاولة مرة أخرى.";
const ANALYZE_FAILED_FALLBACK_AR = "تعذّر تحليل المستند. يرجى المحاولة مرة أخرى.";
const ANALYZING_TEXT_AR = "بنقرا مستندك دلوقتي...";
const ANALYZING_SUBTEXT_AR = "ممكن ياخد شوية ثواني. هنقولك أول ما يخلص.";
const ANALYZING_ANNOUNCEMENT_AR = "جارٍ تحليل المستند، يرجى الانتظار";
const RETAKE_LABEL_AR = "أعد التصوير";
const CONFIRM_LABEL_AR = "تأكيد وتحليل";
const OPEN_SETTINGS_LABEL_AR = "فتح الإعدادات";
const CAPTURE_LABEL_AR = "صوّر المستند";
const FRAME_HINT_AR = "وجّه الكاميرا نحو المستند";
const GALLERY_PICK_LABEL_AR = "اختيار صورة من المعرض";

export default function CameraScreen() {
  const router = useRouter();
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeDocumentResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  const screenReaderEnabled = useScreenReaderEnabled();
  const { speak, speakingId } = useTtsPlayer({
    onError: (message) => {
      setErrorMessage(message);
      if (screenReaderEnabled) AccessibilityInfo.announceForAccessibility(message);
    },
  });

  const capturePhoto = async () => {
    setErrorMessage(null);
    if (Platform.OS === "web") {
      await pickFromGallery();
      return;
    }

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
      setSelectedFile(null);
      setPhotoUri(result.assets[0].uri);
      setAnalyzeResult(null);
      setFlowState("captured");
    } catch {
      setErrorMessage(CAPTURE_FAILED_MESSAGE_AR);
    }
  };

  const pickFromGallery = async () => {
    setErrorMessage(null);
    if (Platform.OS === "web") {
      try {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*,application/pdf,.pdf";
        input.onchange = () => {
          const file = input.files?.[0];
          if (file) {
            setSelectedFile(file);
            setPhotoUri(URL.createObjectURL(file));
            setAnalyzeResult(null);
            setFlowState("captured");
          }
        };
        input.click();
        return;
      } catch {
        setErrorMessage(CAPTURE_FAILED_MESSAGE_AR);
        return;
      }
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorMessage(permission.canAskAgain ? PERMISSION_DENIED_MESSAGE_AR : PERMISSION_BLOCKED_MESSAGE_AR);
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      setSelectedFile(null);
      setPhotoUri(result.assets[0].uri);
      setAnalyzeResult(null);
      setFlowState("captured");
    } catch {
      setErrorMessage(CAPTURE_FAILED_MESSAGE_AR);
    }
  };

  const { addDocument, refreshDocuments } = useDocuments();

  const confirmAndAnalyze = async () => {
    if (!photoUri) return;
    setErrorMessage(null);
    setFlowState("analyzing");
    if (Platform.OS !== "web") {
      AccessibilityInfo.announceForAccessibility(ANALYZING_ANNOUNCEMENT_AR);
    }

    try {
      const result = await analyzeDocument(photoUri, selectedFile);
      setAnalyzeResult(result);
      
      const extractedFields = flattenAnalyzeFields(result.fields);
      const getField = (keys: string[]) => extractedFields.find(f => keys.includes(f.label))?.value;
      
      const dt = (result.document_type || "").toLowerCase();
      let docTypeMapped: DocType = "unknown";
      if (dt.includes("national_id") || dt.includes("قومي")) docTypeMapped = "national_id";
      else if (dt.includes("driving_license") || dt.includes("قيادة") || dt.includes("تسيير") || dt.includes("مرور")) docTypeMapped = "driving_license";
      else if (dt.includes("passport") || dt.includes("جواز")) docTypeMapped = "passport";
      else if (dt.includes("birth_certificate") || dt.includes("ميلاد")) docTypeMapped = "birth_certificate";
      else if (dt.includes("utility_bill") || dt.includes("مرافق") || dt.includes("كهرباء") || dt.includes("مياه")) docTypeMapped = "utility_bill";
      else if (dt.includes("receipt") || dt.includes("إيصال")) docTypeMapped = "receipt";
      else if (dt.includes("invoice") || dt.includes("فاتورة")) docTypeMapped = "invoice";

      addDocument({
        id: result.document_id || Date.now(),
        status: "done",
        doc_type: docTypeMapped,
        ai_summary: result.summary_arabic,
        ocr_text: "",
        entities: {
          name: getField(["name", "الاسم"]),
          address: getField(["address", "العنوان", "address-gov"]),
          governorate: getField(["governorate", "المحافظة"]),
          national_number: getField(["national_number", "national-number", "الرقم القومي"]),
        },
        dates: getField(["dates"]) ? [getField(["dates"])!] : [],
        amounts: getField(["amount"]) ? [getField(["amount"])!] : [],
        expiry_date: getField(["expiry_date", "expiry"]) ?? null,
        tags: ["scanned"],
        image_url: photoUri,
        created_at: new Date().toISOString(),
      });

      refreshDocuments();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.friendlyMessageAr : ANALYZE_FAILED_FALLBACK_AR);
    } finally {
      setFlowState("captured");
    }
  };

  const rows = analyzeResult ? buildScanResultRows(analyzeResult) : [];

  if (flowState === "analyzing") {
    return (
      <View
        role="status"
        accessibilityLiveRegion="polite"
        className="flex-1 items-center justify-center gap-6 bg-[#101014] px-8"
      >
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text className="font-cairoExtraBold text-center text-xl text-white">{ANALYZING_TEXT_AR}</Text>
        <Text className="font-plex max-w-[260px] text-center text-base leading-7 text-white/60">
          {ANALYZING_SUBTEXT_AR}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#101014]">
      <View className="flex-row-reverse items-center justify-between px-4 pt-4">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="إغلاق الكاميرا"
          className="h-11 w-11 items-center justify-center rounded-full bg-white/15 active:opacity-80"
        >
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </Pressable>
        {flowState === "idle" ? (
          <View className="rounded-full bg-white/15 px-3.5 py-2">
            <Text className="font-plexBold text-sm text-white">{FRAME_HINT_AR}</Text>
          </View>
        ) : (
          <View className="w-11" />
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40, gap: 20, flexGrow: 1 }}>
        <CameraPreviewPlaceholder photoUri={photoUri} />

        {errorMessage ? (
          <View className="rounded-card border-2 border-red-500 bg-red-950/40 px-4 py-3">
            <Text className="text-right text-lg font-bold text-red-300">{errorMessage}</Text>
            {permissionBlocked ? (
              <Pressable
                onPress={() => Linking.openSettings()}
                accessibilityRole="button"
                accessibilityLabel={OPEN_SETTINGS_LABEL_AR}
                className="mt-3 min-h-[56px] items-center justify-center rounded-full bg-primary px-6 py-3 active:opacity-80"
              >
                <Text className="font-plexBold text-lg text-white">{OPEN_SETTINGS_LABEL_AR}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View className="flex-1" />

        {flowState === "idle" ? (
          <View className="items-center gap-4">
            <Pressable
              onPress={pickFromGallery}
              accessibilityRole="button"
              accessibilityLabel={GALLERY_PICK_LABEL_AR}
            >
              <Text className="font-plex text-sm text-white underline">{GALLERY_PICK_LABEL_AR}</Text>
            </Pressable>
            <Pressable
              onPress={capturePhoto}
              accessibilityRole="button"
              accessibilityLabel={CAPTURE_LABEL_AR}
              className="h-[88px] w-[88px] items-center justify-center rounded-full border-[6px] border-white/35 bg-white active:opacity-80"
            />
            <Text className="font-plex text-xs text-white/60">اضغط للتصوير</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Pressable
              onPress={confirmAndAnalyze}
              accessibilityRole="button"
              accessibilityLabel={CONFIRM_LABEL_AR}
              className="min-h-[64px] w-full flex-row-reverse items-center justify-center gap-3 rounded-card bg-primary px-6 py-5 active:opacity-80"
            >
              <Ionicons name="checkmark-circle" size={28} color="#FFFFFF" />
              <Text className="font-cairoExtraBold text-2xl text-white">{CONFIRM_LABEL_AR}</Text>
            </Pressable>
            <Pressable
              onPress={capturePhoto}
              accessibilityRole="button"
              accessibilityLabel={RETAKE_LABEL_AR}
              className="min-h-[64px] w-full flex-row-reverse items-center justify-center gap-3 rounded-card border-2 border-white/30 bg-transparent px-6 py-5 active:opacity-80"
            >
              <Ionicons name="camera-reverse" size={28} color="#FFFFFF" />
              <Text className="font-cairoExtraBold text-2xl text-white">{RETAKE_LABEL_AR}</Text>
            </Pressable>
          </View>
        )}

        {rows.length > 0 ? (
          <View>
            <Text className="font-plexBold mb-2 text-right text-lg text-white">يستخرج تلقائياً</Text>
            <View className="rounded-card border-2 border-white/15 bg-white px-4">
              {rows.map((row, index) => (
                <ExtractRow
                  key={row.id}
                  label={row.label}
                  value={row.value}
                  showDivider={index < rows.length - 1}
                  isSpeaking={speakingId === row.id}
                  onSpeakerPress={() => {
                    void speak(row.value, row.id);
                  }}
                  speakerAccessibilityLabel={`استمع إلى ${row.label}`}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
