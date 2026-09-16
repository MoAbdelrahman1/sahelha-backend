import React, { useCallback, useEffect, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { CameraPreviewPlaceholder } from "@/features/scan/components/CameraPreviewPlaceholder";
import { ExtractRow } from "@/features/scan/components/ExtractRow";
import {
  analyzeDocument,
  fetchDocuments,
  type AnalyzeDocumentResponse,
  type ScannedDocument,
} from "@/features/scan/api";
import { buildScanResultRows } from "@/features/scan/resultRows";
import { useTtsPlayer } from "@/features/scan/useTtsPlayer";
import { useScreenReaderEnabled } from "@/features/scan/useScreenReaderEnabled";
import { ApiError } from "@/lib/api/errors";

// ─── Design tokens (exact match with sahelha-backend/frontend) ────────────────
const NAVY   = "#33409B";   // primaryBg
const WHITE  = "#FFFFFF";
const INK    = "#0E0E14";
const SECONDARY = "#5B5B68";
const SURFACE   = "#F7F7FB";
const BORDER    = "#ECECF2";

const DOC_TYPE_LABELS: Record<string, string> = {
  national_id:          "بطاقة الرقم القومي",
  passport:             "جواز السفر",
  birth_certificate:    "شهادة الميلاد",
  utility_bill:         "فاتورة مرافق",
  receipt:              "إيصال",
  invoice:              "فاتورة ضريبية",
  driving_license:      "رخصة قيادة / تسيير",
  work_permit:          "تصريح عمل",
  marriage_certificate: "عقد زواج",
  death_certificate:    "شهادة وفاة",
  property_record:      "مستند ملكية",
  unknown:              "مستند",
};

const DOC_TYPE_ACCENTS: Record<string, { accent: string; accentSoft: string }> = {
  national_id:          { accent: "#33409B", accentSoft: "#E7EAFB" },
  passport:             { accent: "#6A3E9E", accentSoft: "#F0E7F8" },
  birth_certificate:    { accent: "#8C5A1B", accentSoft: "#F6ECE0" },
  utility_bill:         { accent: "#1B6E8C", accentSoft: "#E1F1F5" },
  receipt:              { accent: "#1F7A4C", accentSoft: "#E4F3EA" },
  invoice:              { accent: "#1F7A4C", accentSoft: "#E4F3EA" },
  driving_license:      { accent: "#1B6E8C", accentSoft: "#E1F1F5" },
  work_permit:          { accent: "#33409B", accentSoft: "#E7EAFB" },
  marriage_certificate: { accent: "#6A3E9E", accentSoft: "#F0E7F8" },
  death_certificate:    { accent: "#6A3E9E", accentSoft: "#F0E7F8" },
  property_record:      { accent: "#8C5A1B", accentSoft: "#F6ECE0" },
  unknown:              { accent: "#33409B", accentSoft: "#E7EAFB" },
};

const STATUS_META: Record<string, { label: string; symbol: string; color: string }> = {
  done:       { label: "المستند جاهز",        symbol: "✓", color: "#1F7A4C" },
  processing: { label: "لسه بيتقرا",           symbol: "…", color: "#8A5A00" },
  failed:     { label: "فيه مشكلة في القراية", symbol: "✕", color: "#B3261E" },
};

// ─── Navy AppHeader (exact clone of sahelha-backend/frontend AppHeader) ────────
function AppHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <View
      style={{
        flexDirection: "row-reverse",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 18,
        paddingVertical: 14,
        minHeight: 58,
        backgroundColor: WHITE,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
      }}
    >
      <Pressable
        onPress={() => router.push("/")}
        accessibilityRole="button"
        accessibilityLabel="العودة إلى الصفحة الرئيسية"
        style={{
          flexDirection: "row-reverse",
          alignItems: "center",
          gap: 6,
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 8,
          backgroundColor: SURFACE,
        }}
      >
        <Ionicons name="home-outline" size={20} color={NAVY} />
        <Text style={{ fontSize: 14, fontWeight: "700", color: NAVY }}>الرئيسية</Text>
      </Pressable>
      <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700", color: INK }}>
        {title}
      </Text>
      <View style={{ width: 80 }} />
    </View>
  );
}

