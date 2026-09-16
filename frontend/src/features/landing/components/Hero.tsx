import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAudioRecorderHook } from "@/features/voice/useAudioRecorder";
import { transcribeAudio } from "@/features/voice/api";
import { useTtsPlayer } from "@/features/voice/useTtsPlayer";
import { useTheme } from "@/features/theme/ThemeContext";

type HeroProps = {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onSearchSubmit?: () => void;
};

export const POPULAR_TAGS = [
  { id: "all", label: "الكل" },
  { id: "الأحوال", label: "الأحوال المدنية" },
  { id: "مركباتي", label: "مركباتي" },
  { id: "رخص", label: "رخص" },
  { id: "التموين", label: "التموين" },
  { id: "التوثيق", label: "التوثيق" },
  { id: "السجل التجاري", label: "السجل التجاري" },
  { id: "التأمين", label: "التأمين الاجتماعي" },
  { id: "المحاكم", label: "المحاكم" },
];

export const Hero = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
  onSearchSubmit,
}: HeroProps) => {
  const router = useRouter();
  const recorder = useAudioRecorderHook();
  const tts = useTtsPlayer();
  const { colors, themeMode } = useTheme();
  const [isTranscribing, setIsTranscribing] = useState(false);

  const handleVoiceSearchToggle = async () => {
    if (recorder.isRecording) {
      const uri = await recorder.stopRecording();
      if (!uri) return;
      try {
        setIsTranscribing(true);
        const res = await transcribeAudio(uri);
        const text = res.transcript.trim();
        if (text) {
          onSearchChange(text);
          tts.speakTextContent(`تم البحث عن ${text}`, "search-feedback");
        } else {
          tts.speakTextContent("لم يتم التقاط صوت واضح، يرجى إعادة المحاولة", "search-retry");
        }
      } catch {
        tts.speakTextContent("تعذر معالجة الصوت، يرجى المحاولة مرة أخرى", "search-err");
      } finally {
        setIsTranscribing(false);
      }
    } else {
      tts.stopCurrent();
      const ok = await recorder.startRecording();
      if (ok) {
        tts.speakTextContent("تحدث الآن باسم الخدمة المطلوبة", "search-prompt");
      }
    }
  };

  return (
    <View
      style={[
        styles.heroSection,
        {
          backgroundColor: colors.bgSurface,
          borderBottomColor: colors.border,
          borderBottomWidth: colors.borderWidth,
        },
      ]}
    >
      <View style={styles.container}>
        {/* Two-Column Asymmetrical Layout (Not Centered) */}
        <View style={styles.layoutRow}>
          {/* Main Column (Right in RTL) */}
          <View style={styles.mainColumn}>
            <Text style={[styles.headline, { color: colors.textPrimary }]}>أي خدمة؟</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              وفر وقتك واستفد من خدمات سهلها عليا في دقائق معدودة، مع دعم كامل للتقنيات الصوتية المخصصة للمكفوفين وضعاف البصر.
            </Text>

            {/* Search Capsule */}
            <View
              style={[
                styles.searchBox,
                {
                  backgroundColor: colors.searchBoxBg,
                  borderColor: colors.searchBoxBorder,
                  borderWidth: colors.borderWidth,
                },
              ]}
            >
              <Ionicons
                name="search"
                size={24}
                color={colors.textSecondary}
                style={styles.searchIcon}
              />
              <TextInput
                value={searchQuery}
                onChangeText={onSearchChange}
                onSubmitEditing={onSearchSubmit}
                placeholder="...اكتب اسم الخدمة المطلوبة (مثال: بطاقة الرقم القومي، رخصة قيادة)"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel="حقل البحث عن الخدمات الحكومية"
                accessibilityHint="اكتب اسم الخدمة أو اضغط زر البحث الصوتي"
                style={[styles.searchInput, { color: colors.textPrimary }]}
              />

              <Pressable
                onPress={handleVoiceSearchToggle}
                accessibilityRole="button"
                accessibilityLabel={recorder.isRecording ? "إيقاف التسجيل الصوتي" : "البحث الصوتي الذكي"}
                style={({ pressed }) => [
                  styles.voiceSearchButton,
                  recorder.isRecording && styles.voiceButtonRecording,
                  {
                    backgroundColor: themeMode === "high-contrast" ? "#000000" : "#B45309",
                    borderColor: colors.border,
                    borderWidth: colors.borderWidth,
                  },
                  pressed && styles.buttonPressed,
                ]}
              >
                {isTranscribing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons
                    name={recorder.isRecording ? "radio" : "mic"}
                    size={20}
                    color="#FFFFFF"
                  />
                )}
                <Text style={styles.voiceButtonText}>
                  {recorder.isRecording ? "استماع..." : "بحث صوتي"}
                </Text>
              </Pressable>

              <Pressable
                onPress={onSearchSubmit}
                accessibilityRole="button"
                accessibilityLabel="تنفيذ البحث"
                style={({ pressed }) => [
                  styles.submitSearchButton,
                  {
                    backgroundColor: colors.btnPrimaryBg,
                    borderColor: colors.border,
                    borderWidth: colors.borderWidth,
                  },
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={[styles.submitSearchButtonText, { color: colors.btnPrimaryText }]}>
                  ابحث
                </Text>
              </Pressable>
            </View>

            {/* Popular Services Pills */}
            <View style={styles.pillsRow}>
              <Text style={[styles.pillsLabel, { color: colors.textPrimary }]}>
                أشهر المعاملات :
              </Text>
              <View style={styles.pillsList}>
                {POPULAR_TAGS.map((tag) => {
                  const isSelected =
                    selectedCategory === tag.id ||
                    (tag.id === "all" && selectedCategory === "");

                  return (
                    <Pressable
                      key={tag.id}
                      onPress={() => onSelectCategory(tag.id === "all" ? "" : tag.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`تصفية حسب ${tag.label}`}
                      style={({ pressed }) => [
                        styles.tagPill,
                        {
                          backgroundColor: isSelected ? colors.tagSelectedBg : colors.tagBg,
                          borderColor: isSelected ? colors.tagSelectedBg : colors.tagBorder,
                          borderWidth: colors.borderWidth,
                        },
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tagPillText,
                          {
                            color: isSelected ? colors.tagSelectedText : colors.tagText,
                            fontWeight: isSelected ? "900" : "700",
                          },
                        ]}
                      >
                        {tag.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Side Fast-Track Card (Left in RTL) */}
          <View
            style={[
              styles.sideCard,
              {
                backgroundColor: colors.fastTrackCardBg,
                borderColor: colors.border,
                borderWidth: colors.borderWidth,
              },
            ]}
          >
            <View style={[styles.sideCardHeader, { borderBottomColor: colors.border }]}>
              <Ionicons name="flash-outline" size={22} color={colors.textPrimary} />
              <Text style={[styles.sideCardTitle, { color: colors.textPrimary }]}>
                الوصول السريع للمعاملات
              </Text>
            </View>

            <View style={styles.sideCardActions}>
              <Pressable
                onPress={() => router.push("/(tabs)/scan")}
                accessibilityRole="button"
                accessibilityLabel="مسح بطاقة الرقم القومي بالكاميرا واستخراج البيانات"
                style={({ pressed }) => [
                  styles.fastTrackItem,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    borderWidth: colors.borderWidth,
                  },
                  pressed && styles.buttonPressed,
                ]}
              >
                <View
                  style={[
                    styles.fastTrackIconBox,
                    {
                      backgroundColor: colors.btnPrimaryBg,
                    },
                  ]}
                >
                  <Ionicons name="camera" size={22} color={colors.btnPrimaryText} />
                </View>
                <View style={styles.fastTrackTextCol}>
                  <Text style={[styles.fastTrackItemTitle, { color: colors.textPrimary }]}>
                    مسح بطاقة الرقم القومي
                  </Text>
                  <Text style={[styles.fastTrackItemDesc, { color: colors.textSecondary }]}>
                    استخراج البيانات آلياً دون كتابة يدوية
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => router.push("/(tabs)/chat")}
                accessibilityRole="button"
                accessibilityLabel="استشارة المساعد الصوتي الذكي"
                style={({ pressed }) => [
                  styles.fastTrackItem,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    borderWidth: colors.borderWidth,
                  },
                  pressed && styles.buttonPressed,
                ]}
              >
                <View
                  style={[
                    styles.fastTrackIconBox,
                    {
                      backgroundColor: themeMode === "high-contrast" ? "#000000" : "#166534",
                    },
                  ]}
                >
                  <Ionicons name="chatbubbles" size={22} color="#FFFFFF" />
                </View>
                <View style={styles.fastTrackTextCol}>
                  <Text style={[styles.fastTrackItemTitle, { color: colors.textPrimary }]}>
                    المساعد الصوتي الذكي
                  </Text>
                  <Text style={[styles.fastTrackItemDesc, { color: colors.textSecondary }]}>
                    إجابات فورية على استفسارات الرسوم والخطوات
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={onSearchSubmit}
                accessibilityRole="button"
                accessibilityLabel="عرض دليل الخدمات الحكومية الـ 18"
                style={({ pressed }) => [
                  styles.fastTrackItem,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    borderWidth: colors.borderWidth,
                  },
                  pressed && styles.buttonPressed,
                ]}
              >
                <View
                  style={[
                    styles.fastTrackIconBox,
                    {
                      backgroundColor: themeMode === "high-contrast" ? "#000000" : "#92400E",
                    },
                  ]}
                >
                  <Ionicons name="document-text" size={22} color="#FFFFFF" />
                </View>
                <View style={styles.fastTrackTextCol}>
                  <Text style={[styles.fastTrackItemTitle, { color: colors.textPrimary }]}>
                    الدليل الشامل للخدمات
                  </Text>
                  <Text style={[styles.fastTrackItemDesc, { color: colors.textSecondary }]}>
                    18 خدمة حكومية مدعومة بالصوت
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  heroSection: {
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  container: {
    maxWidth: 1200,
    width: "100%",
    marginHorizontal: "auto",
  },
  layoutRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 32,
  },
  mainColumn: {
    flex: 1,
    minWidth: 320,
    alignItems: "flex-end",
  },
  headline: {
    fontSize: 54,
    fontWeight: "900",
    textAlign: "right",
    lineHeight: 64,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "right",
    lineHeight: 28,
    maxWidth: 620,
    marginBottom: 24,
  },
  searchBox: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  searchIcon: {
    marginLeft: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "right",
    paddingVertical: 8,
  },
  voiceSearchButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  voiceButtonRecording: {
    backgroundColor: "#DC2626",
  },
  voiceButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  submitSearchButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  submitSearchButtonText: {
    fontSize: 16,
    fontWeight: "800",
  },
  pillsRow: {
    width: "100%",
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 10,
  },
  pillsLabel: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 6,
  },
  pillsList: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    flex: 1,
  },
  tagPill: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  tagPillText: {
    fontSize: 14,
  },
  sideCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 16,
    padding: 20,
  },
  sideCardHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
  },
  sideCardTitle: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "right",
  },
  sideCardActions: {
    gap: 12,
  },
  fastTrackItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    padding: 12,
  },
  fastTrackIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  fastTrackTextCol: {
    flex: 1,
    alignItems: "flex-end",
  },
  fastTrackItemTitle: {
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 2,
  },
  fastTrackItemDesc: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
