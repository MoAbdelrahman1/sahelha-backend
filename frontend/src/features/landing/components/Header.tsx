import React from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Container } from "./primitives";

export const Header = ({ onGetStarted }: { onGetStarted: () => void }) => {
  return (
    <View className="border-b-2 border-line bg-white">
      <Container>
        <View className="flex-row-reverse items-center justify-between py-4">
          <Text className="text-xl font-extrabold text-ink">Sahelha Alya</Text>
          <View className="flex-row-reverse items-center gap-6">
            <Text className="text-lg font-bold text-ink">Features</Text>
            <Text className="text-lg font-bold text-ink">FAQ</Text>
          </View>
          <Button variant="secondary" onPress={onGetStarted}>
            Get Started
          </Button>
        </View>
      </Container>
    </View>
  );
};
