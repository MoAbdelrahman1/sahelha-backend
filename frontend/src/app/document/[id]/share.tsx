import React from "react";
import { Text, View } from "react-native";

import { AppHeader } from "@/components/ui/AppHeader";
import { useAppearance } from "@/store/appearanceStore";
import { palette } from "@/styles/theme";

// Placeholder only — the real Share screen (QR from GET
// /api/archive/share/{id} PLUS a copyable share_url as plain text, never
// QR-only per SAHELHA_DESIGN_BRIEF.md §6.8) is owned by the "Reminders,
// content & accessibility" workstream, not this refactor pass. This gets the
// real chrome (header with back button) so Document Detail's share button has
// somewhere real to land.
export default function DocumentShareScreen() {
  const { highContrast } = useAppearance();
  const c = palette(highContrast);

  return (
    <View style={{ flex: 1, backgroundColor: c.pageBg }}>
      <AppHeader title="مشاركة المستند" showBack />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 18, color: c.secondary, textAlign: "center" }}>
          قيد الإنشاء
        </Text>
      </View>
    </View>
  );
}
