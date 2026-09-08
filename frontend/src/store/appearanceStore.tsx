import React, { createContext, useContext, useMemo, useState } from "react";

// Cross-cutting accessibility preferences (SAHELHA_DESIGN_BRIEF.md §5): every
// screen reads `highContrast` for its colors, the header's HC toggle writes it,
// and onboarding/settings write the rest — genuinely shared by 2+ features, so
// this lives in src/store/ per ARCHITECTURE.md's placement rule, not inside one
// feature. In-memory only for this pass; persistence is a later concern.

export type TextSizePref = "عادي" | "كبير" | "كبير جدًا";
export type VoiceSpeedPref = "بطيء" | "عادي" | "سريع";

type AppearanceState = {
  highContrast: boolean;
  toggleHighContrast: () => void;
  setHighContrast: (value: boolean) => void;
  textSizePref: TextSizePref;
  setTextSizePref: (value: TextSizePref) => void;
  voiceGuidance: boolean;
  toggleVoiceGuidance: () => void;
  voiceSpeed: VoiceSpeedPref;
  setVoiceSpeed: (value: VoiceSpeedPref) => void;
  haptics: boolean;
  toggleHaptics: () => void;
};

const AppearanceContext = createContext<AppearanceState | null>(null);

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [highContrast, setHighContrast] = useState(false);
  const [textSizePref, setTextSizePref] = useState<TextSizePref>("عادي");
  const [voiceGuidance, setVoiceGuidance] = useState(true);
  const [voiceSpeed, setVoiceSpeed] = useState<VoiceSpeedPref>("عادي");
  const [haptics, setHaptics] = useState(true);

  const value = useMemo<AppearanceState>(
    () => ({
      highContrast,
      toggleHighContrast: () => setHighContrast((v) => !v),
      setHighContrast,
      textSizePref,
      setTextSizePref,
      voiceGuidance,
      toggleVoiceGuidance: () => setVoiceGuidance((v) => !v),
      voiceSpeed,
      setVoiceSpeed,
      haptics,
      toggleHaptics: () => setHaptics((v) => !v),
    }),
    [highContrast, textSizePref, voiceGuidance, voiceSpeed, haptics]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceState {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within an AppearanceProvider");
  return ctx;
}
