import React from "react";
import { Tabs } from "expo-router";
import { BottomTabBar } from "@/components/common/BottomTabBar";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "مستنداتي" }} />
      <Tabs.Screen name="applications" options={{ title: "طلباتي" }} />
      <Tabs.Screen name="archive" options={{ title: "الأرشيف" }} />
      <Tabs.Screen name="reminders" options={{ title: "التذكيرات" }} />
      <Tabs.Screen name="settings" options={{ title: "الإعدادات" }} />
      <Tabs.Screen name="scan" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="services" options={{ href: null }} />
    </Tabs>
  );
}
