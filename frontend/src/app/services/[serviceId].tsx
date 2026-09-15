import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { AppHeader } from "@/components/ui/AppHeader";
import { useAppearance } from "@/store/appearanceStore";
import { useAuth } from "@/store/authStore";
import { useDocuments } from "@/store/documentsStore";
import { useApplications } from "@/store/applicationsStore";
import { palette } from "@/styles/theme";
import { apiClient } from "@/lib/api/client";
import { speakText } from "@/features/scan/api";

type FormField = {
  id: string;
  label: string;
  prompt: string;
  field_type: string;
  required: boolean;
  placeholder?: string;
};

type FormSchemaResponse = {
  service_id: string;
  service_title: string;
  category: string;
  description: string;
  fees_and_delivery: string;
  required_documents: string[];
  fields: FormField[];
};

export default function ServiceApplicationScreen() {
  const router = useRouter();
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const { highContrast } = useAppearance();
  const { user } = useAuth();
  const { documents } = useDocuments();
  const { submitApplication } = useApplications();
  const c = palette(highContrast);

  const [schema, setSchema] = useState<FormSchemaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confirmedFields, setConfirmedFields] = useState<Record<string, boolean>>({});
  const [editingField, setEditingField] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [recordingField, setRecordingField] = useState<string | null>(null);

  const handleStartVoiceForField = (field: FormField) => {
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = "ar-EG";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setRecordingField(field.id);

      recognition.onresult = (event: any) => {
        const transcript = (event.results?.[0]?.[0]?.transcript || "").trim();
        let finalVal = transcript;
        if (field.field_type === "confirmation") {
          if (transcript.includes("لا") || transcript.includes("غلط") || transcript.includes("مش")) {
            finalVal = "لا";
          } else {
            finalVal = "نعم";
          }
        }
        setAnswers((prev) => ({ ...prev, [field.id]: finalVal }));
        setConfirmedFields((prev) => ({ ...prev, [field.id]: true }));
        setEditingField(null);
        setRecordingField(null);
      };

      recognition.onerror = () => {
        setRecordingField(null);
      };

      recognition.onend = () => {
        setRecordingField(null);
      };

      recognition.start();
    } else {
      alert("التسجيل الصوتي يدعم متصفح Chrome أو Edge");
    }
  };

  // Load service schema and pre-fill from scanned National ID document
  useEffect(() => {
    async function loadForm() {
      if (!serviceId) return;
      try {
        const { data } = await apiClient.get<FormSchemaResponse>(`/api/services/${serviceId}/form`);
        setSchema(data);

        // Find primary scanned National ID document
        const nationalIdDoc = documents.find((d) => d.doc_type === "national_id" || d.doc_type === "unknown");

        const initialAnswers: Record<string, string> = {};
        const initialConfirmed: Record<string, boolean> = {};

        // Extracted name priority: scanned card entity > user.full_name
        let extractedName = user?.full_name || "";
        let extractedNid = "";
        let extractedGov = "";

        if (nationalIdDoc) {
          const entities = (nationalIdDoc as any).entities || {};
          if (entities.name) extractedName = entities.name;
          if (entities.national_number || entities.doc_number) {
            extractedNid = entities.national_number || entities.doc_number;
          }
          if (entities.governorate || entities.address) {
            extractedGov = entities.governorate || entities.address;
          }
        }

        data.fields.forEach((field) => {
          if (field.id === "full_name" && extractedName) {
            initialAnswers[field.id] = extractedName;
            initialConfirmed[field.id] = true;
          } else if (field.id === "national_id" && extractedNid) {
            initialAnswers[field.id] = extractedNid;
            initialConfirmed[field.id] = true;
          } else if (field.id === "delivery_address" && extractedGov) {
            initialAnswers[field.id] = extractedGov;
            initialConfirmed[field.id] = true;
          } else if (field.id === "phone" && user?.phone) {
            initialAnswers[field.id] = user.phone;
            initialConfirmed[field.id] = true;
          }
        });

        setAnswers(initialAnswers);
        setConfirmedFields(initialConfirmed);

        // Trigger Audio Assurance prompt for pre-filled data
        if (extractedName || extractedNid) {
          playAssuranceAudio(data.service_title, extractedName, extractedNid);
        }
      } catch (err) {
        console.error("Error loading service form schema:", err);
      } finally {
        setLoading(false);
      }
    }

    loadForm();
  }, [serviceId, documents, user]);

  const playAssuranceAudio = async (title: string, name: string, nid: string) => {
    try {
      setIsPlayingAudio(true);
      const text = `أهلاً بك في التقديم لخدمة ${title}. تم استخراج الاسم: ${name} والرقم القومي: ${nid} تلقائياً من بطاقتك الممسوحة. يرجى تأكيد البيانات أو تعديلها.`;
      await speakText(text);
    } catch {
      // Audio playback fallback
    } finally {
      setIsPlayingAudio(false);
    }
  };

  const handleFieldChange = (fieldId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  };

  const toggleConfirm = (fieldId: string) => {
    setConfirmedFields((prev) => ({ ...prev, [fieldId]: !prev[fieldId] }));
    setEditingField(null);
  };

  const handleSubmit = async () => {
    if (!schema || !serviceId) return;
    setSubmitting(true);
    try {
      const res = await submitApplication(serviceId, answers);
      setSubmittedRef(res.reference_code);
    } catch (err) {
      console.error("Submission error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.pageBg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={c.primaryBg} />
        <Text style={{ marginTop: 12, fontFamily: "IBMPlexSansArabic_600SemiBold", color: c.secondary }}>
          جارٍ تحميل استمارة الخدمة…
        </Text>
      </View>
    );
  }

  if (!schema) {
    return (
      <View style={{ flex: 1, backgroundColor: c.pageBg }}>
        <AppHeader title="الخدمات الحكومية" showBack showHome />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
          <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 18, color: c.ink, textAlign: "center" }}>
            لم يتم العثور على الخدمة المطلوبة
          </Text>
          <Pressable
            onPress={() => router.push("/")}
            style={{ marginTop: 16, backgroundColor: c.primaryBg, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 }}
          >
            <Text style={{ fontFamily: "Cairo_700Bold", color: c.primaryFg }}>العودة للرئيسية</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.pageBg }}>
      <AppHeader title={schema.service_title} showBack showHome />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 16 }}>
        {/* Service Title Banner */}
        <View style={{ backgroundColor: c.surface, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: c.border }}>
          <Text style={{ fontFamily: "Cairo_900Black", fontSize: 20, color: c.ink, textAlign: "right" }}>
            {schema.service_title}
          </Text>
          {schema.description ? (
            <Text style={{ fontFamily: "IBMPlexSansArabic_400Regular", fontSize: 14, color: c.secondary, textAlign: "right", marginTop: 6 }}>
              {schema.description}
            </Text>
          ) : null}
          {schema.fees_and_delivery ? (
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 10 }}>
              <Ionicons name="card-outline" size={18} color={c.primaryBg} />
              <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 13, color: c.primaryBg }}>
                {schema.fees_and_delivery}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Audio Assurance Banner */}
        <View
          style={{
            flexDirection: "row-reverse",
            alignItems: "center",
            gap: 12,
            backgroundColor: "#E7EAFB",
            padding: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#C3CCF6",
          }}
        >
          <Ionicons name="volume-high" size={24} color="#33409B" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 14, color: "#33409B", textAlign: "right" }}>
              تعبئة تلقائية مع الاستماع الصوتي
            </Text>
            <Text style={{ fontFamily: "IBMPlexSansArabic_400Regular", fontSize: 12, color: "#5B5B68", textAlign: "right" }}>
              تم استخراج بيانات البطاقة تلقائياً. تأكد من صحتها بالضغط على تأكيد ✓ أو التعديل.
            </Text>
          </View>
        </View>

        {/* Form Fields */}
        <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 16, color: c.ink, textAlign: "right", marginTop: 8 }}>
          بيانات الطلب المطلوبة
        </Text>

        {schema.fields.map((field) => {
          const val = answers[field.id] || "";
          const isConfirmed = confirmedFields[field.id];
          const isEditing = editingField === field.id;

          return (
            <View
              key={field.id}
              style={{
                backgroundColor: c.surface,
                padding: 16,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: isConfirmed ? "#1F7A4C" : c.border,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 15, color: c.ink, textAlign: "right" }}>
                  {field.label} {field.required ? "*" : ""}
                </Text>
                {isConfirmed && !isEditing ? (
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: "#E4F3EA", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                    <Ionicons name="checkmark-circle" size={16} color="#1F7A4C" />
                    <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 12, color: "#1F7A4C" }}>مؤكد ✓</Text>
                  </View>
                ) : null}
              </View>

              {isEditing || !isConfirmed ? (
                <TextInput
                  value={val}
                  onChangeText={(txt) => handleFieldChange(field.id, txt)}
                  placeholder={field.placeholder || field.label}
                  placeholderTextColor={c.secondary}
                  style={{
                    backgroundColor: c.pageBg,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 15,
                    fontFamily: "IBMPlexSansArabic_500Medium",
                    color: c.ink,
                    textAlign: "right",
                  }}
                />
              ) : (
                <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 16, color: c.ink, textAlign: "right" }}>
                  {val || "لم يدخل بعد"}
                </Text>
              )}

              <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <Pressable
                  onPress={() => handleStartVoiceForField(field)}
                  style={{
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: recordingField === field.id ? "#DC2626" : "#1D4ED8",
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                >
                  <Ionicons name="mic" size={16} color="#FFFFFF" />
                  <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 13, color: "#FFFFFF" }}>
                    {recordingField === field.id ? "جارٍ الاستماع… 🎙️" : "تحدث بالإجابة 🎙️"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => toggleConfirm(field.id)}
                  style={{
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: isConfirmed ? "#1F7A4C" : c.primaryBg,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                >
                  <Ionicons name="checkmark-sharp" size={16} color="#FFFFFF" />
                  <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 13, color: "#FFFFFF" }}>
                    {isConfirmed ? "تأكيد البيانات ✓" : "حفظ وتأكيد"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setEditingField(isEditing ? null : field.id)}
                  style={{
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: c.pageBg,
                    borderWidth: 1,
                    borderColor: c.border,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                >
                  <Ionicons name="pencil" size={15} color={c.ink} />
                  <Text style={{ fontFamily: "IBMPlexSansArabic_600SemiBold", fontSize: 13, color: c.ink }}>
                    {isEditing ? "إلغاء" : "تعديل ✏️"}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {/* Submit Action */}
        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={{
            minHeight: 58,
            backgroundColor: "#1F7A4C",
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row-reverse",
            gap: 10,
            marginTop: 12,
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#FFFFFF" />
              <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 18, color: "#FFFFFF" }}>
                تقديم الطلب الآن
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>

      {/* Success Modal with Tracking Reference Code */}
      {submittedRef ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
            zIndex: 9999,
          }}
        >
          <View
            style={{
              backgroundColor: c.pageBg,
              borderRadius: 20,
              padding: 24,
              width: "100%",
              maxWidth: 400,
              alignItems: "center",
              gap: 14,
            }}
          >
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#E4F3EA", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="checkmark-circle" size={44} color="#1F7A4C" />
            </View>

            <Text style={{ fontFamily: "Cairo_900Black", fontSize: 22, color: c.ink, textAlign: "center" }}>
              تم تقديم الطلب بنجاح!
            </Text>

            <Text style={{ fontFamily: "IBMPlexSansArabic_400Regular", fontSize: 14, color: c.secondary, textAlign: "center" }}>
              تم تسجيل طلبك برقم مرجعي للمتابعة. يمكن الاطلاع عليه دائماً في تبويب &quot;طلباتي&quot;.
            </Text>

            <View style={{ backgroundColor: c.surface, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1.5, borderColor: c.border, width: "100%", alignItems: "center" }}>
              <Text style={{ fontFamily: "IBMPlexSansArabic_400Regular", fontSize: 12, color: c.secondary }}>رقم الطلب (كود المتابعة)</Text>
              <Text style={{ fontFamily: "Cairo_900Black", fontSize: 22, color: c.primaryBg, marginTop: 4 }}>
                {submittedRef}
              </Text>
            </View>

            <Pressable
              onPress={() => {
                setSubmittedRef(null);
                router.push("/(tabs)/applications");
              }}
              style={{
                width: "100%",
                minHeight: 52,
                backgroundColor: c.primaryBg,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 8,
              }}
            >
              <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 16, color: c.primaryFg }}>
                الانتقال إلى طلباتي 📋
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
