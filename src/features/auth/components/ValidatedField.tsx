import React, { useEffect, useRef, useState } from "react";
import { KeyboardTypeOptions, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type FieldState = "neutral" | "red" | "green";

type ValidatedFieldProps = {
  /** Rich label node (may embed an isolated LTR run, e.g. the email example). */
  label: React.ReactNode;
  /** Plain-text version of the label, used for the screen-reader accessibilityLabel. */
  labelText: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Does the CURRENT (possibly partial) value contain something never valid? -> immediate RED. */
  hasInvalidChar: (value: string) => boolean;
  /** Is the FINISHED value fully valid? Used for GREEN on blur. */
  isValid: (value: string) => boolean;
  /** Email/password: true — blurring an incomplete value turns it RED. Name/phone: false — blur only ever adds GREEN. */
  blurRedIfInvalid?: boolean;
  errorHint: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  /** Bump this on a blocked submit to evaluate this field as if just blurred, even if the user never left it. */
  forceEvaluateTrigger?: number;
};

// Shared three-state (neutral / red / green) validated input for the auth
// screens. State is a pure function of (value, hasBeenBlurredSinceLastEdit):
//   - any invalid character present -> RED, regardless of blur.
//   - otherwise, once blurred -> GREEN if fully valid, else RED only for
//     fields that opt into blur-triggered errors (email/password), else NEUTRAL.
//   - otherwise (still typing, never blurred since the last edit) -> NEUTRAL.
// Typing again after a blur immediately clears the "blurred" flag, so GREEN
// never shows while actively typing, and deleting a bad character naturally
// falls back to NEUTRAL (no invalid char + not blurred) with no extra bookkeeping.
export function ValidatedField({
  label,
  labelText,
  placeholder,
  value,
  onChangeText,
  hasInvalidChar,
  isValid,
  blurRedIfInvalid = false,
  errorHint,
  secureTextEntry,
  keyboardType,
  autoCapitalize = "none",
  forceEvaluateTrigger,
}: ValidatedFieldProps) {
  const [blurred, setBlurred] = useState(false);

  // A blocked submit attempt (forceEvaluateTrigger changing) evaluates this
  // field as if it had just been blurred, so red borders/hints surface even
  // on fields the user never actually left — but not on initial mount.
  const isMount = useRef(true);
  useEffect(() => {
    if (isMount.current) {
      isMount.current = false;
      return;
    }
    setBlurred(true);
  }, [forceEvaluateTrigger]);

  const invalidChar = hasInvalidChar(value);
  const fullyValid = isValid(value);

  let state: FieldState = "neutral";
  if (invalidChar) {
    state = "red";
  } else if (blurred) {
    state = fullyValid ? "green" : blurRedIfInvalid ? "red" : "neutral";
  }

  const handleChangeText = (text: string) => {
    setBlurred(false);
    onChangeText(text);
  };

  const borderClass =
    state === "green"
      ? "border-4 border-green-700"
      : state === "red"
        ? "border-4 border-red-700"
        : "border-2 border-line";

  const accessibilityLabel =
    state === "red"
      ? `${labelText}. خطأ: ${errorHint}`
      : state === "green"
        ? `${labelText}. صحيح`
        : labelText;

  return (
    <View className="mb-6">
      <Text className="mb-2 text-right text-xl font-bold text-ink">{label}</Text>
      <View className="relative justify-center">
        <TextInput
          value={value}
          onChangeText={handleChangeText}
          onBlur={() => setBlurred(true)}
          placeholder={placeholder}
          placeholderTextColor="#374151"
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          accessibilityLabel={accessibilityLabel}
          aria-invalid={state === "red"}
          className={`min-h-[56px] rounded-2xl bg-white px-4 py-4 text-right text-xl font-bold text-ink ${borderClass}`}
          style={state !== "neutral" ? { paddingLeft: 48 } : undefined}
        />
        {state !== "neutral" ? (
          <View
            style={{ position: "absolute", left: 12 }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Ionicons
              name={state === "green" ? "checkmark-circle" : "close-circle"}
              size={28}
              color={state === "green" ? "#15803D" : "#B91C1C"}
            />
          </View>
        ) : null}
      </View>
      {state === "red" ? (
        <Text className="mt-2 text-right text-lg font-bold text-red-700">{errorHint}</Text>
      ) : null}
    </View>
  );
}
