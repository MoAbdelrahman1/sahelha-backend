import React from "react";
import { Text, View } from "react-native";

import { Container, Section } from "./primitives";

export const ProblemSolution = () => {
  return (
    <Container>
      <Section>
        <View className="gap-4">
          <View className="rounded-card border-2 border-line bg-white p-6">
            <Text className="text-right font-plexBold text-lg text-ink">المشكلة</Text>
            <Text className="mt-4 text-right font-cairoExtraBold text-4xl leading-tight text-ink">
              المستندات الحكومية عائق حقيقي لغير المبصرين
            </Text>
            <Text className="mt-4 text-right font-plexSemiBold text-xl leading-8 text-ink">
              أكتر من ٢٨٥ مليون شخص حول العالم عندهم إعاقة بصرية، وفيهم أكتر من ٤٥ مليون ناطق
              بالعربية. المستندات الحكومية غالبًا مطبوعة بخط صغير أو بلغة معقدة — وده بيخلّي حاجة
              بسيطة زي معرفة تاريخ انتهاء البطاقة تحدي يومي حقيقي.
            </Text>
          </View>
          <View className="rounded-card bg-primary p-6">
            <Text className="text-right font-plexBold text-lg text-white">الحل</Text>
            <Text className="mt-4 text-right font-cairoExtraBold text-4xl leading-tight text-white">
              مساعد صوتي بيقرا ويشرح ويرد بدل ما تحتاج حد معاك
            </Text>
            <Text className="mt-4 text-right font-plexSemiBold text-xl leading-8 text-white">
              سهلها عليا تصوّر المستند بكاميرا موبايلك، تقراه بالذكاء الاصطناعي، تلخصه بالعربي
              البسيط، وترد على أسئلتك بصوتك — وتفكرك تلقائيًا قبل ما ميعاده يخلص.
            </Text>
          </View>
        </View>
      </Section>
    </Container>
  );
};
