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
          <Ionicons name="add" size={24} color={c.primaryFg} />
          <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 18, color: c.primaryFg }}>
            مسح مستند جديد
          </Text>
        </Pressable>

        <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 16, color: c.secondary, textAlign: "right" }}>
          مستنداتك
        </Text>

        {documents.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: "center", gap: 10 }}>
            <Text style={{ fontFamily: "IBMPlexSansArabic_600SemiBold", fontSize: 16, color: c.secondary, textAlign: "center" }}>
              لسه معندكش مستندات. اضغط على "مسح مستند جديد" عشان تبدأ.
            </Text>
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
