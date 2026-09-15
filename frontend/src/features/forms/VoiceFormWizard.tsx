import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAudioRecorderHook } from "@/features/voice/useAudioRecorder";
import { useTtsPlayer, stopGlobalTts } from "@/features/voice/useTtsPlayer";
import { transcribeAudio } from "@/features/voice/api";
import {
  fetchServiceForm,
  submitServiceForm,
  type FormField,
  type FormSubmissionResponse,
  type ServiceFormSchema,
} from "@/features/services/api";

type WizardStatus = "loading" | "answering" | "confirming" | "review" | "submitting" | "success" | "error";

interface VoiceFormWizardProps {
  serviceId: string;
  onCancel?: () => void;
}

export function VoiceFormWizard({ serviceId, onCancel }: VoiceFormWizardProps) {
  const router = useRouter();

  const [schema, setSchema] = useState<ServiceFormSchema | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentDraft, setCurrentDraft] = useState("");
  const [wizardStatus, setWizardStatus] = useState<WizardStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<FormSubmissionResponse | null>(null);
  const [isManualEditing, setIsManualEditing] = useState(false);

  const recorder = useAudioRecorderHook();
  const tts = useTtsPlayer();
  const hasSpokenPromptRef = useRef<string | null>(null);

  // Load Form Schema
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setWizardStatus("loading");
        const data = await fetchServiceForm(serviceId);
        if (isMounted) {
          setSchema(data);
          setWizardStatus("answering");
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage("تعذر تحميل نموذج الخدمة. يرجى المحاولة مرة أخرى.");
          setWizardStatus("error");
        }
      }
    })();
    return () => {
      isMounted = false;
      stopGlobalTts();
    };
  }, [serviceId]);

  const currentField: FormField | undefined = schema?.fields[currentStep];

  // Auto-speak field prompt when entering a step
  useEffect(() => {
    if (wizardStatus === "answering" && currentField) {
      const promptKey = `${currentField.id}-${currentStep}`;
      if (hasSpokenPromptRef.current !== promptKey) {
        hasSpokenPromptRef.current = promptKey;
        tts.speakTextContent(currentField.prompt, `prompt-${currentField.id}`);
      }
    }
  }, [currentField, currentStep, wizardStatus]);

  // Start Voice Recording
  const handleStartRecording = async () => {
    setErrorMessage(null);
    tts.stopCurrent();
    const ok = await recorder.startRecording();
    if (!ok) {
      setErrorMessage("تعذر الوصول للميكروفون. يرجى التأكد من الأذونات.");
    }
  };

  // Stop Recording & Transcribe with Field-Specific Normalizer
  const handleStopRecordingAndTranscribe = async () => {
    if (!currentField) return;
    const uri = await recorder.stopRecording();
    if (!uri) {
      setErrorMessage("لم يتم التقاط أي صوت، حاول مجدداً.");
      return;
    }

    try {
      setWizardStatus("confirming");
      tts.stopCurrent();

      const res = await transcribeAudio(uri, currentField.field_type);
      const transcribedText = res.transcript.trim();

      if (!transcribedText) {
        setErrorMessage("لم نتمكن من سماع الإجابة بوضوح، يرجى إعادة التسجيل.");
        setWizardStatus("answering");
        return;
      }

      setCurrentDraft(transcribedText);

      // Read back captured answer
      const confirmationSpeech = `سجلت ${currentField.label}: ${transcribedText}. هل هذا صحيح؟`;
      tts.speakTextContent(confirmationSpeech, "readback-confirm");
    } catch (err) {
      setErrorMessage("حدث خطأ أثناء معالجة الصوت، يرجى إعادة المحاولة.");
      setWizardStatus("answering");
    }
  };

  // Confirm current field & move to next
  const handleConfirmStep = () => {
    if (!currentField || !schema) return;
    tts.stopCurrent();

    const updatedAnswers = { ...answers, [currentField.id]: currentDraft };
    setAnswers(updatedAnswers);
    setCurrentDraft("");
    setIsManualEditing(false);

    if (currentStep < schema.fields.length - 1) {
      setCurrentStep((prev) => prev + 1);
      setWizardStatus("answering");
    } else {
      // Finished all fields -> Review screen
      setWizardStatus("review");
      tts.speakTextContent("اكتملت جميع البيانات. يمكنك الآن مراجعتها وتأكيد الإرسال.", "review-intro");
    }
  };

  // Retry / Re-record current field
  const handleRetryStep = () => {
    tts.stopCurrent();
    setCurrentDraft("");
    setIsManualEditing(false);
    setWizardStatus("answering");
    if (currentField) {
      tts.speakTextContent(currentField.prompt, `prompt-retry-${currentField.id}`);
    }
  };

  // Final Form Submission
  const handleSubmitFinal = async () => {
    if (!schema) return;
    try {
      setWizardStatus("submitting");
      tts.stopCurrent();
      const res = await submitServiceForm(schema.service_id, answers);
      setSubmissionResult(res);
      setWizardStatus("success");
      tts.speakTextContent(
        `تم تأكيد طلبك بنجاح! رقمك المرجعي هو: ${res.reference_number}. يمكنك متابعة طلبك في أي وقت.`,
        "success-speech"
      );
    } catch (err) {
      setErrorMessage("تعذر إرسال الطلب، يرجى المحاولة مرة أخرى.");
      setWizardStatus("review");
    }
  };

  // ── Render Loading / Error ────────────────────────────────────────────────
  if (wizardStatus === "loading") {
    return (
      <View className="flex-1 items-center justify-center bg-white p-6">
        <ActivityIndicator size="large" color="#1D4ED8" />
        <Text className="mt-4 text-center text-xl font-extrabold text-gray-800">
          جارٍ تحضير استمارة التقديم الصوتي…
        </Text>
      </View>
    );
  }

  // ── Render Success Screen ─────────────────────────────────────────────────
  if (wizardStatus === "success" && submissionResult) {
    return (
      <ScrollView className="flex-1 bg-white p-6">
        <View className="items-center justify-center pt-8 pb-4">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-green-100 mb-4">
            <Ionicons name="checkmark-circle" size={56} color="#16A34A" />
          </View>
          <Text className="text-center text-2xl font-black text-gray-900 mb-2">
            تم استلام طلبك بنجاح!
          </Text>
          <Text className="text-center text-lg font-bold text-gray-600 mb-6">
            {submissionResult.service_title}
          </Text>

          {/* Large High-Contrast Reference Code Box for Partially Blind Users */}
          <View className="w-full rounded-2xl border-2 border-dashed border-brandBlueDeep bg-blue-50/80 p-5 mb-6 items-center">
            <Text className="text-sm font-bold text-gray-600 mb-1">الرقم المرجعي لمتابعة طلبك:</Text>
            <Text className="text-3xl font-black text-brandBlueDeep tracking-widest">
              {submissionResult.reference_number}
            </Text>
          </View>

          <Text className="text-center text-base font-bold text-gray-700 leading-relaxed mb-8">
            {submissionResult.message}
          </Text>

          <Pressable
            onPress={() => router.push("/services")}
            accessibilityRole="button"
            accessibilityLabel="العودة لقائمة الخدمات"
            className="w-full min-h-[64px] items-center justify-center rounded-2xl bg-brandBlueDeep active:opacity-85 shadow-md"
          >
            <Text className="text-xl font-black text-white">العودة للخدمات</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // ── Render Review Screen ──────────────────────────────────────────────────
  if (wizardStatus === "review" && schema) {
    return (
      <ScrollView className="flex-1 bg-white p-5">
        <Text className="text-right text-2xl font-black text-gray-900 mb-1">
          مراجعة بيانات الطلب
        </Text>
        <Text className="text-right text-base font-bold text-gray-500 mb-6">
          {schema.service_title}
        </Text>

        <View className="space-y-4 mb-8">
          {schema.fields.map((f) => (
            <View key={f.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <Text className="text-right text-sm font-bold text-gray-500 mb-1">{f.label}</Text>
              <Text className="text-right text-xl font-extrabold text-gray-900">
                {answers[f.id] || "لم يسجل"}
              </Text>
            </View>
          ))}
        </View>

        {errorMessage ? (
          <Text className="text-right text-base font-bold text-red-600 mb-4">{errorMessage}</Text>
        ) : null}

        <Pressable
          onPress={handleSubmitFinal}
          accessibilityRole="button"
          accessibilityLabel="تأكيد وإرسال الطلب النهائي"
          className="w-full min-h-[64px] items-center justify-center rounded-2xl bg-emerald-600 active:opacity-85 shadow-lg mb-4"
        >
          <Text className="text-2xl font-black text-white">تأكيد وإرسال الطلب ✓</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            setCurrentStep(0);
            setWizardStatus("answering");
          }}
          accessibilityRole="button"
          accessibilityLabel="تعديل البيانات من البداية"
          className="w-full min-h-[56px] items-center justify-center rounded-2xl border-2 border-gray-300 bg-white active:opacity-85 mb-8"
        >
          <Text className="text-lg font-bold text-gray-700">تعديل الإجابات</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── Render Field-By-Field Voice Wizard ─────────────────────────────────────
  const totalSteps = schema?.fields.length || 1;
  const progressPercent = Math.round(((currentStep + 1) / totalSteps) * 100);

  return (
    <ScrollView className="flex-1 bg-white p-5">
      {/* Top Header & Cancel Button */}
      <View className="flex-row-reverse items-center justify-between border-b border-gray-100 pb-3 mb-4">
        <View className="flex-1">
          <Text className="text-right text-xs font-bold text-brandBlueDeep">
            خطوة {currentStep + 1} من {totalSteps} ({progressPercent}%)
          </Text>
          <Text className="text-right text-lg font-black text-gray-900" numberOfLines={1}>
            {schema?.service_title}
          </Text>
        </View>
        {onCancel ? (
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="إلغاء وإغلاق الاستمارة"
            className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
          >
            <Ionicons name="close" size={20} color="#4B5563" />
          </Pressable>
        ) : null}
      </View>

      {/* Progress Bar */}
      <View className="h-2 w-full rounded-full bg-gray-100 mb-6 overflow-hidden">
        <View style={{ width: `${progressPercent}%` }} className="h-full bg-brandBlueDeep rounded-full" />
      </View>

      {/* Spoken Question Banner (Large 24pt Arabic Typography for Low-Vision) */}
      <View className="rounded-3xl border-2 border-blue-200 bg-blue-50/70 p-6 mb-6">
        <View className="flex-row-reverse items-center justify-between mb-3">
          <Text className="text-right text-sm font-extrabold text-brandBlueDeep">
            السؤال المطلوب بصوتك:
          </Text>
          <Pressable
            onPress={() => currentField && tts.speakTextContent(currentField.prompt, `repeat-${currentField.id}`)}
            accessibilityRole="button"
            accessibilityLabel="إعادة الاستماع للسؤال بصوت المساعد"
            className="flex-row-reverse items-center gap-1 rounded-full bg-white px-3 py-1.5 border border-blue-200"
          >
            <Ionicons name="volume-high" size={18} color="#1D4ED8" />
            <Text className="text-xs font-bold text-brandBlueDeep">استمع للسؤال</Text>
          </Pressable>
        </View>

        <Text className="text-right text-2xl font-black leading-snug text-gray-900 mb-2">
          {currentField?.prompt}
        </Text>
        <Text className="text-right text-base font-extrabold text-gray-500">
          الحقل: {currentField?.label}
        </Text>
      </View>

      {/* Fast-Track ID Card Camera Shortcut */}
      {(currentField?.id === "full_name" || currentField?.id === "national_id") && wizardStatus === "answering" ? (
        <Pressable
          onPress={() => router.push("/scan")}
          accessibilityRole="button"
          accessibilityLabel="تصوير بطاقة الرقم القومي واستخراج البيانات تلقائياً"
          className="mb-6 flex-row-reverse items-center justify-between rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4 active:opacity-85 shadow-sm"
        >
          <View className="flex-row-reverse items-center gap-3 flex-1">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-emerald-600">
              <Ionicons name="camera" size={20} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="text-right text-base font-extrabold text-emerald-900">
                تصوير بطاقة الرقم القومي (تلقائي)
              </Text>
              <Text className="text-right text-xs font-bold text-emerald-700">
                يملأ اسمك ورقمك القومي بدقة 100% بدون إملاء
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-back" size={20} color="#059669" />
        </Pressable>
      ) : null}

      {/* Error Notice */}
      {errorMessage ? (
        <View className="rounded-xl bg-red-50 p-3 mb-4 border border-red-200">
          <Text className="text-right text-sm font-bold text-red-700">{errorMessage}</Text>
        </View>
      ) : null}

      {/* ── Mode 1: Answering / Listening ────────────────────────────────── */}
      {wizardStatus === "answering" ? (
        <View className="items-center py-4 mb-8">
          {recorder.isRecording ? (
            <View className="w-full items-center">
              <View className="h-28 w-28 items-center justify-center rounded-full bg-red-100 mb-4 animate-pulse">
                <Ionicons name="mic" size={56} color="#DC2626" />
              </View>
              <Text className="text-center text-xl font-black text-red-600 mb-6">
                جارٍ الاستماع لإجابتك… تحدث الآن
              </Text>

              <Pressable
                onPress={handleStopRecordingAndTranscribe}
                accessibilityRole="button"
                accessibilityLabel="إنهاء التسجيل والتأكيد"
                className="w-full min-h-[64px] items-center justify-center rounded-2xl bg-red-600 active:opacity-85 shadow-lg"
              >
                <Text className="text-2xl font-black text-white">انتهيت من الإجابة ✓</Text>
              </Pressable>
            </View>
          ) : (
            <View className="w-full items-center">
              <Pressable
                onPress={handleStartRecording}
                accessibilityRole="button"
                accessibilityLabel="اضغط لبدء التحدث والإجابة بصوتك"
                className="w-full min-h-[72px] flex-row-reverse items-center justify-center gap-3 rounded-2xl bg-brandBlueDeep active:opacity-85 shadow-lg mb-4"
              >
                <Ionicons name="mic" size={32} color="#FFFFFF" />
                <Text className="text-2xl font-black text-white">اضغط وتحدث بالإجابة</Text>
              </Pressable>

              {/* Manual keyboard fallback for accessibility */}
              <Pressable
                onPress={() => setIsManualEditing(!isManualEditing)}
                className="py-2 active:opacity-70"
              >
                <Text className="text-sm font-bold text-gray-500 underline">
                  {isManualEditing ? "إخفاء لوحة المفاتيح" : "أو الكتابة يدوياً للمساعدة"}
                </Text>
              </Pressable>

              {isManualEditing ? (
                <View className="w-full mt-3">
                  <TextInput
                    value={currentDraft}
                    onChangeText={setCurrentDraft}
                    placeholder={currentField?.placeholder || "اكتب إجابتك هنا…"}
                    className="w-full min-h-[56px] rounded-2xl border border-gray-300 bg-gray-50 p-4 text-right text-lg font-bold text-gray-900"
                  />
                  {currentDraft.trim() ? (
                    <Pressable
                      onPress={handleConfirmStep}
                      className="mt-3 min-h-[50px] items-center justify-center rounded-xl bg-brandBlueDeep"
                    >
                      <Text className="text-base font-extrabold text-white">حفظ والمتابعة</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          )}
        </View>
      ) : null}

      {/* ── Mode 2: Verification / Confirmation Loop ─────────────────────── */}
      {wizardStatus === "confirming" ? (
        <View className="py-2 mb-8">
          <View className="rounded-2xl border-2 border-emerald-400 bg-emerald-50/60 p-5 mb-6">
            <Text className="text-right text-sm font-bold text-emerald-800 mb-1">
              تم التقاط إجابتك كالتالي:
            </Text>
            <Text className="text-right text-3xl font-black text-gray-900 mb-2">
              {currentDraft}
            </Text>
            <Text className="text-right text-xs font-bold text-emerald-700">
              استمع للتأكيد أو اضغط نعم للمتابعة
            </Text>
          </View>

          <Pressable
            onPress={handleConfirmStep}
            accessibilityRole="button"
            accessibilityLabel="نعم الإجابة صحيحة، حفظ ومتابعة"
            className="w-full min-h-[64px] flex-row-reverse items-center justify-center gap-3 rounded-2xl bg-emerald-600 active:opacity-85 shadow-lg mb-3"
          >
            <Ionicons name="checkmark-circle" size={28} color="#FFFFFF" />
            <Text className="text-2xl font-black text-white">نعم، الإجابة صحيحة ✓</Text>
          </Pressable>

          <Pressable
            onPress={handleRetryStep}
            accessibilityRole="button"
            accessibilityLabel="لا غير صحيحة، إعادة التسجيل الصوتي"
            className="w-full min-h-[56px] flex-row-reverse items-center justify-center gap-2 rounded-2xl border-2 border-amber-500 bg-amber-50 active:opacity-85"
          >
            <Ionicons name="refresh" size={22} color="#D97706" />
            <Text className="text-lg font-black text-amber-900">إعادة التسجيل بصوتك</Text>
          </Pressable>
        </View>
      ) : null}

      <View className="h-10" />
    </ScrollView>
  );
}
