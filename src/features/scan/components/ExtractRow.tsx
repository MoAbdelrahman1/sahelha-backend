import React from "react";
import { Text, View } from "react-native";

type ExtractRowProps = {
  label: string;
  showDivider: boolean;
};

// Informational row, not a button — a bullet dot + bold label, with an
// optional bottom divider so a list of these reads as one grouped card.
export function ExtractRow({ label, showDivider }: ExtractRowProps) {
  return (
    <View
      className={`min-h-[56px] flex-row-reverse items-center gap-3 py-4 ${
        showDivider ? "border-b-2 border-line" : ""
      }`}
    >
      <View className="h-3 w-3 rounded-full bg-brandBlueDeep" />
      <Text className="flex-1 text-right text-lg font-bold text-ink">{label}</Text>
    </View>
  );
}
