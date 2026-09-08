import React from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useAppearance } from "@/store/appearanceStore";
import { palette } from "@/styles/theme";

type AppHeaderProps = {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
};

// Persistent chrome on every screen except onboarding/auth/camera/processing:
// RTL back chevron, centered Cairo-bold title, a permanent high-contrast
// toggle pill (SAHELHA_DESIGN_BRIEF.md §5 — "provide a high-contrast mode as a
// first-class, easy-to-reach setting, not buried").
export function AppHeader({ title, showBack = false, onBack }: AppHeaderProps) {
  const router = useRouter();
  const { highContrast, toggleHighContrast } = useAppearance();
  const c = palette(highContrast);

  const handleBack = onBack ?? (() => router.back());

  return (
    <View
      style={{
        flexDirection: "row-reverse",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        paddingHorizontal: 18,
        paddingVertical: 14,
        minHeight: 58,
        backgroundColor: c.pageBg,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      }}
    >
      <View style={{ width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" }}>
        {showBack ? (
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="رجوع"
            style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
          >
            <View
              style={{
                width: 11,
                height: 11,
                borderTopWidth: 3,
                borderRightWidth: 3,
                borderColor: c.ink,
                transform: [{ rotate: "-135deg" }],
              }}
            />
          </Pressable>
        ) : null}
      </View>

      <Text
        numberOfLines={1}
        style={{ flex: 1, textAlign: "center", fontFamily: "Cairo_700Bold", fontSize: 18, color: c.ink }}
      >
        {title}
      </Text>

      <Pressable
        onPress={toggleHighContrast}
        accessibilityRole="button"
        accessibilityLabel={highContrast ? "إيقاف وضع التباين العالي" : "تفعيل وضع التباين العالي"}
        style={{
          minWidth: 44,
          height: 36,
          paddingHorizontal: 10,
          borderRadius: 999,
          borderWidth: 2,
          borderColor: c.ink,
          backgroundColor: highContrast ? c.ink : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontFamily: "IBMPlexSansArabic_700Bold",
            fontSize: 11.5,
            color: highContrast ? c.pageBg : c.ink,
          }}
        >
          {highContrast ? "عادي" : "تباين عالي"}
        </Text>
      </Pressable>
    </View>
  );
}
