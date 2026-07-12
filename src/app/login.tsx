import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { AuthScreenShell } from "@/features/auth/components/AuthScreenShell";
import { ValidatedField } from "@/features/auth/components/ValidatedField";
import { emailHasInvalidChar, isValidEmail, isValidPassword, passwordHasInvalidChar } from "@/features/auth/validation";
import { login } from "@/features/auth/api";
import { ApiError } from "@/lib/api/errors";

// Unicode isolates (LRI/PDI) so the LTR example email inside this RTL label
// keeps its own left-to-right run and doesn't get visually reordered.
const LTR_ISOLATE_START = "⁦";
const LTR_ISOLATE_END = "⁩";

const EMAIL_ERROR_HINT = "البريد الإلكتروني غير صحيح";
const PASSWORD_ERROR_HINT = "كلمة المرور يجب ألا تقل عن 8 أحرف";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Bumped to force-remount every ValidatedField (clearing value + border
  // state) after a successful submit or when this screen regains focus.
  const [formKey, setFormKey] = useState(0);
  // Bumped on a blocked submit. Each ValidatedField only reacts to this if
  // IT is currently empty (flagging itself red) — a field with content is
  // never touched by this, so already-filled fields keep their own state.
  const [submitAttempt, setSubmitAttempt] = useState(0);

  const emailValid = isValidEmail(email);
  const passwordValid = isValidPassword(password);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFormError(null);
    setSubmitAttempt(0);
    setFormKey((key) => key + 1);
  };

  // Expo Router keeps this screen mounted when navigating away, so state
  // doesn't clear on its own — reset explicitly whenever the screen regains
  // focus (but not on the very first mount, where it's already empty).
  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      resetForm();
    }, [])
  );

  const onSubmit = async () => {
    setFormError(null);
    if (!emailValid || !passwordValid) {
      setSubmitAttempt((n) => n + 1);
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      resetForm(); // clear the password out of state before navigating away
      // Retarget point: where a successful login sends the user.
      router.replace("/(tabs)");
    } catch (error) {
      const message =
        error instanceof ApiError ? error.friendlyMessageAr : "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.";
      setFormError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenShell>
      <Text className="mb-7 text-right text-4xl font-extrabold text-ink">تسجيل الدخول</Text>

      <ValidatedField
        key={`email-${formKey}`}
        label={
          <Text>
            البريد الإلكتروني{" "}
            <Text style={{ writingDirection: "ltr" }}>
              {LTR_ISOLATE_START}(example@gmail.com){LTR_ISOLATE_END}
            </Text>
          </Text>
        }
        labelText="البريد الإلكتروني، مثال example@gmail.com"
        placeholder="البريد الإلكتروني"
        value={email}
        onChangeText={setEmail}
        hasInvalidChar={emailHasInvalidChar}
        isValid={isValidEmail}
        blurRedIfInvalid
        errorHint={EMAIL_ERROR_HINT}
        keyboardType="email-address"
        autoCapitalize="none"
        forceEvaluateTrigger={submitAttempt}
      />

      <ValidatedField
        key={`password-${formKey}`}
        label="أدخل كلمة المرور"
        labelText="أدخل كلمة المرور"
        placeholder="كلمة المرور"
        value={password}
        onChangeText={setPassword}
        hasInvalidChar={passwordHasInvalidChar}
        isValid={isValidPassword}
        blurRedIfInvalid
        liveGreen
        errorHint={PASSWORD_ERROR_HINT}
        secureTextEntry
        autoCapitalize="none"
        forceEvaluateTrigger={submitAttempt}
      />

      {formError ? <Text className="mb-4 text-right text-lg font-bold text-red-700">{formError}</Text> : null}

      <Pressable
        onPress={onSubmit}
        disabled={loading}
        className={`min-h-[56px] items-center justify-center rounded-full bg-brandBlueDeep px-6 py-4 active:opacity-80 ${
          loading ? "opacity-60" : ""
        }`}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text className="text-2xl font-bold text-white">تسجيل الدخول</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.push("/register")} className="mt-6 min-h-[56px] items-center justify-center">
        <Text className="text-right text-xl font-bold text-brandBlueDeep">إنشاء حساب جديد</Text>
      </Pressable>
    </AuthScreenShell>
  );
}
