import React from "react";
import { ScrollView, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { AppHeader } from "@/components/ui/AppHeader";
import { DocumentCard } from "@/components/common/DocumentCard";
import { useAppearance } from "@/store/appearanceStore";
import { useDocuments } from "@/store/documentsStore";
import { palette } from "@/styles/theme";

// Home = the single most important screen: one huge, fixed, always-reachable
// "scan a new document" action, plus the document list, each item fully
// tappable — matches SAHELHA_DESIGN_BRIEF.md §6.3 exactly (no dense grid of
// secondary features competing with it).
export default function HomeScreen() {
  const router = useRouter();
  const { highContrast } = useAppearance();
  const { documents } = useDocuments();
  const c = palette(highContrast);

  return (
    <View style={{ flex: 1, backgroundColor: c.pageBg }}>
      <AppHeader title="مستنداتي" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}>
        <Pressable
          onPress={() => router.push("/camera")}
          accessibilityRole="button"
          accessibilityLabel="مسح مستند جديد"
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
          <Ionicons name="camera" size={24} color={c.primaryFg} />
          <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 18, color: c.primaryFg }}>
            مسح مستند جديد
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/services")}
          accessibilityRole="button"
          accessibilityLabel="الخدمات الحكومية الرقمية"
          style={{
            minHeight: 64,
            flexDirection: "row-reverse",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            borderRadius: 18,
            backgroundColor: c.surface,
            paddingVertical: 18,
            borderColor: c.border,
            borderWidth: 1,
          }}
        >
          <Ionicons name="library-outline" size={24} color={c.ink} />
          <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 18, color: c.ink }}>
            الخدمات الحكومية الرقمية (١٨ خدمة)
          </Text>
        </Pressable>

        <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 16, color: c.secondary, textAlign: "right", marginTop: 12 }}>
          مستنداتك
        </Text>

        {documents.length === 0 ? (
          <View
            style={{
              paddingVertical: 32,
              paddingHorizontal: 20,
              alignItems: "center",
              gap: 12,
              backgroundColor: c.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: highContrast ? c.ink : "#E7EAFB",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="document-text-outline" size={30} color={highContrast ? c.pageBg : c.primaryBg} />
            </View>
            <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 17, color: c.ink, textAlign: "center" }}>
              لا توجد مستندات ممسوحة ضوئياً بعد
            </Text>
            <Text style={{ fontFamily: "IBMPlexSansArabic_500Medium", fontSize: 13.5, color: c.secondary, textAlign: "center", lineHeight: 22 }}>
              عند مسح بطاقة الرقم القومي أو المستندات الرسمية، سيتم تعبئة بياناتك تلقائياً في كافة الخدمات الحكومية.
            </Text>
            <Pressable
              onPress={() => router.push("/camera")}
              accessibilityRole="button"
              accessibilityLabel="مسح مستند جديد"
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 8,
                backgroundColor: c.primaryBg,
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 12,
                marginTop: 4,
              }}
            >
              <Ionicons name="camera" size={18} color={c.primaryFg} />
              <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 14, color: c.primaryFg }}>
                مسح مستند جديد
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {documents.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onPress={() => router.push(`/document/${doc.id}`)} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
