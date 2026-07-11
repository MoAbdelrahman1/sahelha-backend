import React from "react";
import { Text, View, useWindowDimensions } from "react-native";

import { Button } from "@/components/ui/Button";
import { Container, Highlight, Pill, Section } from "./primitives";

// Central "app mock" card reused by both the wide (scattered) and narrow
// (stacked) hero visual layouts below.
const HeroMockCard = () => {
  return (
    <View className="w-full max-w-[320px] rounded-card bg-white p-4 shadow-sm">
      <View className="rounded-[20px] bg-soft p-4">
        <View className="mb-4 flex-row-reverse items-center justify-between">
          <View>
            <Text className="text-right text-base font-bold text-ink">Workspace health</Text>
            <Text className="mt-1 text-right text-2xl font-bold text-ink">94%</Text>
          </View>
          <View className="rounded-full bg-brandBlueDeep px-4 py-2">
            <Text className="text-base font-bold text-white">Live</Text>
          </View>
        </View>
        <View className="gap-3">
          {/* items-end (instead of flex-row-reverse) mirrors the fill to the
              right edge — these tracks are column containers by default, so
              the fill's horizontal position is a cross-axis alignment, not a
              row direction. */}
          <View className="h-3 w-full items-end rounded-full bg-black/10">
            <View className="h-3 w-[82%] rounded-full bg-brandBlueDeep" />
          </View>
          <View className="h-3 w-full items-end rounded-full bg-black/10">
            <View className="h-3 w-[64%] rounded-full bg-brandBlue" />
          </View>
          <View className="h-3 w-full items-end rounded-full bg-black/10">
            <View className="h-3 w-[74%] rounded-full bg-brandBlueDeep" />
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
      <Text className="text-right text-base font-bold text-ink">{label}</Text>
      <Text className="mt-1 text-right text-xl font-bold text-ink">{value}</Text>
    </View>
  );
};

const HeroVisual = () => {
  const { width } = useWindowDimensions();
  // The real target is a narrow phone screen. The scattered arrangement below
  // only renders past a tablet-ish breakpoint; phones always get the
  // contained, stacked fallback so nothing can overflow the screen edge.
  const isWide = width >= 640;

  if (!isWide) {
    const stats = [
      { label: "Saved time", value: "12h" },
      { label: "Tasks closed", value: "328" },
      { label: "Faster delivery", value: "+64%" },
    ];
    return (
      <View className="mt-10 items-center">
        <HeroMockCard />
        <View className="mt-4 w-full flex-row-reverse flex-wrap gap-3">
          {stats.map((stat) => (
            <View
              key={stat.label}
              className="min-w-[130px] flex-1 rounded-2xl bg-white p-4 shadow-sm"
            >
              <Text className="text-right text-base font-bold text-ink">{stat.label}</Text>
              <Text className="mt-1 text-right text-xl font-bold text-ink">{stat.value}</Text>
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
          label="Saved time"
          value="12h"
          style={{ top: -20, right: -28, width: 150, zIndex: 3, transform: [{ rotate: "-4deg" }] }}
        />
        <FloatingStat
          label="Tasks closed"
          value="328"
          style={{ bottom: -16, right: -18, width: 160, zIndex: 3, transform: [{ rotate: "3deg" }] }}
        />
        <FloatingStat
          label="Faster delivery"
          value="+64%"
          style={{ top: 90, left: -30, width: 160, zIndex: 3, transform: [{ rotate: "-2deg" }] }}
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
          <View className="rounded-card bg-[rgba(37,99,235,0.08)] p-6">
            <Pill>Founder-led software</Pill>
            <Text className="mt-6 text-right text-6xl font-extrabold leading-tight text-ink">
              Software built to <Highlight>solve</Highlight> a real problem
            </Text>
            <Text className="mt-5 text-right text-xl font-semibold leading-8 text-ink">
              A founder-led platform designed to help teams move faster, reduce
              friction, and get real results without bloated features or
              confusing workflows.
            </Text>
            <View className="mt-8 flex-row-reverse flex-wrap gap-4">
              {/* Primary hero CTA — routes into the auth flow (/login) rather
                  than straight into the app, unlike the header/final-CTA
                  "Get Started" buttons which still go to /(tabs). */}
              <Button onPress={onRegisterPress}>سجل الآن</Button>
              <Button variant="secondary">كيفية الاستخدام</Button>
            </View>
            <HeroVisual />
          </View>
        </Section>
      </Container>
    </View>
  );
};
