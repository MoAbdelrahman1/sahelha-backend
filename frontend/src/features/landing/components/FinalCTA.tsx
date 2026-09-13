import React from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Container, Section } from "./primitives";

export const FinalCTA = ({ onGetStarted }: { onGetStarted: () => void }) => {
  return (
    <Container>
      <Section>
        <View className="rounded-card bg-primary p-6">
          <Text className="text-right font-cairoBlack text-5xl leading-tight text-white">
            جاهز تتعامل مع مستنداتك بنفسك؟
          </Text>
          <Text className="mt-5 text-right font-plexSemiBold text-xl leading-8 text-white">
            سجل دلوقتي وابدأ تصوّر، تسمع، وتسأل عن مستنداتك الحكومية بصوتك.
          </Text>
          <View className="mt-8 items-end">
            <Button variant="dark" onPress={onGetStarted} accessibilityLabel="ابدأ استخدام التطبيق">
              ابدأ دلوقتي
            </Button>
          </View>
        </View>
      </Section>
    </Container>
  );
};