// ─── DocumentCard (interactive, expandable card with actions) ────────────────
function DocumentCard({ doc }: { doc: ScannedDocument }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const accents = DOC_TYPE_ACCENTS[doc.doc_type ?? "unknown"] ?? DOC_TYPE_ACCENTS.unknown;
  const status  = STATUS_META[doc.status] ?? STATUS_META.done;
  const typeLabel = DOC_TYPE_LABELS[doc.doc_type ?? "unknown"] ?? "مستند";
  const summary = doc.status === "processing"
    ? "لسه بيتقرا... هنعرفك أول ما يخلص"
    : (doc.ai_summary || "");

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: expanded ? NAVY : BORDER,
        backgroundColor: WHITE,
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`مستند ${typeLabel}`}
        style={{
          flexDirection: "row-reverse",
          alignItems: "center",
          gap: 14,
          width: "100%",
          padding: 16,
        }}
      >
        {/* Accent icon tile */}
        <View
          style={{
            width: 54,
            height: 54,
            borderRadius: 14,
            backgroundColor: accents.accentSoft,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Ionicons name="document-text" size={28} color={accents.accent} />
        </View>

        {/* Text block */}
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: INK, textAlign: "right" }}>
            {typeLabel}
          </Text>
          {summary ? (
            <Text numberOfLines={expanded ? 4 : 1} style={{ fontSize: 13.5, color: SECONDARY, textAlign: "right", lineHeight: 20 }}>
              {summary}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 5, marginTop: 2, flexWrap: "wrap" }}>
            <Text style={{ fontSize: 12.5, fontWeight: "700", color: status.color }}>
              {status.symbol}
            </Text>
            <Text style={{ fontSize: 12.5, fontWeight: "700", color: status.color }}>
              {status.label}
            </Text>
          </View>
        </View>

        {/* Chevron */}
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={22} color={NAVY} />
      </Pressable>

      {/* Expanded Content Card Details & Actions */}
      {expanded ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: BORDER,
            backgroundColor: SURFACE,
            padding: 16,
            gap: 12,
          }}
        >
          {doc.ai_summary ? (
            <View style={{ backgroundColor: WHITE, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: BORDER }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: SECONDARY, textAlign: "right", marginBottom: 4 }}>
                ملخص الذكاء الاصطناعي:
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: INK, textAlign: "right", lineHeight: 22 }}>
                {doc.ai_summary}
              </Text>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={{ flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" }}>
            <Pressable
              onPress={() => router.push(`/document/${doc.id}`)}
              style={{
                flex: 1,
                minWidth: 130,
                minHeight: 44,
                flexDirection: "row-reverse",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                borderRadius: 12,
                backgroundColor: NAVY,
                paddingHorizontal: 12,
              }}
            >
              <Ionicons name="open-outline" size={18} color={WHITE} />
              <Text style={{ fontSize: 14, fontWeight: "800", color: WHITE }}>عرض تفاصيل المستند</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push(`/document/${doc.id}/chat`)}
              style={{
                flex: 1,
                minWidth: 130,
                minHeight: 44,
                flexDirection: "row-reverse",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: NAVY,
                backgroundColor: WHITE,
                paddingHorizontal: 12,
              }}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={NAVY} />
              <Text style={{ fontSize: 14, fontWeight: "800", color: NAVY }}>اسأل عن المستند 🎙️</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ─── Web image picker ─────────────────────────────────────────────────────────
function pickWebImage(): Promise<{ uri: string; file: File; isPdf: boolean } | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") { resolve(null); return; }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,application/pdf,.pdf";
    input.style.display = "none";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        resolve({ uri: URL.createObjectURL(file), file, isPdf: true });
      } else {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ uri: (e.target?.result as string) || "", file, isPdf: false });
        reader.onerror = () => resolve({ uri: URL.createObjectURL(file), file, isPdf: false });
        reader.readAsDataURL(file);
      }
    };
    input.oncancel = () => resolve(null);
    document.body.appendChild(input);
    input.click();
    setTimeout(() => { if (document.body.contains(input)) document.body.removeChild(input); }, 60000);
  });
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
type FlowState = "idle" | "captured" | "analyzing";

