import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type ExtractRowProps = {
  label: string;
  value: string;
  showDivider: boolean;
  onSpeakerPress: () => void;
  speakerAccessibilityLabel: string;
};

// Row = bullet dot + label/value + a speaker button. The row itself is a
// plain View (not a Pressable) — only the speaker button is interactive, so
// there's no touch-handling conflict between "the row" and "the speaker
// button" to arbitrate.
export function ExtractRow({
  label,
  value,
  showDivider,
  onSpeakerPress,
  speakerAccessibilityLabel,
}: ExtractRowProps) {
  return (
    <View
      className={`min-h-[56px] flex-row-reverse items-center gap-3 py-4 ${
        showDivider ? "border-b-2 border-line" : ""
      }`}
    >
      <View className="h-3 w-3 rounded-full bg-brandBlueDeep" />
      <View className="flex-1">
        <Text className="text-right text-lg font-bold text-ink">{label}</Text>
        <Text className="mt-1 text-right text-base font-semibold text-ink">{value}</Text>
      </View>
      <Pressable
        onPress={onSpeakerPress}
        accessibilityRole="button"
        accessibilityLabel={speakerAccessibilityLabel}
        className="h-14 w-14 items-center justify-center rounded-full active:opacity-70"
      >
        <Ionicons name="volume-high-outline" size={24} color="#2563EB" />
      </Pressable>
    </View>
  );
}
