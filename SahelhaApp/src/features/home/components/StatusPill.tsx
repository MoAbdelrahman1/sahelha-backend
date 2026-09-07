import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { checkBackendReady } from "@/features/home/api";

type PillState = "loading" | "ready" | "unavailable";

// TODO(Asma): confirm final Arabic copy for all five strings below — these
// are placeholder wording written to satisfy the "never colour alone" rule.
const TEXT_BY_STATE: Record<PillState, string> = {
  loading: "جارٍ التحقق من الاتصال بالخادم…",
  ready: "الخادم متصل ويعمل",
  unavailable: "تعذّر الاتصال بالخادم — اضغط لإعادة المحاولة",
};

const ACCESSIBILITY_LABEL_BY_STATE: Record<PillState, string> = {
  loading: "حالة النظام: جارٍ التحقق من الاتصال بالخادم",
  ready: "حالة النظام: الخادم متصل ويعمل",
  unavailable: "حالة النظام: تعذّر الاتصال بالخادم",
};

const RETRY_HINT_AR = "اضغط لإعادة محاولة الاتصال بالخادم";

const DOT_COLOR_BY_STATE: Record<PillState, string> = {
  loading: "bg-gray-400",
  ready: "bg-green-600",
  unavailable: "bg-red-600",
};

// Real backend-reachability check (GET /api/ready), not a static claim. Does
// NOT claim voice or location work — this round only confirms the server
// responds. Colour is decorative reinforcement only; state is always carried
// in the Arabic text and accessibilityLabel too, since colour-only status
// (esp. red/green) is unusable for colourblind users and invisible to a
// screen reader.
export function StatusPill() {
  const [state, setState] = useState<PillState>("loading");
  // Guards against an overlapping check if the pill is tapped again while a
  // previous check is still in flight (e.g. during the backend's cold start).
  const checkInFlight = useRef(false);

  const runCheck = useCallback(async () => {
    if (checkInFlight.current) return;
    checkInFlight.current = true;
    setState("loading");
    const ready = await checkBackendReady();
    setState(ready ? "ready" : "unavailable");
    checkInFlight.current = false;
  }, []);

  // Runs once on Home-screen mount. Intentionally fire-and-forget — the rest
  // of the Home screen (feature cards) renders immediately and never waits
  // on this.
  useEffect(() => {
    runCheck();
  }, [runCheck]);

  return (
    <Pressable
      onPress={runCheck}
      accessibilityRole="button"
      accessibilityLabel={ACCESSIBILITY_LABEL_BY_STATE[state]}
      accessibilityHint={RETRY_HINT_AR}
      className="min-h-[56px] flex-row-reverse items-center gap-3 self-stretch rounded-full border-2 border-line bg-white px-5 py-3 active:opacity-80"
    >
      <View
        className={`h-3.5 w-3.5 rounded-full ${DOT_COLOR_BY_STATE[state]}`}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      {state === "loading" ? <ActivityIndicator size="small" color="#000000" /> : null}
      <Text className="flex-1 text-right text-lg font-bold text-ink">{TEXT_BY_STATE[state]}</Text>
    </Pressable>
  );
}
