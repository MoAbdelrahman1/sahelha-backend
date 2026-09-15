import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";

import { useTtsPlayer, stopGlobalTts } from "@/features/voice/useTtsPlayer";
import { fetchServices, type GovernmentService } from "@/features/services/api";

const CATEGORIES = [
  { id: "all", label: "الكل" },
  { id: "civil", label: "الأحوال المدنية", keyword: "الأحوال" },
  { id: "traffic", label: "المرور والسيارات", keyword: "مركباتي" },
  { id: "notary", label: "التوثيق والشهر العقاري", keyword: "التوثيق" },
  { id: "taxes", label: "الضرائب والتجارة", keyword: "الضرائب" },
  { id: "supply", label: "التموين", keyword: "التموين" },
];

function getServiceIcon(category: string, title: string): keyof typeof Ionicons.glyphMap {
  if (title.includes("زواج") || title.includes("طلاق")) return "heart-outline";
  if (title.includes("ميلاد") || title.includes("وفاة")) return "people-outline";
  if (category.includes("مركباتي") || title.includes("رخصة") || title.includes("قيادة")) return "car-outline";
  if (category.includes("التوثيق") || title.includes("توكيل") || title.includes("عقد")) return "shield-checkmark-outline";
  if (category.includes("الضرائب") || category.includes("تجاري")) return "briefcase-outline";
  if (category.includes("التموين")) return "basket-outline";
  return "document-text-outline";
}

