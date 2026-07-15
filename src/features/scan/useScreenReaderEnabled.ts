import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// Tracks whether a screen reader (TalkBack/VoiceOver) is currently active,
// so callers can decide when it's safe to add a spoken announcement without
// risking two overlapping voices (see the anti-clash comment in scan.tsx's
// mic handler).
export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isScreenReaderEnabled().then((value) => {
      if (mounted) setEnabled(value);
    });
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", setEnabled);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return enabled;
}
