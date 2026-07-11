import React from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Container, Section } from "./primitives";

export const FinalCTA = ({ onGetStarted }: { onGetStarted: () => void }) => {
  return (
    <Container>
      <Section>
        <View className="rounded-card bg-brandBlueDeep p-6">
          <Text className="text-right text-6xl font-extrabold leading-tight text-white">
            Work with more focus and less friction
          </Text>
          <Text className="mt-5 text-right text-xl font-semibold leading-8 text-white">
            Start with a product that respects your time, your work, and your users.
          </Text>
          <View className="mt-8 items-end">
            <Button variant="dark" onPress={onGetStarted}>
              Get Started
            </Button>
          </View>
        </View>
      </Section>
    </Container>
  );
};
