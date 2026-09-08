import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, AccessibilityInfo } from "react-native";
import * as Haptics from "expo-haptics";

import { useAppearance } from "@/store/appearanceStore";
import { palette } from "@/styles/theme";

// Visual+haptic+screen-reader confirmation for completed actions (uploaded,
// saved, deleted, reminder set — SAHELHA_DESIGN_BRIEF.md §5: "a toast that
// only appears visually is invisible to this audience"). Global because any
// screen/feature can trigger one, so it lives in src/store/ alongside
// appearanceStore rather than inside a single feature.

type ToastState = {
  showToast: (message: string) => void;
};

const ToastContext = createContext<ToastState | null>(null);

const TOAST_DURATION_MS = 2600;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { haptics, highContrast } = useAppearance();

  const showToast = useCallback(
    (msg: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMessage(msg);
      AccessibilityInfo.announceForAccessibility(msg);
      if (haptics) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      timerRef.current = setTimeout(() => setMessage(null), TOAST_DURATION_MS);
    },
    [haptics]
  );

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);
  const c = palette(highContrast);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <View
          role="status"
          accessibilityLiveRegion="polite"
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            bottom: 24,
            backgroundColor: c.toastBg,
            borderRadius: 14,
            paddingVertical: 14,
            paddingHorizontal: 18,
            shadowColor: "#000",
            shadowOpacity: 0.3,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
            zIndex: 50,
          }}
        >
          <Text style={{ color: c.toastFg, fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 14, textAlign: "center" }}>
            {message}
          </Text>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastState {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
