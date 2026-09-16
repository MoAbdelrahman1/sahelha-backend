import React from "react";
import { ActivityIndicator, SafeAreaView, StatusBar, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ThemeProvider } from "@/features/theme/ThemeContext";
import { ServiceApplicationScreen } from "@/features/services/ServiceApplicationScreen";

export default function ServiceDetailScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const router = useRouter();

  if (!serviceId) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFFFFF" }}>
        <ActivityIndicator size="large" color="#1D4ED8" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <ServiceApplicationScreen
          serviceId={serviceId}
          onCancel={() => router.back()}
        />
      </SafeAreaView>
    </ThemeProvider>
  );
}
