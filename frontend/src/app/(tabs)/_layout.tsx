import { useEffect } from "react";
import { Tabs } from "expo-router";

import { BottomTabBar } from "@/components/common/BottomTabBar";
import { useDocuments } from "@/store/documentsStore";

// Home · Archive · Reminders · Settings + a floating center mic button (see
// BottomTabBar) — matches SPRINT_PLAN.md §5's navigation decision. Scan/Camera
// and the AI assistant are stack routes reached from Home/Document Detail, not
// tabs — the backend's /api/ai/ask is scoped to a document_id, so it never
// made sense as a standalone tab.
export default function TabsLayout() {
  const { refetch } = useDocuments();

  // DocumentsProvider is mounted at the app root (before login), so its own
  // mount-time fetch runs with no token yet and is skipped — refetch here
  // instead, the moment the authenticated tab area is actually reached
  // (right after login, and on every cold start that lands here directly).
  useEffect(() => {
    void refetch();
  }, [refetch]);

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <BottomTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="archive" />
      <Tabs.Screen name="reminders" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
