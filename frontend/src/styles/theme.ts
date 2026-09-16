export const colors = {
  pearl: "#FAF9FD",
  primary: "#6D28D9",
  accent: "#4F46E5",
  onPrimary: "#FFFFFF",
} as const;

export const a11y = {
  minTapTarget: 56,
} as const;

export const TAG_LABELS: Record<string, string> = {
  identity: "هوية شخصية",
  government: "معاملات حكومية",
  financial: "إيصالات وفواتير",
  arabic: "مستندات عربية",
};

export const STATUS_META: Record<string, { label: string; symbol: string; colorLight: string; colorDark: string }> = {
  done: { label: "المستند جاهز", symbol: "✓", colorLight: "#1F7A4C", colorDark: "#4ADE80" },
  processing: { label: "لسه بيتقرا", symbol: "…", colorLight: "#8A5A00", colorDark: "#FACC15" },
  failed: { label: "فيه مشكلة في القراية", symbol: "✕", colorLight: "#B3261E", colorDark: "#F87171" },
};

export const DOC_TYPE_ACCENTS: Record<string, { accent: string; accentSoft: string }> = {
  national_id: { accent: "#33409B", accentSoft: "#E7EAFB" },
  passport: { accent: "#6A3E9E", accentSoft: "#F0E7F8" },
  birth_certificate: { accent: "#8C5A1B", accentSoft: "#F6ECE0" },
  utility_bill: { accent: "#1B6E8C", accentSoft: "#E1F1F5" },
  receipt: { accent: "#1F7A4C", accentSoft: "#E4F3EA" },
  invoice: { accent: "#1F7A4C", accentSoft: "#E4F3EA" },
  driving_license: { accent: "#1B6E8C", accentSoft: "#E1F1F5" },
  work_permit: { accent: "#33409B", accentSoft: "#E7EAFB" },
  marriage_certificate: { accent: "#6A3E9E", accentSoft: "#F0E7F8" },
  death_certificate: { accent: "#6A3E9E", accentSoft: "#F0E7F8" },
  property_record: { accent: "#8C5A1B", accentSoft: "#F6ECE0" },
  unknown: { accent: "#33409B", accentSoft: "#E7EAFB" },
};

export function palette(highContrast: boolean) {
  if (highContrast) {
    return {
      pageBg: "#000000",
      cardBg: "#111827",
      surface: "#111827",
      border: "#FFFFFF",
      ink: "#FFFFFF",
      secondary: "#FACC15",
      primaryBg: "#FACC15",
      primaryText: "#000000",
      primaryFg: "#000000",
      accent: "#FACC15",
      expiryBg: "#991B1B",
      expiryFg: "#FFFFFF",
      toastBg: "#FACC15",
      toastFg: "#000000",
    };
  }
  return {
    pageBg: "#FAF9FD",
    cardBg: "#FFFFFF",
    surface: "#FFFFFF",
    border: "#E5E7EB",
    ink: "#111827",
    secondary: "#6B7280",
    primaryBg: "#1D4ED8",
    primaryText: "#FFFFFF",
    primaryFg: "#FFFFFF",
    accent: "#4F46E5",
    expiryBg: "#FEF2F2",
    expiryFg: "#991B1B",
    toastBg: "#1E293B",
    toastFg: "#FFFFFF",
  };
}
