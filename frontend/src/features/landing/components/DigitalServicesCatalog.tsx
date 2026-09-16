import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useTtsPlayer, stopGlobalTts } from "@/features/voice/useTtsPlayer";
import { fetchServices, type GovernmentService } from "@/features/services/api";
import { useTheme } from "@/features/theme/ThemeContext";

type DigitalServicesCatalogProps = {
  searchQuery: string;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
};

const CATEGORIES = [
  { id: "all", label: "جميع الخدمات", icon: "grid-outline" as const },
  { id: "الأحوال", label: "الأحوال المدنية", icon: "people-outline" as const },
  { id: "مركباتي", label: "المرور والمركبات", icon: "car-outline" as const },
  { id: "التوثيق", label: "التوثيق والشهر العقاري", icon: "shield-checkmark-outline" as const },
  { id: "التموين", label: "التموين والدعم", icon: "basket-outline" as const },
  { id: "الضرائب", label: "الضرائب والسجل التجاري", icon: "briefcase-outline" as const },
];

function getServiceIcon(category: string, title: string): keyof typeof Ionicons.glyphMap {
  if (title.includes("زواج") || title.includes("طلاق")) return "heart-outline";
  if (title.includes("ميلاد") || title.includes("وفاة") || category.includes("الأحوال")) return "person-outline";
  if (category.includes("مركباتي") || title.includes("رخصة") || title.includes("قيادة")) return "car-outline";
  if (category.includes("التوثيق") || title.includes("توكيل") || title.includes("عقد")) return "document-text-outline";
  if (category.includes("الضرائب") || category.includes("تجاري")) return "business-outline";
  if (category.includes("التموين")) return "basket-outline";
  return "file-tray-full-outline";
}

