import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { useAppearance } from "@/store/appearanceStore";
import { palette } from "@/styles/theme";

// Shared shell for the login/register screens: plain token-driven background,
// bordered card centered on screen, scrollable + keyboard-avoiding so the
// fields stay reachable when the keyboard is open.
export function AuthScreenShell({ children }: { children: React.ReactNode }) {
  const { highContrast } = useAppearance();
  const c = palette(highContrast);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.pageBg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          paddingVertical: 32,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            width: "100%",
            maxWidth: 440,
            borderRadius: 18,
            borderWidth: 2,
            borderColor: c.border,
            backgroundColor: c.pageBg,
            padding: 28,
          }}
        >
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
