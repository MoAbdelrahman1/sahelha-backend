import React from "react";
import { Text, View } from "react-native";

import { Container, Highlight, Section } from "./primitives";

type LandingFeatureCardProps = {
  title: string;
  description: string;
};

const LandingFeatureCard = ({ title, description }: LandingFeatureCardProps) => {
  return (
    <View className="rounded-card border-2 border-line bg-white p-5">
      <View className="mb-5 h-10 w-10 self-end rounded-2xl bg-brandBlueDeep" />
      <Text className="text-right text-2xl font-extrabold text-ink">{title}</Text>
      <Text className="mt-3 text-right text-lg font-semibold leading-7 text-ink">{description}</Text>
    </View>
  );
};

export const Features = () => {
  const features = [
    {
      title: "Clear workflows",
      description:
        "Keep the work moving with a structure that matches how teams actually operate.",
    },
    {
      title: "Fast setup",
      description:
        "Start quickly without long onboarding, complicated settings, or unnecessary layers.",
    },
    {
      title: "Focused dashboard",
      description:
        "See the information that matters most without digging through disconnected views.",
    },
    {
      title: "Team visibility",
      description:
        "Help everyone understand what is moving, what is blocked, and what needs attention.",
    },
    {
      title: "Flexible systems",
      description:
        "Use the defaults when they work and adapt the details when your team needs more control.",
    },
    {
      title: "Less overhead",
      description:
        "Reduce the amount of process required to keep important work organized and clear.",
    },
  ];
  return (
    <Container>
      <Section>
        <Text className="text-right text-lg font-bold text-ink">Features</Text>
        <Text className="mt-3 text-right text-5xl font-extrabold leading-tight text-ink">
          Features designed for <Highlight>real</Highlight> workflows
        </Text>
        <Text className="mt-4 text-right text-xl font-semibold leading-8 text-ink">
          Instead of trying to cover every possible use case, the product is
          designed to support the workflows teams rely on most.
        </Text>
        <View className="mt-8 gap-4">
          {features.map((feature) => (
            <LandingFeatureCard
              key={feature.title}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </View>
      </Section>
    </Container>
  );
};
