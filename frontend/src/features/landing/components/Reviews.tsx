import React from "react";
import { Text, View } from "react-native";

import { Container, Section } from "./primitives";

const ReviewCard = ({ quote, name }: { quote: string; name: string }) => {
  return (
    <View className="rounded-card border-2 border-line bg-white p-6">
      <Text className="text-right text-xl font-semibold leading-8 text-ink">“{quote}”</Text>
      <Text className="mt-5 text-right text-lg font-bold text-ink">{name}</Text>
    </View>
  );
};

export const Reviews = () => {
  const reviews = [
    {
      quote:
        "The product helped us simplify how we track work without forcing the team into a rigid process.",
      name: "Maya Chen, Operations Lead",
    },
    {
      quote:
        "It feels intentionally built. We got value quickly and avoided the usual setup fatigue.",
      name: "Jordan Ellis, Founder",
    },
    {
      quote:
        "The biggest win was focus. Everyone finally knew what mattered and where to look.",
      name: "Sam Rivera, Product Manager",
    },
  ];
  return (
    <Container>
      <Section>
        <Text className="text-right text-5xl font-extrabold leading-tight text-ink">
          Teams are moving with less friction
        </Text>
        <View className="mt-8 gap-4">
          {reviews.map((review) => (
            <ReviewCard key={review.name} quote={review.quote} name={review.name} />
          ))}
        </View>
      </Section>
    </Container>
  );
};
