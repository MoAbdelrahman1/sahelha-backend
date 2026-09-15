import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAppearance } from "@/store/appearanceStore";
import { useApplications } from "@/store/applicationsStore";
import { useAuth } from "@/store/authStore";
import { useDocuments } from "@/store/documentsStore";
import {
  fetchServiceForm,
  submitServiceForm,
  type FormField,
  type FormSubmissionResponse,
  type ServiceFormSchema,
} from "@/features/services/api";
import { transcribeAudio } from "@/features/voice/api";
import { useAudioRecorderHook } from "@/features/voice/useAudioRecorder";
import { stopGlobalTts, useTtsPlayer } from "@/features/voice/useTtsPlayer";
import { palette } from "@/styles/theme";

interface ServiceApplicationScreenProps {
  serviceId: string;
  onCancel?: () => void;
}

export function ServiceApplicationScreen({ serviceId, onCancel }: ServiceApplicationScreenProps) {
  const router = useRouter();
  const { highContrast, toggleHighContrast } = useAppearance();
  const { user } = useAuth();
  const { documents } = useDocuments();
  const { submitApplication } = useApplications();

  const c = palette(highContrast);

  const [schema, setSchema] = useState<ServiceFormSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<FormSubmissionResponse | null>(null);

  // Field values & confirmation states
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [confirmedFields, setConfirmedFields] = useState<Record<string, boolean>>({});
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [recordingFieldId, setRecordingFieldId] = useState<string | null>(null);

  const recorder = useAudioRecorderHook();
  const tts = useTtsPlayer();
  const hasSpokenPromptRef = useRef<boolean>(false);

  // Load Form Schema & Pre-fill from Scanned Docs / User State
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchServiceForm(serviceId);
        if (!isMounted) return;

        setSchema(data);

        // Pre-fill defaults from scanned docs or logged-in user
        const initialValues: Record<string, string> = {};
        const initialConfirmed: Record<string, boolean> = {};

        // Find any scanned National ID or Birth Certificate from documentsStore
        const scannedIdDoc = documents.find((d) => d.doc_type === "national_id");
        const scannedBirthDoc = documents.find((d) => d.doc_type === "birth_certificate");

        // Helper to get fallback value for standard fields
        const uAny = user as any;
        const getStandardValue = (field: FormField): { val: string; isPreFilled: boolean } => {
          if (field.id === "full_name" || field.field_type === "name") {
            const val = uAny?.full_name || "محمود عصام عبدالعزيز قطب محمد";
            return { val, isPreFilled: true };
          }
          if (field.id === "national_id" || field.field_type === "national_id") {
            const val = uAny?.national_id || "28909091300595";
            return { val, isPreFilled: true };
          }
          if (field.id === "phone" || field.field_type === "phone") {
            const val = uAny?.phone_number || "01069616399";
            return { val, isPreFilled: true };
          }
          if (field.id === "delivery_address") {
            const val = uAny?.governorate ? `محافظة ${uAny.governorate}` : "القاهرة، مصر";
            return { val, isPreFilled: true };
          }
          return { val: "", isPreFilled: false };
        };

        data.fields.forEach((field) => {
          const { val, isPreFilled } = getStandardValue(field);
          if (isPreFilled && val) {
            initialValues[field.id] = val;
            initialConfirmed[field.id] = true;
          } else {
            initialValues[field.id] = "";
            initialConfirmed[field.id] = false;
          }
        });

        setFieldValues(initialValues);
        setConfirmedFields(initialConfirmed);
        setLoading(false);
      } catch (err) {
        if (isMounted) {
          setErrorMessage("تعذر تحميل بيانات الخدمة، يرجى المحاولة مرة أخرى.");
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
      stopGlobalTts();
    };
  }, [serviceId, user, documents]);

  // Auto-speak voice prompt ONLY for the first unconfirmed/missing field
  useEffect(() => {
    if (!schema || loading || hasSpokenPromptRef.current) return;

    const unconfirmedField = schema.fields.find((f) => !confirmedFields[f.id]);
    if (unconfirmedField) {
      hasSpokenPromptRef.current = true;
      const promptSpeech = `من فضلك، ${unconfirmedField.prompt}`;
      tts.speakTextContent(promptSpeech, `prompt-${unconfirmedField.id}`);
    }
  }, [schema, loading, confirmedFields]);

  // Voice recording handlers for specific field
  const handleStartVoiceRecording = async (fieldId: string) => {
    setErrorMessage(null);
    tts.stopCurrent();
    const ok = await recorder.startRecording();
    if (ok) {
      setRecordingFieldId(fieldId);
    } else {
      setErrorMessage("تعذر الوصول للميكروفون، يرجى التأكد من الأذونات.");
    }
  };

  const handleStopVoiceRecording = async (field: FormField) => {
    const uri = await recorder.stopRecording();
    setRecordingFieldId(null);
    if (!uri) {
      setErrorMessage("لم يتم التقاط أي صوت، يرجى إعادة التحدث.");
      return;
    }

    try {
      tts.stopCurrent();
      const res = await transcribeAudio(uri, field.field_type);
      const transcribed = res.transcript.trim();

      if (transcribed) {
        setFieldValues((prev) => ({ ...prev, [field.id]: transcribed }));
        setConfirmedFields((prev) => ({ ...prev, [field.id]: true }));
        setEditingFieldId(null);
        tts.speakTextContent(`سجلت: ${transcribed}`, `confirm-${field.id}`);
      } else {
        setErrorMessage("لم نتمكن من سماع الإجابة بوضوح، حاول مجدداً.");
      }
    } catch {
      setErrorMessage("حدث خطأ أثناء معالجة الصوت، حاول مرة أخرى.");
    }
  };

  // Toggle field confirmation
  const handleConfirmField = (fieldId: string) => {
    setConfirmedFields((prev) => ({ ...prev, [fieldId]: true }));
    setEditingFieldId(null);
  };

  // Toggle field editing
  const handleEditField = (fieldId: string) => {
    setEditingFieldId(fieldId);
    setConfirmedFields((prev) => ({ ...prev, [fieldId]: false }));
  };

  // Final submission handler
  const handleSubmitAll = async () => {
    if (!schema) return;
    try {
      setSubmitting(true);
      setErrorMessage(null);
      tts.stopCurrent();

      const res = await submitServiceForm(schema.service_id, fieldValues);
      await submitApplication(schema.service_id, fieldValues);

      setSubmissionResult(res);
      setSubmitting(false);

      tts.speakTextContent(
        `تم تأكيد طلبك بنجاح! كود المتابعة الخاص بك هو: ${res.reference_number}`,
        "success-speech"
      );
    } catch (err) {
      setSubmitting(false);
      setErrorMessage("تعذر إرسال الطلب، يرجى المحاولة مرة أخرى.");
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.pageBg, justifyContent: "center", alignItems: "center", padding: 24 }}>
        <ActivityIndicator size="large" color={c.primaryBg} />
        <Text style={{ marginTop: 16, fontSize: 18, fontWeight: "700", color: c.ink, textAlign: "center" }}>
          جارٍ تحضير استمارة الخدمة…
        </Text>
      </View>
    );
  }

  // Success view
  if (submissionResult) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: c.pageBg }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={{ alignItems: "center", paddingTop: 32, paddingBottom: 16 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#DCFCE7", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Ionicons name="checkmark-circle" size={56} color="#16A34A" />
          </View>

          <Text style={{ fontSize: 24, fontWeight: "900", color: c.ink, textAlign: "center", marginBottom: 8 }}>
            تم استلام طلبك بنجاح!
          </Text>

          <Text style={{ fontSize: 17, fontWeight: "700", color: c.secondary, textAlign: "center", marginBottom: 24 }}>
            {submissionResult.service_title}
          </Text>

          <View style={{ width: "100%", borderRadius: 16, borderWidth: 2, borderStyle: "dashed", borderColor: c.primaryBg, backgroundColor: "#E7EAFB", padding: 20, alignItems: "center", marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: c.secondary, marginBottom: 4 }}>
              رقم المتابعة لمتابعة طلبك:
            </Text>
            <Text style={{ fontSize: 30, fontWeight: "900", color: c.primaryBg, letterSpacing: 2 }}>
              {submissionResult.reference_number}
            </Text>
          </View>

          <Text style={{ fontSize: 16, fontWeight: "700", color: c.ink, textAlign: "center", lineHeight: 24, marginBottom: 32 }}>
            {submissionResult.message || "تم حفظ واستلام الطلب بنجاح. يمكنك متابعة حالة الطلب من قسم (طلباتي) في أي وقت."}
          </Text>

          <Pressable
            onPress={() => router.push("/applications")}
            style={{ width: "100%", minHeight: 60, borderRadius: 16, backgroundColor: c.primaryBg, alignItems: "center", justifyContent: "center", marginBottom: 12 }}
          >
            <Text style={{ fontSize: 18, fontWeight: "900", color: c.primaryText }}>متابعة طلباتي</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/")}
            style={{ width: "100%", minHeight: 52, borderRadius: 16, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.cardBg, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: c.ink }}>العودة للرئيسية</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.pageBg }}>
      <StatusBar barStyle={highContrast ? "light-content" : "dark-content"} backgroundColor={c.cardBg} />

      {/* ── Header Bar ──────────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row-reverse",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: c.cardBg,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}
      >
        {/* Back / Home button */}
        <Pressable
          onPress={onCancel ? onCancel : () => router.push("/")}
          accessibilityRole="button"
          accessibilityLabel="العودة إلى الرئيسية"
          style={{
            flexDirection: "row-reverse",
            alignItems: "center",
            gap: 4,
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 8,
            backgroundColor: highContrast ? "#374151" : "#F3F4F6",
          }}
        >
          <Ionicons name="chevron-back" size={20} color={c.ink} />
          <Text style={{ fontSize: 14, fontWeight: "700", color: c.ink }}>الرئيسية</Text>
        </Pressable>

        {/* Title */}
        <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: c.ink, marginHorizontal: 8 }} numberOfLines={1}>
          {schema?.service_title}
        </Text>

        {/* High Contrast Toggle Button */}
        <Pressable
          onPress={toggleHighContrast}
          accessibilityRole="button"
          accessibilityLabel="تبديل وضع التباين العالي"
          style={{
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 8,
            borderWidth: 1.5,
            borderColor: c.ink,
            backgroundColor: highContrast ? "#FACC15" : "#FFFFFF",
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: "800", color: highContrast ? "#000000" : c.ink }}>
            تباين عالٍ
          </Text>
        </Pressable>
      </View>

      {/* ── Single Page Cards Content ───────────────────────────────────────── */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 50, gap: 16 }}>
        {errorMessage ? (
          <View style={{ borderRadius: 12, backgroundColor: "#FEF2F2", borderWidth: 1.5, borderColor: "#EF4444", padding: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#B91C1C", textAlign: "right" }}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Form Fields Cards */}
        {schema?.fields.map((field) => {
          const isConfirmed = !!confirmedFields[field.id];
          const isEditing = editingFieldId === field.id;
          const isRecording = recordingFieldId === field.id;
          const val = fieldValues[field.id] || "";

          return (
            <View
              key={field.id}
              style={{
                backgroundColor: c.cardBg,
                borderRadius: 18,
                borderWidth: 2,
                borderColor: isConfirmed ? "#A7F3D0" : isEditing ? c.primaryBg : c.border,
                padding: 16,
                gap: 12,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              {/* Card Header Row: Badge (Left) & Field Title (Right) */}
              <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 17, fontWeight: "800", color: c.ink, textAlign: "right", flex: 1 }}>
                  {field.label} {field.required ? "*" : ""}
                </Text>

                {isConfirmed ? (
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: "#E6F4EA", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "#A7F3D0" }}>
                    <Ionicons name="checkmark-circle" size={16} color="#137333" />
                    <Text style={{ fontSize: 13, fontWeight: "800", color: "#137333" }}>مؤكد ✓</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: "#FEF3C7", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "#FDE68A" }}>
                    <Ionicons name="time-outline" size={15} color="#B45309" />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#B45309" }}>يتطلب الإجابة</Text>
                  </View>
                )}
              </View>

              {/* Value / Input Display */}
              {isEditing ? (
                <View style={{ gap: 10, marginTop: 4 }}>
                  <TextInput
                    value={val}
                    onChangeText={(text) => setFieldValues((prev) => ({ ...prev, [field.id]: text }))}
                    placeholder={field.placeholder || "أدخل الإجابة هنا..."}
                    placeholderTextColor={c.secondary}
                    style={{
                      width: "100%",
                      minHeight: 52,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: c.primaryBg,
                      backgroundColor: highContrast ? "#1F2937" : "#F9FAFB",
                      paddingHorizontal: 14,
                      fontSize: 17,
                      fontWeight: "700",
                      color: c.ink,
                      textAlign: "right",
                    }}
                  />

                  {/* Voice dictation button for field */}
                  <Pressable
                    onPress={() => (isRecording ? handleStopVoiceRecording(field) : handleStartVoiceRecording(field.id))}
                    style={{
                      minHeight: 48,
                      flexDirection: "row-reverse",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      borderRadius: 12,
                      backgroundColor: isRecording ? "#DC2626" : "#EFF6FF",
                      borderWidth: 1.5,
                      borderColor: isRecording ? "#B91C1C" : "#93C5FD",
                    }}
                  >
                    <Ionicons name={isRecording ? "stop-circle" : "mic"} size={22} color={isRecording ? "#FFFFFF" : "#1D4ED8"} />
                    <Text style={{ fontSize: 16, fontWeight: "800", color: isRecording ? "#FFFFFF" : "#1D4ED8" }}>
                      {isRecording ? "إنهاء التسجيل والتأكيد ⏹️" : "🎙️ تحدث بالإجابة بصوتك"}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ minHeight: 36, justifyContent: "center", paddingVertical: 4 }}>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: val ? c.ink : c.secondary, textAlign: "right" }}>
                    {val || "— لم يسجل بعد —"}
                  </Text>
                </View>
              )}

              {/* Card Action Buttons (Bottom Row) */}
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingTop: 4 }}>
                {/* Primary Confirm Button */}
                <Pressable
                  onPress={() => {
                    if (isEditing) {
                      handleConfirmField(field.id);
                    } else if (!val) {
                      handleEditField(field.id);
                    } else {
                      handleConfirmField(field.id);
                    }
                  }}
                  style={{
                    flex: 1,
                    minHeight: 46,
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    borderRadius: 12,
                    backgroundColor: isConfirmed ? "#137333" : c.primaryBg,
                  }}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={{ fontSize: 16, fontWeight: "800", color: "#FFFFFF" }}>
                    {isConfirmed ? "تأكيد البيانات ✓" : "حفظ وتأكيد ✓"}
                  </Text>
                </Pressable>

                {/* Edit Button */}
                <Pressable
                  onPress={() => handleEditField(field.id)}
                  style={{
                    minHeight: 46,
                    paddingHorizontal: 16,
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: "#D1D5DB",
                    backgroundColor: c.cardBg,
                  }}
                >
                  <Ionicons name="pencil" size={18} color="#E11D48" />
                  <Text style={{ fontSize: 15, fontWeight: "800", color: "#374151" }}>تعديل</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {/* ── Final Submit Button ─────────────────────────────────────────── */}
        <Pressable
          onPress={handleSubmitAll}
          disabled={submitting}
          style={{
            marginTop: 12,
            minHeight: 64,
            flexDirection: "row-reverse",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            borderRadius: 18,
            backgroundColor: "#16A34A",
            opacity: submitting ? 0.7 : 1,
            shadowColor: "#16A34A",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Ionicons name="paper-plane" size={24} color="#FFFFFF" />
          )}
          <Text style={{ fontSize: 20, fontWeight: "900", color: "#FFFFFF" }}>
            {submitting ? "جارٍ إرسال الطلب…" : "تأكيد وإرسال الطلب النهائي ✓"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
