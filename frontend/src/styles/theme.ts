// Design tokens extracted from the Sahelha Design canvas mockup, matching
// backend/SAHELHA_DESIGN_BRIEF.md §3/§5 (accessible, RTL, voice-first palette).
// Every screen reads colors from `palette(highContrast)` rather than hardcoding
// hex values, so the whole app flips consistently with one boolean.

export type Palette = {
  pageBg: string;
  ink: string;
  secondary: string;
  surface: string;
  border: string;
  primaryBg: string;
  primaryFg: string;
  toastBg: string;
  toastFg: string;
  expiryFg: string;
  expiryBg: string;
  statusFg: (statusColorLight: string) => string;
};

export function palette(highContrast: boolean): Palette {
  return highContrast
    ? {
        pageBg: "#000000",
        ink: "#FFFFFF",
        secondary: "#E4E4E4",
        surface: "#000000",
        border: "#FFFFFF",
        primaryBg: "#FFFFFF",
        primaryFg: "#000000",
        toastBg: "#FFFFFF",
        toastFg: "#000000",
        expiryFg: "#000000",
        expiryBg: "#FFD400",
        statusFg: () => "#FFFFFF",
      }
    : {
        pageBg: "#FFFFFF",
        ink: "#0E0E14",
        secondary: "#5B5B68",
        surface: "#F7F7FB",
        border: "#ECECF2",
        primaryBg: "#33409B",
        primaryFg: "#FFFFFF",
        toastBg: "#0E0E14",
        toastFg: "#FFFFFF",
        expiryFg: "#8A3B12",
        expiryBg: "#FCE7D6",
        statusFg: (statusColorLight) => statusColorLight,
      };
}

// Status is never conveyed by color alone — always pair with `symbol` + `label`.
export const STATUS_META = {
  done: { label: "المستند جاهز", symbol: "✓", colorLight: "#1F7A4C" },
  processing: { label: "لسه بيتقرا", symbol: "…", colorLight: "#8A5A00" },
  failed: { label: "فيه مشكلة في القراية", symbol: "✕", colorLight: "#B3261E" },
} as const;

// Per-document-type accent used by the icon tile on DocumentCard.
export const DOC_TYPE_ACCENTS: Record<string, { accent: string; accentSoft: string }> = {
  national_id: { accent: "#33409B", accentSoft: "#E7EAFB" },
  passport: { accent: "#6A3E9E", accentSoft: "#F0E7F8" },
  birth_certificate: { accent: "#8C5A1B", accentSoft: "#F6ECE0" },
  utility_bill: { accent: "#1B6E8C", accentSoft: "#E1F1F5" },
  receipt: { accent: "#1F7A4C", accentSoft: "#E4F3EA" },
  invoice: { accent: "#1F7A4C", accentSoft: "#E4F3EA" },
  work_permit: { accent: "#33409B", accentSoft: "#E7EAFB" },
  marriage_certificate: { accent: "#6A3E9E", accentSoft: "#F0E7F8" },
  death_certificate: { accent: "#6A3E9E", accentSoft: "#F0E7F8" },
  property_record: { accent: "#8C5A1B", accentSoft: "#F6ECE0" },
  unknown: { accent: "#33409B", accentSoft: "#E7EAFB" },
};

export const TAG_LABELS: Record<string, string> = {
  identity: "هوية",
  government: "حكومي",
  financial: "مالي",
  arabic: "عربي",
  english: "إنجليزي",
  expiry: "قرب الانتهاء",
};

// font-family names as registered by useFonts() in src/app/_layout.tsx
export const fontFamily = {
  cairo700: "Cairo_700Bold",
  cairo800: "Cairo_800ExtraBold",
  cairo900: "Cairo_900Black",
  plex400: "IBMPlexSansArabic_400Regular",
  plex500: "IBMPlexSansArabic_500Medium",
  plex600: "IBMPlexSansArabic_600SemiBold",
  plex700: "IBMPlexSansArabic_700Bold",
} as const;

export const a11y = {
  minTapTarget: 48,
  minPrimaryTapTarget: 64,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 18,
  pill: 999,
} as const;
