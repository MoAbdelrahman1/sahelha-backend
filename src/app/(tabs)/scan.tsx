import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { CameraPreviewPlaceholder } from "@/features/scan/components/CameraPreviewPlaceholder";
import { ExtractRow } from "@/features/scan/components/ExtractRow";
import { SCAN_EXTRACT_ITEMS } from "@/features/scan/data";

// Feature 1 — مسح المستندات الذكي. UI only for now: no camera/permissions
// integration, no upload call, no results screen (that follows once the
// backend contract for /documents/upload is confirmed).
//
// RTL note: hand-mirrored (row-reverse containers + right-aligned text) like
// the rest of the app, not via I18nManager.
export default function ScanScreen() {
  const router = useRouter();

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 24 }}
    >
      <View className="flex-row-reverse items-center gap-4">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="رجوع"
          className="h-14 w-14 items-center justify-center rounded-full border-2 border-line bg-white active:opacity-80"
        >
          <Ionicons name="arrow-forward" size={26} color="#000000" />
        </Pressable>

        <View className="flex-1">
          <Text className="text-right text-3xl font-extrabold text-ink">
            تصوير المستندات وتلخيصها
          </Text>
          <Text className="mt-1 text-right text-lg font-bold text-ink">
            صوّر أي مستند واسمع أهم المعلومات فيه
          </Text>
        </View>
      </View>

      <CameraPreviewPlaceholder />

      <Pressable
        onPress={() => {
          // TODO: capture the photo with expo-camera and POST it to
          // /documents/upload once the backend contract is confirmed.
        }}
        accessibilityRole="button"
        accessibilityLabel="صوّر المستند"
        className="min-h-[64px] w-full flex-row-reverse items-center justify-center gap-3 rounded-card bg-brandBlueDeep px-6 py-5 active:opacity-80"
      >
        <Ionicons name="camera" size={28} color="#FFFFFF" />
        <Text className="text-2xl font-extrabold text-white">صوّر المستند</Text>
      </Pressable>

      <View>
        <Text className="mb-2 text-right text-lg font-extrabold text-ink">يستخرج تلقائياً</Text>
        <View className="rounded-card border-2 border-line bg-white px-4">
          {SCAN_EXTRACT_ITEMS.map((item, index) => (
            <ExtractRow
              key={item.id}
              label={item.label}
              showDivider={index < SCAN_EXTRACT_ITEMS.length - 1}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
