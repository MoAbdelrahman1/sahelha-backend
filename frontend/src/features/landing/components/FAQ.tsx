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
        accessibilityState={{ expanded: open }}
      >
        <Text className="flex-1 text-right text-xl font-bold text-ink">{question}</Text>
        <Text className="text-3xl font-extrabold text-brandBlueDeep">{open ? "−" : "+"}</Text>
      </Pressable>
      {open ? (
        <View className="px-5 pb-5">
          <Text className="text-right text-lg font-semibold leading-7 text-ink">{answer}</Text>
        </View>
      ) : null}
    </View>
  );
};

export const FAQ = () => {
  const items = [
    {
      question: "Who is this product for?",
      answer:
        "It is designed for teams that want a clearer way to manage core workflows without adopting a bloated all-in-one platform.",
    },
    {
      question: "Can I cancel anytime?",
      answer:
        "Yes. Plans are month-to-month and can be changed or cancelled whenever your needs change.",
    },
    {
      question: "Does it replace all of our tools?",
      answer:
        "No. The goal is to improve the core of your workflow, not force you to replace every tool you already use.",
    },
    {
      question: "How quickly can we get started?",
      answer:
        "Most teams can get the basics set up quickly and then refine the workflow as they learn what they need.",
    },
  ];
  return (
    <Container>
      <Section>
        <Text className="text-right text-lg font-bold text-ink">
          Frequently asked questions
        </Text>
        <Text className="mt-3 text-right text-5xl font-extrabold leading-tight text-ink">
          Answers to real <Highlight>questions</Highlight> that matter
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
