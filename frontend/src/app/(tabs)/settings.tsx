import React from "react";
import { Text, View } from "react-native";

import { AppHeader } from "@/components/ui/AppHeader";
import { useAppearance } from "@/store/appearanceStore";
import { palette } from "@/styles/theme";

// Placeholder only — the real Settings screen (text size, high contrast,
// voice guidance/speed, haptics, FCM permission copy, account/logout) is
// owned by the "Reminders, content & accessibility" workstream, not this
// refactor pass. This gets the real chrome (header + tab bar, and the header
// already carries a working high-contrast toggle) so navigation isn't broken
// while that screen is built.
export default function SettingsScreen() {
  const { highContrast } = useAppearance();
  const c = palette(highContrast);

  return (
    <View style={{ flex: 1, backgroundColor: c.pageBg }}>
      <AppHeader title="الإعدادات" />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 18, color: c.secondary, textAlign: "center" }}>
          قيد الإنشاء
        </Text>
      </View>
    </View>
  );
}