export const DigitalServicesCatalog = ({
  searchQuery,
  selectedCategory,
  onSelectCategory,
}: DigitalServicesCatalogProps) => {
  const router = useRouter();
  const tts = useTtsPlayer();
  const { colors, themeMode } = useTheme();

  const [services, setServices] = useState<GovernmentService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchServices();
        if (isMounted) setServices(data);
      } catch (err) {
        console.warn("Failed to fetch services in landing catalog", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
      tts.stopCurrent();
    };
  }, []);

  const handleListenToService = (item: GovernmentService) => {
    const docs = item.required_documents?.length
      ? `المستندات المطلوبة هي: ${item.required_documents.join("، و")}.`
      : "";
    const fees = item.fees_and_delivery ? `الرسوم والتسليم: ${item.fees_and_delivery}.` : "";
    const speech = `خدمة ${item.title}. ${item.description || ""}. ${docs} ${fees}`;
    tts.speakTextContent(speech, `svc-${item.id}`);
  };

  const filteredServices = services.filter((svc) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      q === "" ||
      svc.title.toLowerCase().includes(q) ||
      (svc.description && svc.description.toLowerCase().includes(q)) ||
      svc.category.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (!selectedCategory || selectedCategory === "all") return true;
    return svc.category.includes(selectedCategory) || svc.title.includes(selectedCategory);
  });

  return (
    <View
      style={[
        styles.catalogSection,
        {
          backgroundColor: colors.bgScreen,
          borderTopColor: colors.border,
          borderTopWidth: colors.borderWidth,
        },
      ]}
    >
      <View style={styles.container}>
        {/* Section Header */}
        <View style={styles.headerBox}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            دليل الخدمات الحكومية الإلكترونية
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            18 خدمة حكومية معتمدة مع دعم التقديم الصوتي الكامل والاستماع لكافة المتطلبات والرسوم
          </Text>
        </View>

        {/* Category Tabs */}
        <View style={styles.categoryTabsRow}>
          {CATEGORIES.map((cat) => {
            const isSelected =
              (cat.id === "all" && (!selectedCategory || selectedCategory === "all")) ||
              selectedCategory === cat.id;

            return (
              <Pressable
                key={cat.id}
                onPress={() => onSelectCategory(cat.id === "all" ? "" : cat.id)}
                accessibilityRole="tab"
                accessibilityLabel={`تصنيف ${cat.label}`}
                style={({ pressed }) => [
                  styles.categoryTab,
                  {
                    backgroundColor: isSelected ? colors.tagSelectedBg : colors.bgSurface,
                    borderColor: isSelected ? colors.tagSelectedBg : colors.border,
                    borderWidth: colors.borderWidth,
                  },
                  pressed && styles.buttonPressed,
                ]}
              >
                <Ionicons
                  name={cat.icon}
                  size={18}
                  color={isSelected ? colors.tagSelectedText : colors.textPrimary}
                />
                <Text
                  style={[
                    styles.categoryTabText,
                    {
                      color: isSelected ? colors.tagSelectedText : colors.textPrimary,
                      fontWeight: isSelected ? "900" : "700",
                    },
                  ]}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Loading Spinner */}
        {loading && (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color={colors.btnPrimaryBg} />
            <Text style={[styles.stateText, { color: colors.textSecondary }]}>
              جاري تحميل الخدمات الحكومية المعتمدة...
            </Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && filteredServices.length === 0 && (
          <View
            style={[
              styles.emptyContainer,
              {
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
                borderWidth: colors.borderWidth,
              },
            ]}
          >
            <Ionicons name="search-outline" size={44} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              لم نعثر على خدمات تطابق بحثك
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              يرجى تجربة كلمات بحث أخرى أو اختيار تصنيف من الأعلى
            </Text>
            <Pressable
              onPress={() => onSelectCategory("")}
              style={[styles.resetFilterButton, { backgroundColor: colors.btnPrimaryBg }]}
            >
              <Text style={[styles.resetFilterButtonText, { color: colors.btnPrimaryText }]}>
                عرض كافة الخدمات
              </Text>
            </Pressable>
          </View>
        )}

        {/* Service Cards Grid */}
        <View style={styles.cardsGrid}>
          {filteredServices.map((service) => {
            const iconName = getServiceIcon(service.category, service.title);
            const isSpeakingThis = tts.speakingId === `svc-${service.id}`;

            return (
              <View
                key={service.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    borderWidth: colors.borderWidth,
                  },
                ]}
              >
                {/* Card Top */}
                <View>
                  <View style={styles.cardTopRow}>
                    <View
                      style={[
                        styles.cardIconBox,
                        {
                          backgroundColor: colors.bgSurface,
                          borderColor: colors.border,
                          borderWidth: colors.borderWidth,
                        },
                      ]}
                    >
                      <Ionicons name={iconName} size={24} color={colors.textPrimary} />
                    </View>
                    <View
                      style={[
                        styles.categoryBadge,
                        {
                          backgroundColor: colors.bgSurface,
                          borderColor: colors.border,
                          borderWidth: colors.borderWidth,
                        },
                      ]}
                    >
                      <Text style={[styles.categoryBadgeText, { color: colors.textSecondary }]}>
                        {service.category}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                    {service.title}
                  </Text>
                  <Text numberOfLines={2} style={[styles.cardDescription, { color: colors.textSecondary }]}>
                    {service.description}
                  </Text>

                  {service.fees_and_delivery ? (
                    <View
                      style={[
                        styles.feeBadge,
                        {
                          backgroundColor: colors.feeBadgeBg,
                          borderColor: colors.feeBadgeBorder,
                          borderWidth: colors.borderWidth,
                        },
                      ]}
                    >
                      <Ionicons
                        name="cash-outline"
                        size={16}
                        color={colors.feeBadgeText}
                      />
                      <Text style={[styles.feeBadgeText, { color: colors.feeBadgeText }]}>
                        {service.fees_and_delivery}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Big Accessible Buttons */}
                <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
                  <Pressable
                    onPress={() => {
                      stopGlobalTts();
                      router.push(`/(tabs)/services/${service.id}`);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`بدء معاملة ${service.title} بالصوت`}
                    style={({ pressed }) => [
                      styles.primaryVoiceButton,
                      {
                        backgroundColor: colors.btnPrimaryBg,
                        borderColor: colors.border,
                        borderWidth: colors.borderWidth,
                      },
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Ionicons name="mic" size={18} color={colors.btnPrimaryText} />
                    <Text style={[styles.primaryVoiceButtonText, { color: colors.btnPrimaryText }]}>
                      بدء المعاملة صوتياً
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleListenToService(service)}
                    accessibilityRole="button"
                    accessibilityLabel={`استمع لمتطلبات ورسوم خدمة ${service.title}`}
                    style={({ pressed }) => [
                      styles.secondaryListenButton,
                      {
                        backgroundColor: isSpeakingThis ? "#FEF3C7" : colors.btnSecondaryBg,
                        borderColor: isSpeakingThis ? "#F59E0B" : colors.border,
                        borderWidth: colors.borderWidth,
                      },
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Ionicons
                      name={isSpeakingThis ? "pause-circle" : "volume-high-outline"}
                      size={18}
                      color={isSpeakingThis ? "#B45309" : colors.btnSecondaryText}
                    />
                    <Text
                      style={[
                        styles.secondaryListenButtonText,
                        {
                          color: isSpeakingThis ? "#92400E" : colors.btnSecondaryText,
                        },
                      ]}
                    >
                      {isSpeakingThis ? "إيقاف القراءة" : "استمع للمتطلبات والرسوم"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  catalogSection: {
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  container: {
    maxWidth: 1200,
    width: "100%",
    marginHorizontal: "auto",
  },
  headerBox: {
    alignItems: "center",
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: 700,
  },
  categoryTabsRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 32,
  },
  categoryTab: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  categoryTabText: {
    fontSize: 15,
  },
  stateContainer: {
    paddingVertical: 64,
    alignItems: "center",
  },
  stateText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyContainer: {
    borderRadius: 16,
    padding: 36,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: "800",
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: "500",
  },
  resetFilterButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  resetFilterButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  cardsGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 20,
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: 370,
    minWidth: 290,
    borderRadius: 14,
    padding: 20,
    justifyContent: "space-between",
  },
  cardTopRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 6,
    lineHeight: 28,
  },
  cardDescription: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "right",
    lineHeight: 22,
    marginBottom: 14,
  },
  feeBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 16,
  },
  feeBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
    flex: 1,
  },
  cardActions: {
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  primaryVoiceButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  primaryVoiceButtonText: {
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryListenButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  secondaryListenButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
