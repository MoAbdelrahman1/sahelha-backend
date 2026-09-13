import React from "react";
import { Text, View } from "react-native";

import { Container, Highlight, Section } from "./primitives";

type LandingFeatureCardProps = {
  title: string;
  description: string;
  comingSoon?: boolean;
};

const LandingFeatureCard = ({ title, description, comingSoon }: LandingFeatureCardProps) => {
  return (
    <View className="rounded-card border-2 border-line bg-white p-5">
      <View className="mb-5 flex-row-reverse items-center justify-between">
        <View className="h-10 w-10 rounded-2xl bg-primary" />
        {comingSoon ? (
          <View className="rounded-full bg-surface px-3 py-1">
            <Text className="font-plexBold text-xs text-secondary">قريبًا</Text>
          </View>
        ) : null}
      </View>
      <Text className="text-right font-cairoExtraBold text-2xl text-ink">{title}</Text>
      <Text className="mt-3 text-right font-plexSemiBold text-lg leading-7 text-ink">{description}</Text>
    </View>
  );
};

// Matches the real, shippable feature set from backend/SPRINT_PLAN.md §6 —
// the last two are explicitly cut this sprint and marked "قريبًا" rather than
// promising a flow that doesn't exist yet.
export const Features = () => {
  const features: LandingFeatureCardProps[] = [
    {
      title: "مسح وتحليل فوري",
      description: "صوّر أي مستند حكومي والذكاء الاصطناعي يقراه ويلخصه لك بالعربي البسيط في ثواني.",
    },
    {
      title: "تذكيرات تلقائية",
      description: "لو المستند ليه تاريخ انتهاء، سهلها عليا تسجل تذكير تلقائي وتنبهك قبل ما ينتهي.",
    },
    {
      title: "اسأل بصوتك",
      description: "اسأل أي سؤال عن مستندك بصوتك واسمع الإجابة بصوت واضح، زي ما تكلم حد بيساعدك.",
    },
    {
      title: "أرشيف قابل للبحث",
      description: "كل مستنداتك في مكان واحد، وتقدر تدور عليها بالكتابة أو بصوتك.",
    },
    {
      title: "مشاركة بكود QR",
      description: "شارك مستندك مع حد تثق فيه بكود QR أو رابط، من غير ما تكشف بياناتك لحد تاني.",
    },
    {
      title: "أقرب مكتب حكومي",
      description: "اعرف أقرب مكتب للخدمة اللي محتاجها، بالعنوان والمسافة ورقم التليفون.",
    },
    {
      title: "إعدادات وصول كاملة",
      description: "تكبير الخط، تباين عالي، وضع ليلي، وسرعة الصوت — كله في إيدك من الإعدادات.",
    },
    {
      title: "تعبئة النماذج بالصوت",
      description: "قول بياناتك بصوتك والتطبيق يملالك النموذج الحكومي.",
      comingSoon: true,
    },
    {
      title: "الإرشاد جوه المصالح الحكومية",
      description: "خرايط داخلية توصلك لشباك الخدمة جوه المبنى.",
      comingSoon: true,
    },
  ];
  return (
    <Container>
      <Section>
        <Text className="text-right font-plexBold text-lg text-ink">المميزات</Text>
        <Text className="mt-3 text-right font-cairoExtraBold text-5xl leading-tight text-ink">
          كل حاجة محتاجها عشان تتعامل <Highlight>مع مستنداتك بنفسك</Highlight>
        </Text>
        <Text className="mt-4 text-right font-plexSemiBold text-xl leading-8 text-ink">
          مصممة عشان تشتغل بصوتك بالكامل، من غير ما تحتاج تشوف الشاشة.
        </Text>
        <View className="mt-8 gap-4">
          {features.map((feature) => (
            <LandingFeatureCard
              key={feature.title}
              title={feature.title}
              description={feature.description}
              comingSoon={feature.comingSoon}
            />
          ))}
        </View>
      </Section>
    </Container>
  );
};
