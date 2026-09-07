import React from "react";
import { Text, View } from "react-native";

import { Container } from "./primitives";

export const Footer = () => {
  return (
    <View className="border-t-2 border-line bg-white">
      <Container>
        <View className="py-8">
          <Text className="text-right text-2xl font-extrabold text-ink">Sahelha Alya</Text>
          <Text className="mt-3 text-right text-lg font-semibold leading-7 text-ink">
            Software built to solve a real problem.
          </Text>
          <View className="mt-6 flex-row-reverse flex-wrap gap-5">
            <Text className="text-lg font-bold text-ink">Features</Text>
            <Text className="text-lg font-bold text-ink">FAQ</Text>
            <Text className="text-lg font-bold text-ink">Contact</Text>
          </View>
        </View>
      </Container>
    </View>
  );
};
