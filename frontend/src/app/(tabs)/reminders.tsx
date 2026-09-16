import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "@/components/ui/AppHeader";
import {
  createReminder,
  deleteReminder,
  fetchReminders,
  isAutoReminder,
  type Reminder,
} from "@/features/reminders/api";
import { useAppearance } from "@/store/appearanceStore";
import { useDocuments } from "@/store/documentsStore";
import { useToast } from "@/store/toastStore";
import { palette } from "@/styles/theme";
import { DOC_TYPE_LABELS } from "@/types/document";

// Real Reminders screen: GET/POST/DELETE /api/reminders/ — list soonest-first,
// manual create, delete. Auto-created (expiry-based) reminders are visually
// and verbally distinguished from manually-added ones (see
// features/reminders/api.ts#isAutoReminder) — SPRINT_PLAN.md §3.
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatRemindAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} - ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function defaultDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default function RemindersScreen() {
  const { highContrast } = useAppearance();
  const { documents } = useDocuments();
  const { showToast } = useToast();
  const c = palette(highContrast);

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [dateStr, setDateStr] = useState(defaultDateStr());
  const [timeStr, setTimeStr] = useState("09:00");
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchReminders()
      .then(setReminders)
      .catch((err) => setError(err?.friendlyMessageAr ?? "تعذّر تحميل التذكيرات، حاول تاني"))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openCreateModal = () => {
    setMessage("");
    setDateStr(defaultDateStr());
    setTimeStr("09:00");
    setDocumentId(null);
    setModalVisible(true);
  };

  const submitCreate = async () => {
    const remindAtDate = new Date(`${dateStr}T${timeStr}:00`);
    if (Number.isNaN(remindAtDate.getTime())) {
      showToast("التاريخ أو الوقت غير صحيح");
      return;
    }

    setSaving(true);
    try {
      await createReminder({
        remind_at: remindAtDate.toISOString(),
        message: message.trim() || null,
        document_id: documentId,
      });
      setModalVisible(false);
      showToast("تم إضافة التذكير");
      load();
    } catch (err: any) {
      showToast(err?.friendlyMessageAr ?? "تعذّر إضافة التذكير");
    } finally {
      setSaving(false);
    }
  };

  const removeReminder = async (id: number) => {
    setReminders((rs) => rs.filter((r) => r.id !== id));
    try {
      await deleteReminder(id);
      showToast("تم حذف التذكير");
    } catch (err: any) {
      showToast(err?.friendlyMessageAr ?? "تعذّر حذف التذكير");
      load();
    }
  };

  const documentLabel = (docId: number | null): string | null => {
    if (docId === null) return null;
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return null;
    return doc.doc_type ? DOC_TYPE_LABELS[doc.doc_type] : "مستند";
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.pageBg }}>
      <AppHeader title="التذكيرات" />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={c.ink} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text
            role="alert"
            style={{ fontFamily: "IBMPlexSansArabic_600SemiBold", fontSize: 16, color: c.secondary, textAlign: "center" }}
          >
            {error}
          </Text>
          <Pressable
            onPress={load}
            accessibilityRole="button"
            accessibilityLabel="إعادة المحاولة"
            style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: c.primaryBg }}
          >
            <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 14, color: c.primaryFg }}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      ) : reminders.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 18, color: c.secondary, textAlign: "center" }}>
            لا توجد تذكيرات حالياً
          </Text>
          <Text
            style={{
              fontFamily: "IBMPlexSansArabic_400Regular",
              fontSize: 14,
              color: c.secondary,
              textAlign: "center",
              marginTop: 8,
            }}
          >
            اضغط على زر الإضافة لإنشاء تذكير جديد
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 100 }}>
          {reminders.map((reminder) => {
            const auto = isAutoReminder(reminder);
            const docLabel = documentLabel(reminder.document_id);
            return (
              <View
                key={reminder.id}
                style={{
                  borderWidth: 2,
                  borderColor: auto ? c.accent : c.border,
                  borderRadius: 14,
                  padding: 16,
                  backgroundColor: c.surface,
                  gap: 8,
                }}
              >
                <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
                  <View
                    style={{
                      flexDirection: "row-reverse",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: auto ? c.accent : c.border,
                    }}
                  >
                    <Ionicons name={auto ? "time" : "create"} size={13} color={auto ? "#FFFFFF" : c.ink} />
                    <Text
                      style={{
                        fontFamily: "IBMPlexSansArabic_700Bold",
                        fontSize: 11,
                        color: auto ? "#FFFFFF" : c.ink,
                      }}
                    >
                      {auto ? "تذكير تلقائي" : "تذكير يدوي"}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => removeReminder(reminder.id)}
                    accessibilityRole="button"
                    accessibilityLabel="حذف التذكير"
                    style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
                  >
                    <Ionicons name="trash-outline" size={20} color={c.secondary} />
                  </Pressable>
                </View>

                <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 16, color: c.ink, textAlign: "right" }}>
                  {reminder.message || "تذكير"}
                </Text>

                <Text style={{ fontFamily: "IBMPlexSansArabic_600SemiBold", fontSize: 14, color: c.secondary, textAlign: "right" }}>
                  {formatRemindAt(reminder.remind_at)}
                </Text>

                {docLabel ? (
                  <Text style={{ fontFamily: "IBMPlexSansArabic_400Regular", fontSize: 13, color: c.secondary, textAlign: "right" }}>
                    مرتبط بـ: {docLabel}
                  </Text>
                ) : null}

                {reminder.sent ? (
                  <Text style={{ fontFamily: "IBMPlexSansArabic_400Regular", fontSize: 12, color: c.secondary, textAlign: "right" }}>
                    تم الإرسال
                  </Text>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}

      <Pressable
        onPress={openCreateModal}
        accessibilityRole="button"
        accessibilityLabel="إضافة تذكير جديد"
        style={{
          position: "absolute",
          left: 20,
          bottom: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: c.primaryBg,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Ionicons name="add" size={30} color={c.primaryFg} />
      </Pressable>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: c.pageBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 14 }}>
            <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 18, color: c.ink, textAlign: "center" }}>
              تذكير جديد
            </Text>

            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: "IBMPlexSansArabic_600SemiBold", fontSize: 13, color: c.secondary, textAlign: "right" }}>
                نص التذكير
              </Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="مثال: تجديد رخصة القيادة"
                placeholderTextColor={c.secondary}
                accessibilityLabel="نص التذكير"
                style={{
                  borderWidth: 2,
                  borderColor: c.border,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: c.ink,
                  fontFamily: "IBMPlexSansArabic_400Regular",
                  fontSize: 15,
                  textAlign: "right",
                }}
              />
            </View>

            <View style={{ flexDirection: "row-reverse", gap: 10 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontFamily: "IBMPlexSansArabic_600SemiBold", fontSize: 13, color: c.secondary, textAlign: "right" }}>
                  التاريخ (سنة-شهر-يوم)
                </Text>
                <TextInput
                  value={dateStr}
                  onChangeText={setDateStr}
                  placeholder="2026-09-20"
                  placeholderTextColor={c.secondary}
                  accessibilityLabel="تاريخ التذكير"
                  style={{
                    borderWidth: 2,
                    borderColor: c.border,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: c.ink,
                    fontFamily: "IBMPlexSansArabic_400Regular",
                    fontSize: 15,
                    textAlign: "center",
                  }}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontFamily: "IBMPlexSansArabic_600SemiBold", fontSize: 13, color: c.secondary, textAlign: "right" }}>
                  الوقت (ساعة:دقيقة)
                </Text>
                <TextInput
                  value={timeStr}
                  onChangeText={setTimeStr}
                  placeholder="09:00"
                  placeholderTextColor={c.secondary}
                  accessibilityLabel="وقت التذكير"
                  style={{
                    borderWidth: 2,
                    borderColor: c.border,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: c.ink,
                    fontFamily: "IBMPlexSansArabic_400Regular",
                    fontSize: 15,
                    textAlign: "center",
                  }}
                />
              </View>
            </View>

            {documents.length > 0 ? (
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: "IBMPlexSansArabic_600SemiBold", fontSize: 13, color: c.secondary, textAlign: "right" }}>
                  ربط بمستند (اختياري)
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", gap: 8 }}>
                  <Pressable
                    onPress={() => setDocumentId(null)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: documentId === null }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 2,
                      borderColor: c.ink,
                      backgroundColor: documentId === null ? c.ink : "transparent",
                    }}
                  >
                    <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 13, color: documentId === null ? c.pageBg : c.ink }}>
                      بدون مستند
                    </Text>
                  </Pressable>
                  {documents.map((doc) => {
                    const selected = documentId === doc.id;
                    return (
                      <Pressable
                        key={doc.id}
                        onPress={() => setDocumentId(doc.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 999,
                          borderWidth: 2,
                          borderColor: c.ink,
                          backgroundColor: selected ? c.ink : "transparent",
                        }}
                      >
                        <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 13, color: selected ? c.pageBg : c.ink }}>
                          {doc.doc_type ? DOC_TYPE_LABELS[doc.doc_type] : `مستند #${doc.id}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 6 }}>
              <Pressable
                onPress={() => setModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="إلغاء"
                style={{
                  flex: 1,
                  minHeight: 52,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: c.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 15, color: c.ink }}>إلغاء</Text>
              </Pressable>
              <Pressable
                onPress={submitCreate}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="حفظ التذكير"
                style={{
                  flex: 1,
                  minHeight: 52,
                  borderRadius: 12,
                  backgroundColor: c.primaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={c.primaryFg} />
                ) : (
                  <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 15, color: c.primaryFg }}>حفظ</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
