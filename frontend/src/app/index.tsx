import React, { useEffect, useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";

import { stopGlobalTts } from "@/features/voice/useTtsPlayer";
import { ThemeProvider, useTheme } from "@/features/theme/ThemeContext";
import { ColorModeSwitcherBar } from "@/features/theme/ColorModeSwitcherBar";
import { Header } from "@/features/landing/components/Header";
import { AnnouncementBanner } from "@/features/landing/components/AnnouncementBanner";
import { Hero } from "@/features/landing/components/Hero";
import { ActionCards } from "@/features/landing/components/ActionCards";
import { DigitalServicesCatalog } from "@/features/landing/components/DigitalServicesCatalog";
import { DigitalEgyptFooter } from "@/features/landing/components/DigitalEgyptFooter";
import { FloatingVoiceFab } from "@/features/landing/components/FloatingVoiceFab";

// Shared landing page content — used by both src/app/index.tsx (root URL "/")
// and src/app/(tabs)/index.tsx (الرئيسية tab).
export function LandingContent() {
  const scrollViewRef = useRef<ScrollView>(null);
  const { colors } = useTheme();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  useEffect(() => {
    return () => {
      stopGlobalTts();
    };
  }, []);

  const scrollToCatalog = () => {
    scrollViewRef.current?.scrollTo({ y: 440, animated: true });
  };

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    scrollToCatalog();
  };

  const handleSearchSubmit = () => {
    scrollToCatalog();
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bgScreen }]}>
      <ColorModeSwitcherBar />
      <Header onServicesPress={scrollToCatalog} />
      <AnnouncementBanner />
      <ScrollView
        ref={scrollViewRef}
        style={[styles.scrollView, { backgroundColor: colors.bgScreen }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Hero
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onSelectCategory={handleSelectCategory}
          onSearchSubmit={handleSearchSubmit}
        />
        <ActionCards onBrowseServices={scrollToCatalog} />
        <DigitalServicesCatalog
          searchQuery={searchQuery}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
        <DigitalEgyptFooter />
      </ScrollView>
      <FloatingVoiceFab />
    </View>
  );
}

export default function LandingScreen() {
  return (
    <ThemeProvider>
      <LandingContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
});
