import React from "react";
import { Pressable, Text } from "react-native";

export type ButtonProps = {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "dark";
  onPress?: () => void;
};

export const Button = ({ children, variant = "primary", onPress }: ButtonProps) => {
  const base =
    "min-h-[56px] rounded-full px-8 py-4 items-center justify-center active:opacity-80";
  const styles = {
    primary: "bg-primary",
    secondary: "bg-white border-2 border-line",
    dark: "bg-white/15 border-2 border-white/20",
  };
  const textStyles = {
    primary: "text-white",
    secondary: "text-ink",
    dark: "text-white",
  };
  return (
    <Pressable onPress={onPress} className={`${base} ${styles[variant]}`}>
      <Text className={`font-plexBold text-xl ${textStyles[variant]}`}>{children}</Text>
    </Pressable>
  );
};
