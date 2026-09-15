import React from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { AppHeader } from "@/components/ui/AppHeader";
import { useAppearance } from "@/store/appearanceStore";
import { useApplications, type ServiceApplication } from "@/store/applicationsStore";
import { palette } from "@/styles/theme";

function ApplicationCard({ app, c }: { app: ServiceApplication; c: ReturnType<typeof palette> }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: c.border,
        padding: 16,
        gap: 12,
      }}
    >
      {/* Header Row */}
      <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 17, color: c.ink, textAlign: "right" }}>
            {app.service_title}
          </Text>
          <Text style={{ fontFamily: "IBMPlexSansArabic_400Regular", fontSize: 12, color: c.secondary, textAlign: "right", marginTop: 2 }}>
            تاريخ التقديم: {new Date(app.created_at).toLocaleDateString("ar-EG")}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: "#E7EAFB",
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "#C3CCF6",
          }}
        >
          <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 12, color: "#33409B" }}>
            {app.status || "قيد المعالجة"}
          </Text>
        </View>
      </View>

      {/* Tracking Reference Code Box */}
      <View
        style={{
          flexDirection: "row-reverse",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: c.pageBg,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: c.border,
        }}
      >
        <Text style={{ fontFamily: "IBMPlexSansArabic_500Medium", fontSize: 13, color: c.secondary }}>
          رقم الطلب (كود المتابعة)
        </Text>
        <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 16, color: c.primaryBg }}>
          {app.reference_code}
        </Text>
      </View>

      {/* Accordion Toggle */}
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 4 }}
      >
        <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 13, color: c.secondary }}>
          {expanded ? "إخفاء بيانات التقديم" : "عرض بيانات التقديم والتفاصيل"}
        </Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={c.secondary} />
      </Pressable>

      {/* Expanded Answers List */}
      {expanded ? (
        <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, gap: 8 }}>
          {Object.entries(app.answers || {}).map(([key, val]) => (
            <View key={key} style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontFamily: "IBMPlexSansArabic_500Medium", fontSize: 13, color: c.secondary }}>
                {key}:
              </Text>
              <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 13, color: c.ink }}>
                {val}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function ApplicationsScreen() {
  const router = useRouter();
  const { highContrast } = useAppearance();
  const { applications, loading, refreshApplications } = useApplications();
  const [refreshing, setRefreshing] = React.useState(false);
  const c = palette(highContrast);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refreshApplications();
    setRefreshing(false);
  }, [refreshApplications]);

  return (
    <View style={{ flex: 1, backgroundColor: c.pageBg }}>
      <AppHeader title="طلباتي" showHome />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primaryBg} />}
      >
        <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 18, color: c.ink, textAlign: "right" }}>
          قائمة الطلبات المرفوعة والمتابعة
        </Text>

        {loading && applications.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator size="large" color={c.primaryBg} />
            <Text style={{ marginTop: 12, fontFamily: "IBMPlexSansArabic_500Medium", color: c.secondary }}>
              جارٍ تحميل الطلبات…
            </Text>
          </View>
        ) : applications.length === 0 ? (
          <View
            style={{
              paddingVertical: 36,
              paddingHorizontal: 20,
              alignItems: "center",
              gap: 12,
              backgroundColor: c.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "#E7EAFB", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="clipboard-outline" size={32} color={c.primaryBg} />
            </View>
            <Text style={{ fontFamily: "Cairo_800ExtraBold", fontSize: 18, color: c.ink, textAlign: "center" }}>
              لا توجد طلبات مقدمة بعد
            </Text>
            <Text style={{ fontFamily: "IBMPlexSansArabic_500Medium", fontSize: 14, color: c.secondary, textAlign: "center", lineHeight: 22 }}>
              عند التقديم على أي من 18 خدمة رقمية، ستظهر جميع الطلبات وأكواد المتابعة هنا تلقائياً.
            </Text>
            <Pressable
              onPress={() => router.push("/services")}
              style={{
                backgroundColor: c.primaryBg,
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 12,
                marginTop: 6,
              }}
            >
              <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 15, color: c.primaryFg }}>
                تصفح الخدمات الحكومية (١٨ خدمة)
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {applications.map((app) => (
              <ApplicationCard key={app.id} app={app} c={c} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
