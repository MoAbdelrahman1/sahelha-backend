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
  scan: { label: "مستنداتي", icon: "documents-outline" },
  applications: { label: "طلباتي", icon: "clipboard-outline" },
  archive: { label: "الأرشيف", icon: "archive-outline" },
  reminders: { label: "التذكيرات", icon: "notifications-outline" },
  settings: { label: "الإعدادات", icon: "settings-outline" },
};

// Custom Tabs `tabBar` renderer: Archive · Scan · (mic) · Applications · Reminders · Settings
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

  const renderTab = (routeName: "settings" | "reminders" | "scan" | "archive" | "applications") => {
    const meta = TAB_META[routeName];
    const route = state.routes.find((r) => r.name === routeName);
    const focused = activeName === routeName;
    const color = focused ? c.ink : c.secondary;
    return (
      <Pressable
        key={routeName}
        onPress={() => route && navigation.navigate(route.name)}
        accessibilityRole="button"
        accessibilityLabel={meta?.label || routeName}
        style={{ minWidth: 44, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 3 }}
      >
        <Ionicons name={meta?.icon || "ellipse"} size={22} color={color} />
        <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 10.5, color }}>{meta?.label || routeName}</Text>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        flexDirection: "row-reverse",
        alignItems: "center",
        justifyContent: "space-around",
        paddingHorizontal: 4,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: c.border,
        backgroundColor: c.pageBg,
      }}
    >
      {renderTab("archive")}
      {renderTab("scan")}

      <Pressable
        onPress={openChatGlobal}
        accessibilityRole="button"
        accessibilityLabel="اسأل بالصوت عن مستند"
        style={{
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: c.primaryBg,
          alignItems: "center",
          justifyContent: "center",
          marginTop: -20,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
      >
        <Ionicons name="mic" size={26} color="#FFFFFF" />
      </Pressable>

      {renderTab("applications")}
      {renderTab("reminders")}
      {renderTab("settings")}
    </View>
  );
}
