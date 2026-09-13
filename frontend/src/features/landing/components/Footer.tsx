import React from "react";
import { Text, View } from "react-native";

import { Container } from "./primitives";

export const Footer = () => {
  return (
    <View className="border-t-2 border-line bg-white">
      <Container>
        <View className="py-8">
          <Text className="text-right font-cairoExtraBold text-2xl text-ink">سهلها عليا</Text>
          <Text className="mt-3 text-right font-plexSemiBold text-lg leading-7 text-ink">
            مساعد ذكاء اصطناعي بيسهّل عليك التعامل مع مستنداتك الحكومية بصوتك.
          </Text>
          <View className="mt-6 flex-row-reverse flex-wrap gap-5">
            <Text className="font-plexBold text-lg text-ink">المميزات</Text>
            <Text className="font-plexBold text-lg text-ink">الأسئلة الشائعة</Text>
            <Text className="font-plexBold text-lg text-ink">تواصل معانا</Text>
          </View>
        </View>
      </Container>
    </View>
  );
};
