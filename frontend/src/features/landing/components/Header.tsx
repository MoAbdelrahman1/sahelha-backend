import React from "react";
import { Text, View, useWindowDimensions } from "react-native";

import { Button } from "@/components/ui/Button";
import { Container } from "./primitives";

export const Header = ({ onGetStarted }: { onGetStarted: () => void }) => {
  // The nav links are decorative labels (no scroll-to-section wired up yet),
  // so on a phone-width screen they're the first thing to drop — keeping the
  // brand name and CTA button both fully legible matters more than showing
  // "المميزات"/"الأسئلة الشائعة" here (see [[Features]]/[[FAQ]] below for the
  // real sections). Mirrors Hero's manual width-based branching since this
  // app doesn't otherwise rely on NativeWind responsive prefixes.
  const { width } = useWindowDimensions();
  const isWide = width >= 420;

  return (
    <View className="border-b-2 border-line bg-white">
      <Container>
        <View className="flex-row-reverse items-center justify-between py-4">
          <Text className="font-cairoExtraBold text-xl text-ink">سهلها عليا</Text>
          {isWide ? (
            <View className="flex-row-reverse items-center gap-6">
              <Text className="font-plexBold text-lg text-ink">المميزات</Text>
              <Text className="font-plexBold text-lg text-ink">الأسئلة الشائعة</Text>
            </View>
          ) : null}
          <Button variant="secondary" onPress={onGetStarted} accessibilityLabel="ادخل على التطبيق">
            الدخول
          </Button>
        </View>
      </Container>
    </View>
  );
};
