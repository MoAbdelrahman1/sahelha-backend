import React from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ServiceApplicationScreen } from "@/features/services/ServiceApplicationScreen";

export default function ServiceDetailScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const router = useRouter();

  if (!serviceId) {
    return null;
  }

  return (
    <View className="flex-1 bg-white">
      <ServiceApplicationScreen
        serviceId={serviceId}
        onCancel={() => router.back()}
      />
    </View>
  );
}
