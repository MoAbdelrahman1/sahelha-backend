import React from "react";
import { Text } from "react-native";

import { Container, Section } from "./primitives";

export const FounderStory = () => {
  return (
    <Container>
      <Section>
        <Text className="text-right text-lg font-bold text-ink">Founder story</Text>
        <Text className="mt-3 text-right text-5xl font-extrabold leading-tight text-ink">
          Why this product exists and the problem behind it
        </Text>
        <Text className="mt-5 text-right text-xl font-semibold leading-8 text-ink">
          This product began as a way to solve a real problem after too many
          tools promised flexibility but delivered complexity. It was built to
          be simpler, clearer, and more honest. The goal is not to replace
          everything you use, but to improve the core of your workflow.
        </Text>
      </Section>
    </Container>
  );
};
