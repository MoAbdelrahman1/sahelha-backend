import React from "react";
import { Text, View } from "react-native";

import { Container, Section } from "./primitives";

export const ProblemSolution = () => {
  return (
    <Container>
      <Section>
        <View className="gap-4">
          <View className="rounded-card border-2 border-line bg-white p-6">
            <Text className="text-right text-lg font-bold text-ink">The problem</Text>
            <Text className="mt-4 text-right text-4xl font-extrabold leading-tight text-ink">
              Tools add complexity instead of removing it
            </Text>
            <Text className="mt-4 text-right text-xl font-semibold leading-8 text-ink">
              Teams waste time switching between tools, setting up workflows
              that do not quite fit, and adapting to software that was not
              designed for their real use cases.
            </Text>
          </View>
          <View className="rounded-card bg-brandBlueDeep p-6">
            <Text className="text-right text-lg font-bold text-white">The solution</Text>
            <Text className="mt-4 text-right text-4xl font-extrabold leading-tight text-white">
              A product designed around real workflows
            </Text>
            <Text className="mt-4 text-right text-xl font-semibold leading-8 text-white">
              This platform focuses on the few things that matter most. It is
              opinionated where it should be and flexible where it needs to be,
              so you can get value quickly and grow without friction.
            </Text>
          </View>
        </View>
      </Section>
    </Container>
  );
};
