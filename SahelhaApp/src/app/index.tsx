import React from "react";
import { Platform, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";

import { Header } from "@/features/landing/components/Header";
import { Hero } from "@/features/landing/components/Hero";
import { TrustedBy } from "@/features/landing/components/TrustedBy";
import { FounderIntro } from "@/features/landing/components/FounderIntro";
import { ProblemSolution } from "@/features/landing/components/ProblemSolution";
import { Features } from "@/features/landing/components/Features";
import { HowItWorks } from "@/features/landing/components/HowItWorks";
import { FounderStory } from "@/features/landing/components/FounderStory";
import { Reviews } from "@/features/landing/components/Reviews";
import { FAQ } from "@/features/landing/components/FAQ";
import { Subscribe } from "@/features/landing/components/Subscribe";
import { FinalCTA } from "@/features/landing/components/FinalCTA";
import { Footer } from "@/features/landing/components/Footer";
import { Container } from "@/features/landing/components/primitives";

// This screen is intentionally a thin composition of src/features/landing's
// section components — see that folder for the actual UI.
//
// RTL note: the landing page is hand-mirrored for Arabic reading direction
// (row-reverse containers + right-aligned text) rather than relying on
// I18nManager, which is a global native flag and would affect the whole app.
//
// Typography note: this app's core users are visually impaired, so every
// piece of readable text here is bold and at least text-lg (18px) — nothing
// under that floor — set on near-black `text-ink`, never `text-muted` gray.
// Font scaling is never disabled, so the OS "larger text" setting still
// applies on top of these bigger defaults.

export default function LandingScreen() {
  const router = useRouter();

  // Retarget point: change this route for the header/final-CTA "Get Started"
  // buttons in one place.
  const goToApp = () => router.push("/(tabs)");
  // Retarget point: where the hero's "سجل الآن" CTA sends the user.
  const goToLogin = () => router.push("/login");

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: Platform.OS === "ios" ? 24 : 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Header onGetStarted={goToApp} />
        <Hero onRegisterPress={goToLogin} />
        <TrustedBy />
        <FounderIntro />
        <ProblemSolution />
        <Features />
        <HowItWorks />
        <FounderStory />
        <Reviews />
        <FAQ />
        <Container>
          <Subscribe />
        </Container>
        <FinalCTA onGetStarted={goToApp} />
        <Footer />
      </ScrollView>
    </View>
  );
}
