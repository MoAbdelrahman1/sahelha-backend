import React from "react";
import { Text, View } from "react-native";

// Small layout/typography helpers used across the landing page's sections.
// Landing-specific (not generic design-system primitives like Button), so
// they live inside this feature rather than src/components/ui.

export const Container = ({ children }: { children: React.ReactNode }) => {
  return <View className="w-full px-4">{children}</View>;
};

export const Section = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <View className={`py-12 ${className}`}>{children}</View>;
};

export const Pill = ({ children }: { children: React.ReactNode }) => {
  return (
    <View className="self-end rounded-full border-2 border-line bg-white px-4 py-2">
      <Text className="text-lg font-bold text-ink">{children}</Text>
    </View>
  );
};

export const Highlight = ({ children }: { children: React.ReactNode }) => {
  return <Text className="text-brandBlueDeep">{children}</Text>;
};
