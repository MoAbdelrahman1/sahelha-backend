import React from "react";
import { ThemeProvider } from "@/features/theme/ThemeContext";
import { LandingContent } from "@/app/index";

// الرئيسية tab — renders the full landing page directly (header, services
// catalog, hero, action cards, footer, floating voice FAB).
// ThemeProvider is re-applied here since this renders inside the (tabs)
// navigator which is outside the root index.tsx ThemeProvider scope.
export default function HomeScreen() {
  return (
    <ThemeProvider>
      <LandingContent />
    </ThemeProvider>
  );
}
