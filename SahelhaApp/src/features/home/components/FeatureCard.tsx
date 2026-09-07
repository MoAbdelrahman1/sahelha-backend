import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { HomeFeature } from "../data";

type FeatureCardProps = {
  feature: HomeFeature;
  onPress: () => void;
};

// Single reusable card — the Home screen maps HOME_FEATURES over this rather
// than hand-writing 7 near-identical blocks.
export function FeatureCard({ feature, onPress }: FeatureCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${feature.title}. ${feature.subtitle}`}
      className="min-h-[88px] flex-row-reverse items-center gap-4 rounded-card border-2 border-line bg-white p-4 active:opacity-80"
    >
      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brandBlueDeep">
        <Ionicons name={feature.icon} size={30} color="#FFFFFF" />
      </View>

      <View className="flex-1">
        <Text className="text-right text-xl font-extrabold text-ink">{feature.title}</Text>
        <Text className="mt-1 text-right text-base font-semibold leading-6 text-ink">
          {feature.subtitle}
        </Text>
      </View>

      <Ionicons name="chevron-back" size={24} color="#2563EB" />
    </Pressable>
  );
}
