import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Placeholder only — no expo-camera / permissions integration yet.
export function CameraPreviewPlaceholder() {
  return (
    <View className="min-h-[280px] items-center justify-center rounded-card border-2 border-line bg-soft p-6">
      {/* TODO: mount the live expo-camera preview (<CameraView>) here once
          camera integration + permissions handling is wired up. This whole
          placeholder block gets replaced by that. */}
      <Ionicons name="camera-outline" size={56} color="#2563EB" />
      <Text className="mt-4 text-center text-xl font-extrabold text-ink">
        وجّه الكاميرا نحو المستند
      </Text>
    </View>
  );
}
