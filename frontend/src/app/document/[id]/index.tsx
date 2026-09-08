import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { AppHeader } from "@/components/ui/AppHeader";
import { useAppearance } from "@/store/appearanceStore";
import { useDocuments } from "@/store/documentsStore";
import { useToast } from "@/store/toastStore";
import { palette } from "@/styles/theme";
import { DOC_TYPE_LABELS } from "@/types/document";

// Leads with the spoken summary (auto-play is a real-backend/TTS concern, out
// of scope for this demo-data pass — the "plays automatically" note and
// replay control are shown as designed either way), then structured fields,
// then the "ask about this document" CTA into the doc-scoped AI assistant,
// then share/delete with a spoken confirm step before delete
// (SAHELHA_DESIGN_BRIEF.md §6.5).
export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { highContrast } = useAppearance();
  const { getDocument, deleteDocument } = useDocuments();
  const { showToast } = useToast();
  const c = palette(highContrast);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const doc = getDocument(Number(id));

  if (!doc) {
    return (
      <View style={{ flex: 1, backgroundColor: c.pageBg }}>
        <AppHeader title="مستند" showBack />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ fontFamily: "IBMPlexSansArabic_600SemiBold", fontSize: 16, color: c.secondary }}>
            المستند غير موجود
          </Text>
        </View>
      </View>
    );
  }

  const typeLabel = doc.doc_type ? DOC_TYPE_LABELS[doc.doc_type] : "مستند";

  const confirmDelete = () => {
    deleteDocument(doc.id);
    showToast("تم حذف المستند");
    router.back();
  };

  const row = (label: string, value: string) => (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 13, color: c.secondary, textAlign: "right" }}>
        {label}
      </Text>
      <Text style={{ fontFamily: "IBMPlexSansArabic_600SemiBold", fontSize: 16, color: c.ink, textAlign: "right" }}>
        {value}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.pageBg }}>
      <AppHeader title={typeLabel} showBack />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 18 }}>
        {doc.status === "done" && doc.ai_summary ? (
          <View style={{ borderWidth: 2, borderColor: c.border, borderRadius: 18, padding: 18, gap: 12 }}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: c.secondary }}>▶</Text>
              <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 13, color: c.secondary }}>
                يتم تشغيل الملخص صوتيًا تلقائيًا
              </Text>
            </View>
            <Text style={{ fontFamily: "IBMPlexSansArabic_600SemiBold", fontSize: 17, lineHeight: 30, color: c.ink, textAlign: "right" }}>
              {doc.ai_summary}
            </Text>
            <Pressable
              onPress={() => showToast("جاري تشغيل الملخص صوتيًا")}
              accessibilityRole="button"
              accessibilityLabel="إعادة تشغيل الصوت"
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 999,
                borderWidth: 2,
                borderColor: c.ink,
              }}
            >
              <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 13, color: c.ink }}>
                إعادة تشغيل الصوت
              </Text>
            </Pressable>
          </View>
        ) : doc.status === "processing" ? (
          <View role="status" accessibilityLiveRegion="polite" style={{ borderWidth: 2, borderColor: c.border, borderRadius: 18, padding: 18 }}>
            <Text style={{ fontFamily: "IBMPlexSansArabic_600SemiBold", fontSize: 16, color: c.secondary, textAlign: "right" }}>
              لسه بيتقرا... هنعرفك أول ما يخلص
            </Text>
          </View>
        ) : doc.status === "failed" ? (
          <View style={{ borderWidth: 2, borderColor: "#B3261E", borderRadius: 18, padding: 18 }}>
            <Text style={{ fontFamily: "IBMPlexSansArabic_600SemiBold", fontSize: 16, color: "#B3261E", textAlign: "right" }}>
              {doc.ai_summary}
            </Text>
          </View>
        ) : null}

        {doc.status === "done" ? (
          <Pressable
            onPress={() => router.push(`/document/${doc.id}/chat`)}
            accessibilityRole="button"
            accessibilityLabel="اسأل عن هذا المستند"
            style={{
              minHeight: 64,
              flexDirection: "row-reverse",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              borderRadius: 18,
              backgroundColor: c.primaryBg,
              paddingVertical: 18,
            }}
          >
            <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 17, color: c.primaryFg }}>
              🎙 اسأل عن هذا المستند
            </Text>
          </Pressable>
        ) : null}

        {doc.status === "done" ? (
          <View style={{ gap: 14 }}>
            {row("نوع المستند", typeLabel)}
            {doc.entities.name ? row("الاسم", doc.entities.name) : null}
            {doc.entities.address ? row("العنوان / المحافظة", `${doc.entities.address} — ${doc.entities.governorate ?? ""}`) : null}
            {doc.entities.national_number ? row("الرقم القومي", doc.entities.national_number) : null}
            {doc.dates.length > 0 ? row("تواريخ مذكورة", doc.dates.join("، ")) : null}
            {doc.amounts.length > 0 ? row("المبالغ", doc.amounts.join("، ")) : null}
            {doc.expiry_date ? (
              <View
                style={{
                  borderRightWidth: 4,
                  borderRightColor: c.ink,
                  paddingRight: 12,
                  gap: 4,
                }}
              >
                <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 13, color: c.secondary, textAlign: "right" }}>
                  تاريخ الانتهاء
                </Text>
                <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 16, color: c.ink, textAlign: "right" }}>
                  {doc.expiry_date}
                </Text>
                {doc.reminderSet ? (
                  <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 13, color: c.secondary, textAlign: "right" }}>
                    ✓ تم ضبط تذكير قبل الانتهاء
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {doc.status === "done" ? (
          <View style={{ flexDirection: "row-reverse", gap: 10 }}>
            <Pressable
              onPress={() => router.push(`/document/${doc.id}/share`)}
              accessibilityRole="button"
              accessibilityLabel="مشاركة المستند"
              style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 2, borderColor: c.ink, alignItems: "center" }}
            >
              <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 14, color: c.ink }}>مشاركة المستند</Text>
            </Pressable>
            {confirmingDelete ? (
              <Pressable
                onPress={confirmDelete}
                accessibilityRole="button"
                accessibilityLabel="تأكيد حذف المستند"
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 2, borderColor: c.ink, backgroundColor: c.ink, alignItems: "center" }}
              >
                <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 14, color: c.pageBg }}>
                  تأكيد حذف المستند؟
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setConfirmingDelete(true)}
                accessibilityRole="button"
                accessibilityLabel="حذف المستند"
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 2, borderColor: c.ink, alignItems: "center" }}
              >
                <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 14, color: c.ink }}>حذف المستند</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
