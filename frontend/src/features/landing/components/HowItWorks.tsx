import React from "react";
import { Text, View } from "react-native";

import { Container, Highlight, Section } from "./primitives";

type StepCardProps = {
  number: string;
  title: string;
  description: string;
};

const StepCard = ({ number, title, description }: StepCardProps) => {
  return (
    <View className="rounded-card bg-soft p-6">
      <View className="mb-5 h-14 w-14 items-center justify-center self-end rounded-full bg-primary">
        <Text className="font-cairoExtraBold text-xl text-white">{number}</Text>
      </View>
      <Text className="text-right font-cairoExtraBold text-2xl text-ink">{title}</Text>
      <Text className="mt-3 text-right font-plexSemiBold text-lg leading-7 text-ink">{description}</Text>
    </View>
  );
};

export const HowItWorks = () => {
  const steps = [
    {
      number: "١",
      title: "صوّر المستند",
      description: "وجّه كاميرا موبايلك نحو المستند الحكومي وصوره، أو اختار صورة جاهزة من المعرض.",
    },
    {
      number: "٢",
      title: "الذكاء الاصطناعي يقراه",
      description: "سهلها عليا تقرا النص، تلخصه بالعربي البسيط، وتطلع منه التواريخ والبيانات المهمة.",
    },
    {
      number: "٣",
      title: "اسمع واسأل",
      description: "استمع للملخص بصوت واضح، واسأل أي سؤال إضافي عن المستند بصوتك.",
    },
    {
      number: "٤",
      title: "احفظ وتذكّر",
      description: "المستند يتحفظ في أرشيفك، وتوصلك تذكيرات تلقائية قبل ما ميعاده يخلص.",
    },
  ];
  return (
    <Container>
      <Section>
        <Text className="text-right font-plexBold text-lg text-ink">إزاي بيشتغل</Text>
        <Text className="mt-3 text-right font-cairoExtraBold text-5xl leading-tight text-ink">
          من الصورة <Highlight>للإجابة</Highlight> في أربع خطوات
        </Text>
        <View className="mt-8 gap-4">
          {steps.map((step) => (
            <StepCard key={step.number} number={step.number} title={step.title} description={step.description} />
          ))}
        </View>
      </Section>
    </Container>
  );
};
