import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export function VoiceButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="تحدث مع سهلها عليا"
      className="min-h-[96px] w-full flex-row-reverse items-center justify-center gap-3 rounded-card bg-brandBlueDeep px-6 py-6 active:opacity-80"
    >
      <View className="h-12 w-12 items-center justify-center rounded-full bg-white/15">
        <Ionicons name="mic" size={30} color="#FFFFFF" />
      </View>
      <Text className="text-2xl font-extrabold text-white">تحدث مع سهلها عليا</Text>
    </Pressable>
  );
}
