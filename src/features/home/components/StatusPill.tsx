import React from "react";
import { Text, View } from "react-native";

export function StatusPill() {
  return (
    <View
      className="min-h-[56px] flex-row-reverse items-center gap-3 self-stretch rounded-full border-2 border-line bg-white px-5 py-3"
      accessibilityRole="text"
      accessibilityLabel="النظام جاهز، الصوت والموقع يعملان"
    >
      <View className="h-3.5 w-3.5 rounded-full bg-green-600" />
      <Text className="flex-1 text-right text-lg font-bold text-ink">
        النظام جاهز — الصوت والموقع يعملان
      </Text>
    </View>
  );
}
