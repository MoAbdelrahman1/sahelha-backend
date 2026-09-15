import React from "react";
import { Image, Platform, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type CameraPreviewPlaceholderProps = {
  photoUri?: string | null;
  isPdf?: boolean;
  fileName?: string | null;
};

export function CameraPreviewPlaceholder({ photoUri, isPdf, fileName }: CameraPreviewPlaceholderProps) {
  if (photoUri) {
    const isPdfDoc =
      Boolean(isPdf) ||
      photoUri.toLowerCase().endsWith(".pdf") ||
      photoUri.toLowerCase().includes(".pdf?") ||
      photoUri.startsWith("data:application/pdf");

    return (
      <View
        style={{
          width: "100%",
          height: 280,
          minHeight: 280,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderRadius: 16,
          borderWidth: 2,
          borderColor: "#CBD5E1",
          backgroundColor: "#F8FAFC",
        }}
      >
        {isPdfDoc ? (
          <View style={{ alignItems: "center", justifyContent: "center", padding: 24, gap: 10 }}>
            <Ionicons name="document-text" size={72} color="#DC2626" />
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#0F172A", textAlign: "center" }}>
              {fileName || "مستند PDF"}
            </Text>
            <View style={{ backgroundColor: "#DCFCE7", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#15803D" }}>
                ✓ مستند PDF جاهز للتحليل
              </Text>
            </View>
          </View>
        ) : Platform.OS === "web" ? (
          <img
            src={photoUri}
            alt="صورة المستند"
            style={{
              width: "100%",
              height: "280px",
              objectFit: "contain",
              display: "block",
            }}
          />
        ) : (
          <Image
            source={{ uri: photoUri }}
            style={{ width: "100%", height: 280 }}
            resizeMode="contain"
            accessibilityLabel="صورة المستند التي تم التقاطها"
          />
        )}
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
