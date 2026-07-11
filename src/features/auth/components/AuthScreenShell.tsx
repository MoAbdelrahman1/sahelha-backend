import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

// Shared shell for the login/register screens: soft-blue background, white
// card centered on screen, scrollable + keyboard-avoiding so the fields stay
// reachable when the keyboard is open.
export function AuthScreenShell({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-brandBlue"
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
        <View className="w-full max-w-[440px] rounded-card bg-white p-7 shadow-sm">{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
