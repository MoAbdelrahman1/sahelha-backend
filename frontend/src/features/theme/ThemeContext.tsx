import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { useTtsPlayer } from "@/features/voice/useTtsPlayer";

export type ThemeMode = "light" | "dark" | "high-contrast";

export type ThemeColors = {
  bgScreen: string;
  bgCard: string;
  bgSurface: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  borderWidth: number;
  btnPrimaryBg: string;
  btnPrimaryText: string;
  btnSecondaryBg: string;
  btnSecondaryText: string;
  navBarBg: string;
  footerBg: string;
  bannerBg: string;
  bannerBorder: string;
  searchBoxBg: string;
  searchBoxBorder: string;
  tagBg: string;
  tagBorder: string;
  tagText: string;
  tagSelectedBg: string;
  tagSelectedText: string;
  fastTrackCardBg: string;
  feeBadgeBg: string;
  feeBadgeBorder: string;
  feeBadgeText: string;
};

const lightColors: ThemeColors = {
  bgScreen: "#FFFFFF",
  bgCard: "#FFFFFF",
  bgSurface: "#F8FAFC",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  border: "#CBD5E1",
  borderWidth: 1,
  btnPrimaryBg: "#174384",
  btnPrimaryText: "#FFFFFF",
  btnSecondaryBg: "#F8FAFC",
  btnSecondaryText: "#334155",
  navBarBg: "#FFFFFF",
  footerBg: "#0D254C",
  bannerBg: "#EBF3FC",
  bannerBorder: "#D0E2F7",
  searchBoxBg: "#FFFFFF",
  searchBoxBorder: "#CBD5E1",
  tagBg: "#FFFFFF",
  tagBorder: "#CBD5E1",
  tagText: "#334155",
  tagSelectedBg: "#174384",
  tagSelectedText: "#FFFFFF",
  fastTrackCardBg: "#FFFFFF",
  feeBadgeBg: "#ECFDF5",
  feeBadgeBorder: "#A7F3D0",
  feeBadgeText: "#047857",
};

const darkColors: ThemeColors = {
  bgScreen: "#000000",
  bgCard: "#0B1120",
  bgSurface: "#030712",
  textPrimary: "#FFFFFF",
  textSecondary: "#94A3B8",
  border: "#2563EB",
  borderWidth: 1.5,
  btnPrimaryBg: "#E68A00",
  btnPrimaryText: "#000000",
  btnSecondaryBg: "#1E293B",
  btnSecondaryText: "#FFFFFF",
  navBarBg: "#000000",
  footerBg: "#000000",
  bannerBg: "#0F172A",
  bannerBorder: "#1E3A8A",
  searchBoxBg: "#0B1120",
  searchBoxBorder: "#2563EB",
  tagBg: "#0B1120",
  tagBorder: "#1E3A8A",
  tagText: "#CBD5E1",
  tagSelectedBg: "#2563EB",
  tagSelectedText: "#FFFFFF",
  fastTrackCardBg: "#0B1120",
  feeBadgeBg: "#064E3B",
  feeBadgeBorder: "#059669",
  feeBadgeText: "#6EE7B7",
};

// Be My Eyes Accessibility Yellow & Jet-Black Theme (>14:1 contrast ratio)
const highContrastColors: ThemeColors = {
  bgScreen: "#FFCC00",
  bgCard: "#F4D677",
  bgSurface: "#FFE066",
  textPrimary: "#000000",
  textSecondary: "#1A1A1A",
  border: "#000000",
  borderWidth: 2,
  btnPrimaryBg: "#000000",
  btnPrimaryText: "#FFCC00",
  btnSecondaryBg: "#FFE066",
  btnSecondaryText: "#000000",
  navBarBg: "#FFCC00",
  footerBg: "#000000",
  bannerBg: "#FFE066",
  bannerBorder: "#000000",
  searchBoxBg: "#FFFFFF",
  searchBoxBorder: "#000000",
  tagBg: "#F4D677",
  tagBorder: "#000000",
  tagText: "#000000",
  tagSelectedBg: "#000000",
  tagSelectedText: "#FFCC00",
  fastTrackCardBg: "#F4D677",
  feeBadgeBg: "#000000",
  feeBadgeBorder: "#000000",
  feeBadgeText: "#FFCC00",
};

type ThemeContextType = {
  themeMode: ThemeMode;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  themeMode: "light",
  colors: lightColors,
  setThemeMode: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
  const tts = useTtsPlayer();

  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem("sahelha_theme_mode") as ThemeMode | null;
        if (saved && (saved === "light" || saved === "dark" || saved === "high-contrast")) {
          setThemeModeState(saved);
        }
      } catch {}
    }
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        window.localStorage.setItem("sahelha_theme_mode", mode);
      } catch {}
    }

    // Audio confirmation for blind users
    const label =
      mode === "high-contrast"
        ? "تم تفعيل نمط التباين العالي الأصفر والأسود"
        : mode === "dark"
        ? "تم تفعيل الوضع الداكن"
        : "تم تفعيل الوضع الفاتح";
    tts.speakTextContent(label, "theme-announcement");
  };

  const colors =
    themeMode === "high-contrast"
      ? highContrastColors
      : themeMode === "dark"
      ? darkColors
      : lightColors;

  return (
    <ThemeContext.Provider value={{ themeMode, colors, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
