import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, Share, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";

import { AppHeader } from "@/components/ui/AppHeader";
import { fetchShareInfo, type ShareInfo } from "@/features/share/api";
import { useAppearance } from "@/store/appearanceStore";
import { useToast } from "@/store/toastStore";
import { palette } from "@/styles/theme";

// Real Share screen: renders the QR from GET /api/archive/share/{id} (base64
// PNG) PLUS the plain share_url as selectable/copyable text — never QR-only,
// since a QR code is a visual-only mechanism the primary (blind) persona
// can't use (SAHELHA_DESIGN_BRIEF.md §6.8).
export default function DocumentShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { highContrast } = useAppearance();
  const { showToast } = useToast();
  const c = palette(highContrast);

  const [share, setShare] = useState<ShareInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchShareInfo(Number(id))
      .then((data) => {
        if (!cancelled) setShare(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.friendlyMessageAr ?? "تعذّر تجهيز رابط المشاركة، حاول تاني");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const copyLink = async () => {
    if (!share) return;
    await Clipboard.setStringAsync(share.share_url);
    showToast("تم نسخ الرابط");
  };

  const shareLink = async () => {
    if (!share) return;
    try {
      await Share.share({ message: share.share_url });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  };

  // The link now points at a real, publicly downloadable PDF of the document
  // (GET /api/archive/view/{token} on the backend), not a placeholder page,
  // so it can be opened directly instead of only copied/relayed.
  const openPdf = () => {
    if (!share) return;
    Linking.openURL(share.share_url).catch(() => showToast("تعذّر فتح ملف PDF"));
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.pageBg }}>
      <AppHeader title="مشاركة المستند" showBack />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 20 }}>
        {loading ? (
          <ActivityIndicator size="large" color={c.ink} />
        ) : error ? (
          <Text
            role="alert"
            style={{ fontFamily: "IBMPlexSansArabic_600SemiBold", fontSize: 16, color: c.secondary, textAlign: "center" }}
          >
            {error}
          </Text>
        ) : share ? (
          <>
            <Image
              source={{ uri: `data:image/png;base64,${share.qr_image_base64}` }}
              accessibilityLabel="رمز الاستجابة السريعة لمشاركة المستند"
              style={{ width: 220, height: 220, borderRadius: 12, backgroundColor: "#FFFFFF" }}
              resizeMode="contain"
            />

            <Text
              style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 13, color: c.secondary, textAlign: "center" }}
            >
              رابط تحميل المستند بصيغة PDF
            </Text>

            <View
              style={{
                width: "100%",
                borderWidth: 2,
                borderColor: c.border,
                borderRadius: 14,
                padding: 14,
              }}
            >
              <Text
                selectable
                style={{ fontFamily: "IBMPlexSansArabic_600SemiBold", fontSize: 15, color: c.ink, textAlign: "center" }}
              >
                {share.share_url}
              </Text>
            </View>

            <Pressable
              onPress={openPdf}
              accessibilityRole="button"
              accessibilityLabel="فتح المستند كملف PDF"
              style={{
                width: "100%",
                minHeight: 56,
                borderRadius: 12,
                backgroundColor: c.primaryBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 15, color: c.primaryFg }}>فتح ملف PDF</Text>
            </Pressable>

            <View style={{ flexDirection: "row-reverse", gap: 10, width: "100%" }}>
              <Pressable
                onPress={copyLink}
                accessibilityRole="button"
                accessibilityLabel="نسخ رابط المشاركة"
                style={{
                  flex: 1,
                  minHeight: 56,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: c.ink,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 15, color: c.ink }}>نسخ الرابط</Text>
              </Pressable>
              <Pressable
                onPress={shareLink}
                accessibilityRole="button"
                accessibilityLabel="مشاركة الرابط عبر تطبيقات أخرى"
                style={{
                  flex: 1,
                  minHeight: 56,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: c.ink,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 15, color: c.ink }}>مشاركة</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}
