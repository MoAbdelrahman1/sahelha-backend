import React from "react";
import { Text, View } from "react-native";

import { Container } from "./primitives";

export const TrustedBy = () => {
  const logos = ["Horizon", "Bolt", "Atlas", "Luma"];
  return (
    <Container>
      <View className="pb-10">
        <Text className="mb-4 text-right text-lg font-bold text-ink">Trusted by:</Text>
        <View className="flex-row-reverse flex-wrap gap-3">
          {logos.map((logo) => (
            <View key={logo} className="rounded-full border-2 border-line bg-white px-5 py-3">
              <Text className="text-lg font-bold text-ink">{logo}</Text>
            </View>
          ))}
        </View>
      </View>
    </Container>
  );
};
