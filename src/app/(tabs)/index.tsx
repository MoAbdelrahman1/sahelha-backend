import React from "react";
import { ScrollView, Text, View } from "react-native";

import { HomeHeader } from "@/features/home/components/HomeHeader";
import { StatusPill } from "@/features/home/components/StatusPill";
import { VoiceButton } from "@/features/home/components/VoiceButton";
import { FeatureCard } from "@/features/home/components/FeatureCard";
import { HOME_FEATURES } from "@/features/home/data";

// Landing tab of the (tabs) group — login/register both `router.replace("/(tabs)")`
// on success, and this "index" route is what that bare group path resolves to.
//
// RTL note: hand-mirrored (row-reverse containers + right-aligned text) like
// the rest of the app, not via I18nManager.
export default function HomeScreen() {
  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 24 }}
    >
      <HomeHeader />

      <StatusPill />

      <VoiceButton
        // TODO: wire to the real voice-assistant flow once it exists.
        onPress={() => {}}
      />

      <View>
        <Text className="mb-4 text-right text-3xl font-extrabold text-ink">
          الميزات الرئيسية
        </Text>

        <View style={{ gap: 16 }}>
          {HOME_FEATURES.map((feature) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              // TODO: navigate to this feature's screen once it exists.
              onPress={() => {}}
            />
          ))}
        </View>
      </View>

      <Text className="text-center text-lg font-semibold text-ink">
        اضغط مطولاً على أي زر لسماع وصفه
      </Text>
    </ScrollView>
  );
}
