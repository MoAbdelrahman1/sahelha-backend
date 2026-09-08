import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { AppHeader } from "@/components/ui/AppHeader";
import { DocumentCard } from "@/components/common/DocumentCard";
import { useAppearance } from "@/store/appearanceStore";
import { useDocuments } from "@/store/documentsStore";
import { useToast } from "@/store/toastStore";
import { palette, TAG_LABELS } from "@/styles/theme";
import { DOC_TYPE_LABELS } from "@/types/document";

const ALL_TAGS = ["identity", "government", "financial", "arabic"];

// Full-text search (q) + tag filter over the document list — mirrors the real
// GET /api/archive/search?q=&tags= contract shape (client-side, over demo
// data, for this pass). Reuses DocumentCard so results look identical to Home.
export default function ArchiveScreen() {
  const router = useRouter();
  const { highContrast } = useAppearance();
  const { documents } = useDocuments();
  const { showToast } = useToast();
  const c = palette(highContrast);
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = query.trim();
    return documents.filter((d) => {
      const typeLabel = d.doc_type ? DOC_TYPE_LABELS[d.doc_type] : "";
      const matchesQuery = !q || (d.ai_summary && d.ai_summary.includes(q)) || typeLabel.includes(q);
      const matchesTags = activeTags.length === 0 || activeTags.every((t) => d.tags.includes(t));
      return matchesQuery && matchesTags;
    });
  }, [documents, query, activeTags]);

  const toggleTag = (tag: string) =>
    setActiveTags((tags) => (tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]));

  return (
    <View style={{ flex: 1, backgroundColor: c.pageBg }}>
      <AppHeader title="الأرشيف" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}>
        <View style={{ flexDirection: "row-reverse", gap: 8 }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="دور على مستند..."
            placeholderTextColor={c.secondary}
            accessibilityLabel="دور على مستند"
            style={{
              flex: 1,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderRadius: 999,
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
            onPress={() => showToast("قول اسم المستند اللي تدور عليه")}
            accessibilityRole="button"
            accessibilityLabel="بحث بالصوت"
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: c.primaryBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="mic" size={20} color={c.primaryFg} />
          </Pressable>
        </View>

        <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }}>
          {ALL_TAGS.map((tag) => {
            const active = activeTags.includes(tag);
            return (
              <Pressable
                key={tag}
                onPress={() => toggleTag(tag)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={TAG_LABELS[tag]}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 999,
                  borderWidth: 2,
                  borderColor: c.ink,
                  backgroundColor: active ? c.ink : "transparent",
                }}
              >
                <Text
                  style={{
                    fontFamily: "IBMPlexSansArabic_700Bold",
                    fontSize: 13,
                    color: active ? c.pageBg : c.ink,
                  }}
                >
                  {TAG_LABELS[tag]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {filtered.length === 0 ? (
          <Text
            style={{
              fontFamily: "IBMPlexSansArabic_600SemiBold",
              fontSize: 15,
              color: c.secondary,
              textAlign: "center",
              paddingVertical: 30,
            }}
          >
            مفيش نتائج مطابقة
          </Text>
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onPress={() => router.push(`/document/${doc.id}`)} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
