import React from "react";
import { Image, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type CameraPreviewPlaceholderProps = {
  photoUri?: string | null;
};

// Empty state: camera icon + instructional copy. Once a photo is captured,
// the SAME box shows that photo instead — deliberately no live camera
// preview/viewfinder here (see scan.tsx for why: a live viewfinder is
// useless to a blind user, so this app uses the system camera via
// expo-image-picker rather than a custom expo-camera preview).
export function CameraPreviewPlaceholder({ photoUri }: CameraPreviewPlaceholderProps) {
  if (photoUri) {
    return (
      <View className="min-h-[280px] items-center justify-center overflow-hidden rounded-card border-2 border-line bg-soft">
        <Image
          source={{ uri: photoUri }}
          className="h-[280px] w-full"
          resizeMode="cover"
          // TODO(Asma): confirm final Arabic copy.
          accessibilityLabel="صورة المستند التي تم التقاطها"
        />
      </View>
    );
  }

  return (
    <View className="min-h-[280px] items-center justify-center rounded-card border-2 border-line bg-soft p-6">
      <Ionicons name="camera-outline" size={56} color="#2563EB" />
      <Text className="mt-4 text-center text-xl font-extrabold text-ink">
        وجّه الكاميرا نحو المستند
      </Text>
    </View>
  );
}
