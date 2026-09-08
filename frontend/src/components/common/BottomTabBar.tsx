import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAppearance } from "@/store/appearanceStore";
import { useDocuments } from "@/store/documentsStore";
import { palette } from "@/styles/theme";

type TabRoute = { key: string; name: string };
type TabBarProps = {
  state: { index: number; routes: TabRoute[] };
  navigation: { navigate: (name: string) => void };
};

const TAB_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  index: { label: "مستنداتي", icon: "documents-outline" },
  archive: { label: "الأرشيف", icon: "archive-outline" },
  reminders: { label: "التذكيرات", icon: "notifications-outline" },
  settings: { label: "الإعدادات", icon: "settings-outline" },
};

// Custom Tabs `tabBar` renderer: Home · Archive · Reminders · Settings, plus a
// large floating center mic button (opens the AI assistant scoped to the most
// recently viewed document) — matches SPRINT_PLAN.md §5's navigation decision
// and the design mockup's persistent, fixed, always-reachable voice control
// (SAHELHA_DESIGN_BRIEF.md §5).
export function BottomTabBar({ state, navigation }: TabBarProps) {
  const router = useRouter();
  const { highContrast } = useAppearance();
  const { documents } = useDocuments();
  const c = palette(highContrast);
  const activeName = state.routes[state.index]?.name;

  const openChatGlobal = () => {
    const targetId = documents[0]?.id;
    if (targetId != null) router.push(`/document/${targetId}/chat`);
  };

  const renderTab = (routeName: "settings" | "reminders" | "index" | "archive") => {
    const meta = TAB_META[routeName];
    const route = state.routes.find((r) => r.name === routeName);
    const focused = activeName === routeName;
    const color = focused ? c.ink : c.secondary;
    return (
      <Pressable
        key={routeName}
        onPress={() => route && navigation.navigate(route.name)}
        accessibilityRole="button"
        accessibilityLabel={meta.label}
        style={{ minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 4 }}
      >
        <Ionicons name={meta.icon} size={22} color={color} />
        <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 11, color }}>{meta.label}</Text>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        flexDirection: "row-reverse",
        alignItems: "center",
        justifyContent: "space-around",
        paddingHorizontal: 8,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: c.border,
        backgroundColor: c.pageBg,
      }}
    >
      {renderTab("settings")}
      {renderTab("reminders")}

      <Pressable
        onPress={openChatGlobal}
        accessibilityRole="button"
        accessibilityLabel="اسأل بالصوت عن مستند"
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: c.primaryBg,
          alignItems: "center",
          justifyContent: "center",
          marginTop: -24,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
      >
        <Ionicons name="mic" size={28} color={c.primaryFg} />
      </Pressable>

      {renderTab("index")}
      {renderTab("archive")}
    </View>
  );
}
