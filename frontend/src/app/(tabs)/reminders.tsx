import React from "react";
import { Text, View } from "react-native";

import { AppHeader } from "@/components/ui/AppHeader";
import { useAppearance } from "@/store/appearanceStore";
import { palette } from "@/styles/theme";

// Placeholder only — the real Reminders screen (list, voice-first add,
// auto-vs-manual distinction, GET/POST/DELETE /api/reminders/) is owned by
// the "Reminders, content & accessibility" workstream, not this refactor
// pass. This gets the real chrome (header + tab bar) so navigation isn't
// broken while that screen is built.
export default function RemindersScreen() {
  const { highContrast } = useAppearance();
  const c = palette(highContrast);

  return (
    <View style={{ flex: 1, backgroundColor: c.pageBg }}>
      <AppHeader title="التذكيرات" />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 18, color: c.secondary, textAlign: "center" }}>
          قيد الإنشاء
        </Text>
      </View>
    </View>
  );
}
