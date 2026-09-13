import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Container, Highlight, Section } from "./primitives";

type FAQItemProps = {
  question: string;
  answer: string;
};

const FAQItem = ({ question, answer }: FAQItemProps) => {
  const [open, setOpen] = useState(false);
  return (
    <View className="rounded-2xl border-2 border-line bg-white">
      <Pressable
        onPress={() => setOpen((value) => !value)}
        className="min-h-[56px] flex-row-reverse items-center justify-between gap-4 p-5"
        accessibilityRole="button"
        accessibilityLabel={question}
        accessibilityState={{ expanded: open }}
      >
        <Text className="flex-1 text-right font-plexBold text-xl text-ink">{question}</Text>
        <Text className="font-cairoExtraBold text-3xl text-primary">{open ? "−" : "+"}</Text>
      </Pressable>
      {open ? (
        <View className="px-5 pb-5">
          <Text className="text-right font-plexSemiBold text-lg leading-7 text-ink">{answer}</Text>
        </View>
      ) : null}
    </View>
  );
};

export const FAQ = () => {
  const items = [
    {
      question: "هل التطبيق شغال مع قارئ الشاشة لغير المبصرين؟",
      answer:
        "أيوة. كل شاشة في التطبيق شغالة مع قارئ الشاشة (TalkBack/VoiceOver)، وتقدر تستخدم التطبيق بالكامل بصوتك من غير ما تحتاج تشوف الشاشة.",
    },
    {
      question: "مستنداتي وبياناتي آمنة؟",
      answer:
        "مستنداتك مربوطة بحسابك بس، ومحدش يشوفها غيرك إلا لو شاركتها بنفسك عن طريق كود QR أو رابط المشاركة.",
    },
    {
      question: "محتاج إنترنت عشان استخدم التطبيق؟",
      answer:
        "أيوة، محتاج اتصال إنترنت عشان تصوير وتحليل المستندات وسؤال المساعد الصوتي، لأن القراءة والتلخيص بيحصلوا على السيرفر.",
    },
    {
      question: "بيشتغل مع أنهي أنواع مستندات؟",
      answer:
        "بطاقة الرقم القومي، شهادة الميلاد، جواز السفر، فاتورة المرافق، وأنواع تانية من المستندات الحكومية والرسمية.",
    },
    {
      question: "التطبيق مجاني؟",
      answer: "أيوة، سهلها عليا مجاني للاستخدام بالكامل.",
    },
  ];
  return (
    <Container>
      <Section>
        <Text className="text-right font-plexBold text-lg text-ink">الأسئلة الشائعة</Text>
        <Text className="mt-3 text-right font-cairoExtraBold text-5xl leading-tight text-ink">
          إجابات على <Highlight>أسئلتك</Highlight> الحقيقية
        </Text>
        <View className="mt-8 gap-3">
          {items.map((item) => (
            <FAQItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </View>
      </Section>
    </Container>
  );
};
