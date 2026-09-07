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
      <View className="mb-5 h-14 w-14 items-center justify-center self-end rounded-full bg-brandBlueDeep">
        <Text className="text-xl font-extrabold text-white">{number}</Text>
      </View>
      <Text className="text-right text-2xl font-extrabold text-ink">{title}</Text>
      <Text className="mt-3 text-right text-lg font-semibold leading-7 text-ink">{description}</Text>
    </View>
  );
};

export const HowItWorks = () => {
  const steps = [
    {
      number: "1",
      title: "Connect the basics",
      description:
        "Bring your team, current workflow, and core projects into one focused place.",
    },
    {
      number: "2",
      title: "Shape the workflow",
      description:
        "Choose the structure that matches how work actually moves through your team.",
    },
    {
      number: "3",
      title: "Track real results",
      description:
        "Use clear signals to understand what is working and what needs attention.",
    },
  ];
  return (
    <Container>
      <Section>
        <Text className="text-right text-lg font-bold text-ink">How it works</Text>
        <Text className="mt-3 text-right text-5xl font-extrabold leading-tight text-ink">
          From <Highlight>setup to results</Highlight> in 3 simple steps
        </Text>
        <View className="mt-8 gap-4">
          {steps.map((step) => (
            <StepCard
              key={step.number}
              number={step.number}
              title={step.title}
              description={step.description}
            />
          ))}
        </View>
      </Section>
    </Container>
  );
};
