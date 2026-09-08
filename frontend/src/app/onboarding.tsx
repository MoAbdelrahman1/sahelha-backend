import React, { useState } from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useAppearance, type TextSizePref } from "@/store/appearanceStore";
import { palette } from "@/styles/theme";

// First-run accessibility setup wizard (SAHELHA_DESIGN_BRIEF.md §6.1 — "treat
// this as an accessibility setup wizard, not an afterthought in Settings").
// Reached from the landing page's primary CTA; its last step routes to
// /login. Every step should be narrated aloud automatically per the brief —
// this announces each step's heading on entry.

const STEPS = 4;
const TEXT_SIZES: { value: TextSizePref; short: string }[] = [
  { value: "عادي", short: "ع" },
  { value: "كبير", short: "ك" },
  { value: "كبير جدًا", short: "ك+" },
];

const DEMO_FONT_SIZE: Record<TextSizePref, number> = { "عادي": 18, "كبير": 24, "كبير جدًا": 30 };

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const { highContrast, setHighContrast, textSizePref, setTextSizePref, voiceGuidance, toggleVoiceGuidance } =
    useAppearance();
  const c = palette(highContrast);

  const goNext = () => {
    if (step === STEPS - 1) {
      router.push("/login");
      return;
    }
    const next = step + 1;
    setStep(next);
    announceStep(next);
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const announceStep = (s: number) => {
    const headings = [
      "أهلاً بيك في سهلها عليا",
      "هل تحب تشغيل التوجيه الصوتي؟",
      "اختار حجم الخط المناسب",
      "اختار طريقة العرض",
    ];
    AccessibilityInfo.announceForAccessibility(headings[s]);
  };

  const primaryLabel = step === 0 ? "بدء" : step === STEPS - 1 ? "ابدأ الآن" : "التالي";

  return (
    <View style={{ flex: 1, backgroundColor: c.pageBg }}>
      <View style={{ flex: 1, padding: 28, paddingTop: 56 }}>
        {step === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 20 }}>
            <View
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: "#FFFFFF",
                borderWidth: 3,
                borderColor: c.ink,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: "#3D4DB3",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#0E0E14" }} />
              </View>
            </View>
            <Text style={{ fontFamily: "Cairo_900Black", fontSize: 30, color: c.ink, textAlign: "center" }}>
              سهلها عليا
            </Text>
            <Text
              style={{
                fontFamily: "IBMPlexSansArabic_400Regular",
                fontSize: 16,
                lineHeight: 27,
                color: c.secondary,
                textAlign: "center",
                maxWidth: 280,
              }}
            >
              بتحوّل مستنداتك لمحادثة، بالذكاء الاصطناعي والتعرف على النصوص والصوت.
            </Text>
          </View>
        ) : null}

        {step === 1 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 24 }}>
            <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 24, color: c.ink, textAlign: "center" }}>
              هل تحب تشغيل التوجيه الصوتي؟
            </Text>
            <Text
              style={{
                fontFamily: "IBMPlexSansArabic_400Regular",
                fontSize: 16,
                lineHeight: 27,
                color: c.secondary,
                textAlign: "center",
                maxWidth: 280,
              }}
            >
              هنقرا لك كل شاشة بصوت عالي أول ما تفتحها. تقدر تغيّر ده بعدين من الإعدادات.
            </Text>
            <Pressable
              onPress={toggleVoiceGuidance}
              accessibilityRole="switch"
              accessibilityState={{ checked: voiceGuidance }}
              accessibilityLabel="تشغيل أو إيقاف التوجيه الصوتي"
              style={{
                width: 120,
                height: 64,
                borderRadius: 999,
                borderWidth: 3,
                borderColor: c.ink,
                backgroundColor: voiceGuidance ? c.primaryBg : c.surface,
                padding: 4,
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: voiceGuidance ? c.primaryFg : c.ink,
                  marginLeft: voiceGuidance ? 0 : "auto",
                  marginRight: voiceGuidance ? "auto" : 0,
                }}
              />
            </Pressable>
            <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 15, color: c.ink }}>
              {voiceGuidance ? "مُفعّل" : "متوقف"}
            </Text>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 22 }}>
            <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 24, color: c.ink, textAlign: "center" }}>
              اختار حجم الخط المناسب
            </Text>
            <View style={{ flexDirection: "row-reverse", gap: 10 }}>
              {TEXT_SIZES.map((opt) => {
                const active = textSizePref === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setTextSizePref(opt.value)}
                    accessibilityRole="button"
                    accessibilityLabel={opt.value}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: c.ink,
                      backgroundColor: active ? c.ink : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "IBMPlexSansArabic_700Bold",
                        fontSize: 14,
                        color: active ? c.pageBg : c.ink,
                      }}
                    >
                      {opt.value}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ borderWidth: 2, borderColor: c.border, borderRadius: 16, padding: 22, width: "100%" }}>
              <Text
                style={{
                  fontSize: DEMO_FONT_SIZE[textSizePref],
                  lineHeight: DEMO_FONT_SIZE[textSizePref] * 1.6,
                  fontFamily: "IBMPlexSansArabic_600SemiBold",
                  color: c.ink,
                }}
              >
                مثال: تاريخ انتهاء البطاقة أول يناير ٢٠٢٧
              </Text>
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18 }}>
            <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 24, color: c.ink, textAlign: "center" }}>
              اختار طريقة العرض
            </Text>
            <View style={{ gap: 14, width: "100%" }}>
              <Pressable
                onPress={() => setHighContrast(false)}
                accessibilityRole="button"
                accessibilityLabel="وضع عادي، خلفية بيضاء ونص غامق"
                style={{
                  padding: 20,
                  borderRadius: 16,
                  borderWidth: !highContrast ? 3 : 2,
                  borderColor: c.ink,
                  backgroundColor: "#FFFFFF",
                }}
              >
                <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 16, color: "#0E0E14", textAlign: "right" }}>
                  وضع عادي — خلفية بيضا ونص غامق
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setHighContrast(true)}
                accessibilityRole="button"
                accessibilityLabel="تباين عالي، خلفية سوداء ونص أبيض"
                style={{
                  padding: 20,
                  borderRadius: 16,
                  borderWidth: highContrast ? 3 : 2,
                  borderColor: c.ink,
                  backgroundColor: "#000000",
                }}
              >
                <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 16, color: "#FFFFFF", textAlign: "right" }}>
                  تباين عالي — خلفية سودا ونص أبيض
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: "row-reverse", justifyContent: "center", gap: 8, paddingVertical: 14 }}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === step ? c.ink : c.border,
              }}
            />
          ))}
        </View>

        <View style={{ flexDirection: "row-reverse", gap: 12 }}>
          {step > 0 ? (
            <Pressable
              onPress={goBack}
              accessibilityRole="button"
              accessibilityLabel="السابق"
              style={{
                flex: 1,
                paddingVertical: 16,
                borderRadius: 14,
                borderWidth: 2,
                borderColor: c.ink,
                alignItems: "center",
              }}
            >
              <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 16, color: c.ink }}>السابق</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={goNext}
            accessibilityRole="button"
            accessibilityLabel={primaryLabel}
            style={{
              flex: 2,
              paddingVertical: 16,
              borderRadius: 14,
              backgroundColor: c.primaryBg,
              alignItems: "center",
            }}
          >
            <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 17, color: c.primaryFg }}>{primaryLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
