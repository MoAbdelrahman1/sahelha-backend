import React from "react";
import { Text, View, useWindowDimensions } from "react-native";

import { Button } from "@/components/ui/Button";
import { Container, Highlight, Pill, Section } from "./primitives";

// A small mock of the real Document Detail screen (see
// src/app/document/[id]/index.tsx) — not a generic "dashboard" widget. Shows
// exactly what the product actually produces: a plain-Arabic summary and two
// extracted fields, so the hero visual is a truthful preview, not marketing
// filler.
const HeroMockCard = () => {
  return (
    <View className="w-full max-w-[320px] rounded-card bg-white p-4 shadow-sm">
      <View className="rounded-[20px] bg-soft p-4">
        <View className="mb-4 flex-row-reverse items-center justify-between">
          <Text className="text-right font-cairoExtraBold text-base text-ink">بطاقة الرقم القومي</Text>
          <View className="rounded-full bg-primary px-4 py-2">
            <Text className="font-plexBold text-sm text-white">✓ جاهز</Text>
          </View>
        </View>
        <View className="gap-3">
          <View className="flex-row-reverse justify-between">
            <Text className="font-plexBold text-sm text-secondary">الاسم</Text>
            <Text className="font-plexSemiBold text-sm text-ink">محمد أحمد</Text>
          </View>
          <View className="flex-row-reverse justify-between">
            <Text className="font-plexBold text-sm text-secondary">تاريخ الانتهاء</Text>
            <Text className="font-plexSemiBold text-sm text-ink">٢٠٢٧/٠١/٠١</Text>
          </View>
          <View className="flex-row-reverse justify-between">
            <Text className="font-plexBold text-sm text-secondary">التذكير</Text>
            <Text className="font-plexSemiBold text-sm text-ink">✓ متضبط تلقائيًا</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const FloatingStat = ({
  label,
  value,
  style,
}: {
  label: string;
  value: string;
  style?: object;
}) => {
  return (
    <View className="absolute rounded-2xl bg-white p-4 shadow-sm" style={style}>
      <Text className="text-right font-cairoExtraBold text-xl text-ink">{value}</Text>
      <Text className="mt-1 max-w-[130px] text-right font-plexSemiBold text-sm text-secondary">{label}</Text>
    </View>
  );
};

// Real figures from the pitch deck / SAHELHA_DESIGN_BRIEF.md §1 — not
// invented marketing stats.
const STATS = [
  { label: "شخص حول العالم لديهم إعاقة بصرية", value: "+285M" },
  { label: "ناطق بالعربية بلا حل مخصص ليه", value: "+45M" },
  { label: "كلمة محتاج تقراها بنفسك", value: "0" },
];

const HeroVisual = () => {
  const { width } = useWindowDimensions();
  // The real target is a narrow phone screen. The scattered arrangement below
  // only renders past a tablet-ish breakpoint; phones always get the
  // contained, stacked fallback so nothing can overflow the screen edge.
  const isWide = width >= 640;

  if (!isWide) {
    return (
      <View className="mt-10 items-center">
        <HeroMockCard />
        <View className="mt-4 w-full flex-row-reverse flex-wrap gap-3">
          {STATS.map((stat) => (
            <View key={stat.label} className="min-w-[130px] flex-1 rounded-2xl bg-white p-4 shadow-sm">
              <Text className="text-right font-cairoExtraBold text-xl text-ink">{stat.value}</Text>
              <Text className="mt-1 text-right font-plexSemiBold text-sm text-secondary">{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Wide screens (tablet/web preview): scattered floating cards around the
  // central mock, mirrored for RTL (screenshot's left-side cards move to the
  // right, its right-side card moves to the left). Offsets are small fixed
  // pixel values — not percentages — and the wrapper is width-capped and
  // centered, so the scatter stays contained instead of growing unbounded
  // with viewport width.
  return (
    <View className="mt-10 items-center" style={{ minHeight: 420 }}>
      <View style={{ width: "100%", maxWidth: 380, position: "relative", alignItems: "center" }}>
        <HeroMockCard />
        <FloatingStat
          label={STATS[0].label}
          value={STATS[0].value}
          style={{ top: -20, right: -28, width: 160, zIndex: 3, transform: [{ rotate: "-4deg" }] }}
        />
        <FloatingStat
          label={STATS[1].label}
          value={STATS[1].value}
          style={{ bottom: -16, right: -18, width: 160, zIndex: 3, transform: [{ rotate: "3deg" }] }}
        />
        <FloatingStat
          label={STATS[2].label}
          value={STATS[2].value}
          style={{ top: 90, left: -30, width: 150, zIndex: 3, transform: [{ rotate: "-2deg" }] }}
        />
      </View>
    </View>
  );
};

export const Hero = ({ onRegisterPress }: { onRegisterPress: () => void }) => {
  return (
    <View className="overflow-hidden rounded-b-[32px] bg-white">
      <Container>
        <Section className="pt-14">
          <View className="rounded-card bg-soft p-6">
            <Pill>مبني خصيصًا لأصحاب الإعاقة البصرية</Pill>
            <Text className="mt-6 text-right font-cairoBlack text-5xl leading-tight text-ink">
              حوّل مستنداتك الحكومية إلى <Highlight>محادثة صوتية</Highlight>
            </Text>
            <Text className="mt-5 text-right font-plexSemiBold text-xl leading-8 text-ink">
              سهلها عليا مساعد ذكاء اصطناعي بيسمعلك مستنداتك الحكومية، يلخصها بالعربي البسيط، ويرد
              على أسئلتك بصوتك — من غير ما تحتاج تقرا حرف واحد.
            </Text>
            <View className="mt-8 flex-row-reverse flex-wrap gap-4">
              {/* Primary hero CTA — routes into the auth flow (/login) rather
                  than straight into the app, unlike the header/final-CTA
                  "Get Started" buttons which still go to /(tabs). */}
              <Button onPress={onRegisterPress} accessibilityLabel="سجل الآن وابدأ استخدام التطبيق">
                سجل الآن
              </Button>
              <Button variant="secondary" accessibilityLabel="اعرف كيف يعمل التطبيق">
                كيف يعمل؟
              </Button>
            </View>
            <HeroVisual />
          </View>
        </Section>
      </Container>
    </View>
  );
};
