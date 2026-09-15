export const colors = {
  pearl: "#FAF9FD",
  primary: "#6D28D9",
  accent: "#4F46E5",
  onPrimary: "#FFFFFF",
} as const;

export const a11y = {
  minTapTarget: 56,
} as const;

export function palette(highContrast: boolean) {
  if (highContrast) {
    return {
      pageBg: "#000000",
      cardBg: "#111827",
      border: "#FFFFFF",
      ink: "#FFFFFF",
      secondary: "#FACC15",
      primaryBg: "#FACC15",
      primaryText: "#000000",
      accent: "#FACC15",
    };
  }
  return {
    pageBg: "#FAF9FD",
    cardBg: "#FFFFFF",
    border: "#E5E7EB",
    ink: "#111827",
    secondary: "#6B7280",
    primaryBg: "#1D4ED8",
    primaryText: "#FFFFFF",
    accent: "#4F46E5",
  };
}
