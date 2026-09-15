import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, type ThemeMode } from "./ThemeContext";

export const ColorModeSwitcherBar = () => {
  const { themeMode, setThemeMode } = useTheme();
  const [isOpen, setIsOpen] = useState(true);

  const THEMES: { id: ThemeMode; labelEn: string; labelAr: string }[] = [
    { id: "light", labelEn: "Light Theme", labelAr: "الوضع الفاتح" },
    { id: "dark", labelEn: "Dark Theme", labelAr: "الوضع الداكن" },
    { id: "high-contrast", labelEn: "High Contrast", labelAr: "التباين العالي" },
  ];

  return (
    <View style={styles.topUtilityBar}>
      <View style={styles.container}>
        {/* Top Control Bar Row */}
        <View style={styles.headerRow}>
          <Text style={styles.portalTag}>
            بوابة الخدمات الحكومية الرقمية
          </Text>

          <Pressable
            onPress={() => setIsOpen((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel="تبديل نمط الألوان للمكفوفين وضعاف البصر"
            style={({ pressed }) => [
              styles.switchTriggerButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Ionicons name="color-palette-outline" size={18} color="#FFFFFF" />
            <Text style={styles.switchTriggerText}>
              تبديل نمط الألوان (Switch color mode)
            </Text>
            <Ionicons
              name={isOpen ? "chevron-up" : "chevron-down"}
              size={16}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

        {/* 3 Theme Panels (Be My Eyes Style) */}
        {isOpen && (
          <View style={styles.panelsWrapper}>
            <View style={styles.panelsRow}>
              {THEMES.map((theme) => {
                const isActive = themeMode === theme.id;

                return (
                  <Pressable
                    key={theme.id}
                    onPress={() => setThemeMode(theme.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={`تفعيل ${theme.labelAr}، ${theme.labelEn}`}
                    style={({ pressed }) => [
                      styles.themePanel,
                      theme.id === "light" && styles.panelLight,
                      theme.id === "dark" && styles.panelDark,
                      theme.id === "high-contrast" && styles.panelHighContrast,
                      isActive && styles.panelActiveHighlight,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <View style={styles.panelContent}>
                      <View style={styles.panelTitleRow}>
                        {isActive && (
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color={
                              theme.id === "dark"
                                ? "#60A5FA"
                                : theme.id === "high-contrast"
                                ? "#000000"
                                : "#174384"
                            }
                          />
                        )}
                        <Text
                          style={[
                            styles.panelLabelEn,
                            theme.id === "dark" && styles.textWhite,
                            theme.id === "high-contrast" && styles.textBlack,
                            theme.id === "light" && styles.textSlate,
                          ]}
                        >
                          {theme.labelEn}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.panelLabelAr,
                          theme.id === "dark" && styles.textMutedWhite,
                          theme.id === "high-contrast" && styles.textDarkBlack,
                          theme.id === "light" && styles.textMutedSlate,
                        ]}
                      >
                        {theme.labelAr}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  topUtilityBar: {
    backgroundColor: "#10346B",
    borderBottomWidth: 1,
    borderBottomColor: "#0D254C",
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 60,
  },
  container: {
    maxWidth: 1200,
    width: "100%",
    marginHorizontal: "auto",
  },
  headerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  portalTag: {
    fontSize: 13,
    fontWeight: "700",
    color: "#BFDBFE",
    textAlign: "right",
  },
  switchTriggerButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#174384",
    borderWidth: 1,
    borderColor: "#3B82F6",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  switchTriggerText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  panelsWrapper: {
    paddingTop: 10,
    paddingBottom: 4,
  },
  panelsRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  themePanel: {
    minWidth: 150,
    flex: 1,
    maxWidth: 220,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  panelLight: {
    backgroundColor: "#FFFFFF",
    borderColor: "#CBD5E1",
  },
  panelDark: {
    backgroundColor: "#0B1120",
    borderColor: "#1E3A8A",
  },
  panelHighContrast: {
    backgroundColor: "#FFCC00",
    borderColor: "#000000",
  },
  panelActiveHighlight: {
    borderColor: "#F59E0B",
    borderWidth: 3,
  },
  panelContent: {
    alignItems: "center",
  },
  panelTitleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  panelLabelEn: {
    fontSize: 15,
    fontWeight: "900",
  },
  panelLabelAr: {
    fontSize: 12,
    fontWeight: "700",
  },
  textWhite: {
    color: "#FFFFFF",
  },
  textMutedWhite: {
    color: "#94A3B8",
  },
  textBlack: {
    color: "#000000",
  },
  textDarkBlack: {
    color: "#1A1A1A",
  },
  textSlate: {
    color: "#0F172A",
  },
  textMutedSlate: {
    color: "#475569",
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