export default function ScanScreen() {
  const router = useRouter();

  // Scanner state
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeDocumentResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  // Documents list state
  const [documents, setDocuments] = useState<ScannedDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const screenReaderEnabled = useScreenReaderEnabled();
  const { speak, speakingId } = useTtsPlayer({
    onError: (msg) => {
      setErrorMessage(msg);
      if (screenReaderEnabled && Platform.OS !== "web") {
        try { AccessibilityInfo.announceForAccessibility(msg); } catch {}
      }
    },
  });

  const loadDocuments = useCallback(async () => {
    try {
      const timeoutPromise = new Promise<ScannedDocument[]>((resolve) =>
        setTimeout(() => resolve([]), 3500)
      );
      const docs = await Promise.race([fetchDocuments(), timeoutPromise]);
      console.log("[DOCS] loaded:", docs.length);
      setDocuments(docs);
    } catch (e) {
      console.error("[DOCS] error:", e);
    } finally {
      setDocsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);
  useEffect(() => { if (analyzeResult) loadDocuments(); }, [analyzeResult, loadDocuments]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadDocuments(); }, [loadDocuments]);

  // ── Scanner actions ──────────────────────────────────────────────────────
  const pickImageFromLibrary = async () => {
    setErrorMessage(null);
    if (Platform.OS === "web") {
      try {
        const res = await pickWebImage();
        if (!res) return;
        setPhotoUri(res.uri); setSelectedFile(res.file); setIsPdf(res.isPdf);
        setAnalyzeResult(null); setFlowState("captured");
      } catch {
        setErrorMessage("تعذّر التقاط الصورة. يرجى المحاولة مرة أخرى أو اختيار صورة من الجهاز.");
      }
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 0.8 });
      if (result.canceled || !result.assets?.length) return;
      setSelectedFile(null); setIsPdf(false);
      setPhotoUri(result.assets[0].uri); setAnalyzeResult(null); setFlowState("captured");
    } catch {
      setErrorMessage("تعذّر التقاط الصورة. يرجى المحاولة مرة أخرى أو اختيار صورة من الجهاز.");
    }
  };

  const capturePhoto = async () => {
    setErrorMessage(null);
    if (Platform.OS === "web") { await pickImageFromLibrary(); return; }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setPermissionBlocked(!permission.canAskAgain);
      setErrorMessage(permission.canAskAgain
        ? "يحتاج التطبيق إلى إذن الكاميرا لالتقاط صورة المستند."
        : "تم رفض إذن الكاميرا بشكل دائم. افتح إعدادات التطبيق وفعّل إذن الكاميرا يدويًا.");
      return;
    }
    setPermissionBlocked(false);
    try {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (result.canceled || !result.assets?.length) return;
      setSelectedFile(null); setPhotoUri(result.assets[0].uri); setAnalyzeResult(null); setFlowState("captured");
    } catch { await pickImageFromLibrary(); }
  };

  const confirmAndAnalyze = async () => {
    if (!photoUri) return;
    setErrorMessage(null); setFlowState("analyzing");
    if (Platform.OS !== "web") {
      try { AccessibilityInfo.announceForAccessibility("جارٍ تحليل المستند، يرجى الانتظار"); } catch {}
    }
    try {
      const result = await analyzeDocument(photoUri, selectedFile);
      setAnalyzeResult(result);
      // Auto-reload documents list and reset preview
      await loadDocuments();
      setTimeout(() => {
        setFlowState("idle");
        setPhotoUri(null);
        setSelectedFile(null);
        setAnalyzeResult(null);
      }, 1500);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.friendlyMessageAr : "تعذّر تحليل المستند. يرجى المحاولة مرة أخرى.");
      setFlowState("captured");
    }
  };

  const rows = analyzeResult ? buildScanResultRows(analyzeResult) : [];

  const showScanner = flowState !== "idle" || rows.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: WHITE }}>
      {/* ── Navy header ── */}
      <AppHeader title="مستنداتي" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NAVY} />}
      >
        {/* ── Primary action: مسح مستند جديد ── */}
        <Pressable
          onPress={capturePhoto}
          accessibilityRole="button"
          accessibilityLabel="مسح مستند جديد"
          style={{
            minHeight: 64,
            flexDirection: "row-reverse",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            borderRadius: 18,
            backgroundColor: NAVY,
            paddingVertical: 18,
          }}
        >
          <Ionicons name="add" size={24} color={WHITE} />
          <Ionicons name="camera" size={24} color={WHITE} />
          <Text style={{ fontSize: 18, fontWeight: "800", color: WHITE }}>مسح مستند جديد</Text>
        </Pressable>

        {/* ── Secondary action: pick from library (always visible) ── */}
        <Pressable
          onPress={pickImageFromLibrary}
          accessibilityRole="button"
          accessibilityLabel="اختيار صورة أو ملف من الجهاز"
          style={{
            minHeight: 56,
            flexDirection: "row-reverse",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            borderRadius: 18,
            backgroundColor: SURFACE,
            borderWidth: 1,
            borderColor: BORDER,
            paddingVertical: 14,
          }}
        >
          <Ionicons name="folder-open-outline" size={22} color={INK} />
          <Text style={{ fontSize: 16, fontWeight: "700", color: INK }}>اختيار صورة أو ملف من الجهاز</Text>
        </Pressable>

        {/* ── Scanner UI: preview + confirm (shown after picking) ── */}
        {flowState !== "idle" || rows.length > 0 ? (
          <View style={{ gap: 12 }}>
            <CameraPreviewPlaceholder photoUri={photoUri} isPdf={isPdf} fileName={selectedFile?.name} />

            {errorMessage ? (
              <View style={{ borderRadius: 12, borderWidth: 2, borderColor: "#B3261E", backgroundColor: "#FFF0EE", padding: 14 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#B3261E", textAlign: "right" }}>{errorMessage}</Text>
                {permissionBlocked ? (
                  <Pressable
                    onPress={() => Linking.openSettings()}
                    style={{ marginTop: 10, minHeight: 48, borderRadius: 999, backgroundColor: NAVY, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "700", color: WHITE }}>فتح الإعدادات</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {flowState === "analyzing" ? (
              <View style={{ minHeight: 56, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE }}>
                <ActivityIndicator color={NAVY} />
                <Text style={{ fontSize: 17, fontWeight: "700", color: INK }}>جارٍ تحليل المستند…</Text>
              </View>
            ) : flowState === "captured" ? (
              <View style={{ gap: 10 }}>
                <Pressable
                  onPress={confirmAndAnalyze}
                  style={{ minHeight: 56, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 14, backgroundColor: "#1F7A4C" }}
                >
                  <Ionicons name="checkmark-circle" size={24} color={WHITE} />
                  <Text style={{ fontSize: 17, fontWeight: "700", color: WHITE }}>تأكيد وتحليل</Text>
                </Pressable>
                <Pressable
                  onPress={capturePhoto}
                  style={{ minHeight: 48, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 14, borderWidth: 1.5, borderColor: NAVY, backgroundColor: WHITE }}
                >
                  <Ionicons name="camera-reverse" size={22} color={NAVY} />
                  <Text style={{ fontSize: 16, fontWeight: "700", color: NAVY }}>أعد التصوير</Text>
                </Pressable>
              </View>
            ) : null}

            {rows.length > 0 ? (
              <View>
                <Text style={{ fontSize: 14, fontWeight: "700", color: SECONDARY, textAlign: "right", marginBottom: 8 }}>يستخرج تلقائياً</Text>
                <View style={{ borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: WHITE, paddingHorizontal: 16 }}>
                  {rows.map((row, index) => (
                    <ExtractRow
                      key={row.id}
                      label={row.label}
                      value={row.value}
                      showDivider={index < rows.length - 1}
                      isSpeaking={speakingId === row.id}
                      onSpeakerPress={() => void speak(row.value, row.id)}
                      speakerAccessibilityLabel={`استمع إلى ${row.label}`}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Divider ── */}
        <View style={{ height: 1, backgroundColor: BORDER, marginVertical: 4 }} />

        {/* ── مستنداتك ── */}
        <Text style={{ fontSize: 16, fontWeight: "800", color: SECONDARY, textAlign: "right" }}>
          مستنداتك
        </Text>

        {docsLoading ? (
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            <ActivityIndicator size="large" color={NAVY} />
            <Text style={{ marginTop: 12, color: SECONDARY, fontSize: 14 }}>جارٍ تحميل المستندات…</Text>
          </View>
        ) : documents.length === 0 ? (
          <View
            style={{
              paddingVertical: 32,
              paddingHorizontal: 20,
              alignItems: "center",
              gap: 12,
              backgroundColor: SURFACE,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: BORDER,
              marginTop: 4,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: "#E7EAFB",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="document-text-outline" size={30} color={NAVY} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: "800", color: INK, textAlign: "center" }}>
              لا توجد مستندات ممسوحة ضوئياً بعد
            </Text>
            <Text style={{ fontSize: 13.5, fontWeight: "500", color: SECONDARY, textAlign: "center", lineHeight: 22 }}>
              عند مسح بطاقة الرقم القومي أو المستندات الرسمية، سيتم تعبئة كافة الخدمات الحكومية تلقائياً.
            </Text>
            <Pressable
              onPress={capturePhoto}
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 8,
                backgroundColor: NAVY,
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 12,
                marginTop: 4,
              }}
            >
              <Ionicons name="camera" size={18} color={WHITE} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: WHITE }}>مسح مستند جديد</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {documents.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
