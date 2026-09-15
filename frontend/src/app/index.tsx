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

function LandingContent() {
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
      {/* Top Be My Eyes Color Mode Switcher Bar */}
      <ColorModeSwitcherBar />

      {/* Header */}
      <Header onServicesPress={scrollToCatalog} />

      {/* Announcement Ribbon */}
      <AnnouncementBanner />

      <ScrollView
        ref={scrollViewRef}
        style={[styles.scrollView, { backgroundColor: colors.bgScreen }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Asymmetrical Hero */}
        <Hero
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onSelectCategory={handleSelectCategory}
          onSearchSubmit={handleSearchSubmit}
        />

        {/* Dual Action Cards */}
        <ActionCards onBrowseServices={scrollToCatalog} />

        {/* Digital Government Services Catalog */}
        <DigitalServicesCatalog
          searchQuery={searchQuery}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {/* Official Egyptian Portal Footer */}
        <DigitalEgyptFooter />
      </ScrollView>

      {/* Floating AI Voice Assistant Action Button */}
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
  screen: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
});
