import React from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { VoiceFormWizard } from "@/features/forms/VoiceFormWizard";

export default function ServiceDetailScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const router = useRouter();

  if (!serviceId) {
    return null;
  }

  return (
    <View className="flex-1 bg-white">
      <VoiceFormWizard
        serviceId={serviceId}
        onCancel={() => router.back()}
      />
    </View>
  );
}
