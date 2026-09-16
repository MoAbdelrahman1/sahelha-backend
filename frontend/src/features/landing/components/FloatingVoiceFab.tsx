import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/features/theme/ThemeContext";

export const FloatingVoiceFab = () => {
  const router = useRouter();
  const { colors, themeMode } = useTheme();

  return (
    <View style={styles.fabContainer}>
      <Pressable
        onPress={() => router.push("/(tabs)/chat")}
        accessibilityRole="button"
        accessibilityLabel="المساعد الصوتي الذكي - اضغط لبدء التحدث والاستفسار"
        style={({ pressed }) => [
          styles.fabButton,
          {
            backgroundColor: colors.btnPrimaryBg,
            borderColor: colors.border,
            borderWidth: colors.borderWidth,
          },
          pressed && styles.buttonPressed,
        ]}
      >
        <View
          style={[
            styles.micCircle,
            {
              backgroundColor: themeMode === "high-contrast" ? "#FFCC00" : "#2BB673",
            },
          ]}
        >
          <Ionicons
            name="mic"
            size={24}
            color={themeMode === "high-contrast" ? "#000000" : "#FFFFFF"}
          />
        </View>

        <View style={styles.textColumn}>
          <Text style={[styles.fabTitle, { color: colors.btnPrimaryText }]}>
            المساعد الصوتي
          </Text>
          <Text
            style={[
              styles.fabSubtitle,
              {
                color: themeMode === "high-contrast" ? "#000000" : "#CBD5E1",
              },
            ]}
          >
            اضغط للتحدث المباشر
          </Text>
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  fabContainer: {
    position: Platform.OS === "web" ? ("fixed" as any) : "absolute",
    bottom: 24,
    right: 24,
    zIndex: 50,
  },
  fabButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 30,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  micCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  textColumn: {
    alignItems: "flex-end",
  },
  fabTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  fabSubtitle: {
    fontSize: 11,
    fontWeight: "600",
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
