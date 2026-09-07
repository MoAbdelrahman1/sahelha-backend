import React from "react";
import { Text, View } from "react-native";

import { Container, Section } from "./primitives";

export const FounderIntro = () => {
  return (
    <Container>
      <Section>
        <View className="rounded-card bg-soft p-6">
          <View className="mb-5 h-16 w-16 self-end rounded-full bg-brandBlueDeep" />
          <Text className="text-right text-3xl font-extrabold leading-tight text-ink">
            Built by someone who has been there
          </Text>
          <Text className="mt-4 text-right text-xl font-semibold leading-8 text-ink">
            This product is built and maintained by a founder who has faced the
            same challenges you are dealing with today. Every feature exists for
            a reason and nothing is added just to look impressive.
          </Text>
          <Text className="mt-5 text-right text-lg font-bold text-ink">
            Alex Morgan, Founder & CEO
          </Text>
        </View>
      </Section>
    </Container>
  );
};