export default function ServicesScreen() {
  const router = useRouter();
  const [services, setServices] = useState<GovernmentService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const tts = useTtsPlayer();

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchServices();
        if (isMounted) {
          setServices(data);
        }
      } catch (err) {
        console.warn("Failed to fetch services:", err);
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
    const fees = item.fees_and_delivery ? `الرسوم: ${item.fees_and_delivery}` : "";
    const speechText = `خدمة ${item.title}. ${item.description || ""} ${docs} ${fees}`;
    tts.speakTextContent(speechText, `svc-${item.id}`);
  };

  const filteredServices = services.filter((svc) => {
    const matchesSearch =
      searchQuery.trim() === "" ||
      svc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (svc.description && svc.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (selectedCategory === "all") return true;
    const cat = CATEGORIES.find((c) => c.id === selectedCategory);
    if (!cat?.keyword) return true;
    return (
      svc.category.includes(cat.keyword) ||
      svc.title.includes(cat.keyword)
    );
  });

  const renderServiceCard = ({ item }: { item: GovernmentService }) => {
    const iconName = getServiceIcon(item.category, item.title);
    const isSpeakingThis = tts.speakingId === `svc-${item.id}`;

    return (
      <View className="mb-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        {/* Top Title & Icon */}
        <View className="flex-row-reverse items-center justify-between mb-3">
          <View className="flex-row-reverse items-center gap-3 flex-1">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
              <Ionicons name={iconName} size={26} color="#1D4ED8" />
            </View>
            <View className="flex-1">
              <Text className="text-right text-lg font-black text-gray-900 leading-snug">
                {item.title}
              </Text>
              <Text className="text-right text-xs font-bold text-gray-400 mt-0.5">
                {item.category}
              </Text>
            </View>
          </View>
        </View>

        {/* Short Description */}
        {item.description ? (
          <Text className="text-right text-sm font-semibold text-gray-600 leading-relaxed mb-4" numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {/* Fees Badge */}
        {item.fees_and_delivery ? (
          <View className="mb-4 rounded-xl bg-gray-50 p-2.5 flex-row-reverse items-center gap-2">
            <Ionicons name="cash-outline" size={16} color="#4B5563" />
            <Text className="text-right text-xs font-bold text-gray-600 flex-1" numberOfLines={1}>
              {item.fees_and_delivery}
            </Text>
          </View>
        ) : null}

        {/* Actions for Low-Vision Accessibility */}
        <View className="flex-row-reverse items-center gap-2 pt-2 border-t border-gray-100">
          {/* Audio Explanation Button */}
          <Pressable
            onPress={() => handleListenToService(item)}
            accessibilityRole="button"
            accessibilityLabel={`استمع لتفاصيل ومستندات خدمة ${item.title}`}
            className="h-12 flex-row-reverse items-center gap-1.5 rounded-xl bg-blue-50 px-3.5 border border-blue-200 active:opacity-80"
          >
            <Ionicons
              name={isSpeakingThis ? "volume-high" : "volume-medium"}
              size={20}
              color="#1D4ED8"
            />
            <Text className="text-xs font-black text-brandBlueDeep">
              {isSpeakingThis ? "جارٍ القراءة…" : "استمع للمتطلبات"}
            </Text>
          </Pressable>

          {/* Start Application Voice Wizard Button */}
          <Pressable
            onPress={() => {
              stopGlobalTts();
              router.push(`/(tabs)/services/${item.id}`);
            }}
            accessibilityRole="button"
            accessibilityLabel={`بدء التقديم الصوتي على خدمة ${item.title}`}
            className="flex-1 h-12 flex-row-reverse items-center justify-center gap-2 rounded-xl bg-brandBlueDeep active:opacity-85 shadow-sm"
          >
            <Ionicons name="mic-outline" size={18} color="#FFFFFF" />
            <Text className="text-sm font-black text-white">التقديم بالصوت</Text>
            <Ionicons name="chevron-back" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="border-b border-gray-200 bg-white px-5 pt-10 pb-4 shadow-sm">
        <View className="flex-row-reverse items-center justify-between mb-4">
          <View>
            <Text className="text-right text-2xl font-black text-gray-900">
              دليل الخدمات الحكومية
            </Text>
            <Text className="text-right text-xs font-bold text-gray-500 mt-0.5">
              مصر الرقمية — تقديم صوتي ميسر لضعاف البصر
            </Text>
          </View>
          <Link href="/chat" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="التحدث المباشر مع المساعد الصوتي"
              className="h-10 w-10 items-center justify-center rounded-full bg-blue-50 border border-blue-200"
            >
              <Ionicons name="mic" size={20} color="#1D4ED8" />
            </Pressable>
          </Link>
        </View>

        {/* High-Contrast Search Bar */}
        <View className="flex-row-reverse items-center gap-2.5 rounded-2xl border-2 border-gray-200 bg-gray-50 px-3.5 py-2">
          <Ionicons name="search" size={20} color="#6B7280" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="ابحث باسم الخدمة (مثل: زواج، ميلاد، رخصة…)"
            placeholderTextColor="#9CA3AF"
            className="flex-1 text-right text-base font-bold text-gray-900"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </Pressable>
          ) : null}
        </View>

        {/* Categories Horizontal Scroll */}
        <View className="mt-3">
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={CATEGORIES}
            keyExtractor={(cat) => cat.id}
            contentContainerStyle={{ flexDirection: "row-reverse", gap: 8 }}
            renderItem={({ item: cat }) => {
              const isActive = selectedCategory === cat.id;
              return (
                <Pressable
                  onPress={() => setSelectedCategory(cat.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`تصنيف ${cat.label}`}
                  className={`rounded-full px-4 py-2 border ${
                    isActive
                      ? "bg-brandBlueDeep border-brandBlueDeep"
                      : "bg-white border-gray-300"
                  }`}
                >
                  <Text
                    className={`text-xs font-extrabold ${
                      isActive ? "text-white" : "text-gray-700"
                    }`}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      </View>

      {/* Services List */}
      {loading ? (
        <View className="flex-1 items-center justify-center p-6">
          <ActivityIndicator size="large" color="#1D4ED8" />
          <Text className="mt-3 text-base font-bold text-gray-600">
            جارٍ تحميل دليل الخدمات…
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredServices}
          keyExtractor={(item) => item.id}
          renderItem={renderServiceCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <Ionicons name="search-outline" size={48} color="#9CA3AF" />
              <Text className="mt-3 text-center text-lg font-bold text-gray-500">
                لم يتم العثور على خدمات مطابقة للبحث
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
