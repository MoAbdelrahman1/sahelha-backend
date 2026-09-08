import { Tabs } from "expo-router";

import { BottomTabBar } from "@/components/common/BottomTabBar";

// Home · Archive · Reminders · Settings + a floating center mic button (see
// BottomTabBar) — matches SPRINT_PLAN.md §5's navigation decision. Scan/Camera
// and the AI assistant are stack routes reached from Home/Document Detail, not
// tabs — the backend's /api/ai/ask is scoped to a document_id, so it never
// made sense as a standalone tab.
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <BottomTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="archive" />
      <Tabs.Screen name="reminders" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
