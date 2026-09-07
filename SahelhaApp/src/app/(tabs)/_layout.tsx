import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

const ACTIVE_COLOR = "#0B5FFF";
const INACTIVE_COLOR = "#6B7280";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: { height: 72, paddingBottom: 10, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 13 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarAccessibilityLabel: "الرئيسية",
          tabBarIcon: ({ color }) => <Ionicons name="home" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "المساعد",
          tabBarAccessibilityLabel: "المساعد",
          tabBarIcon: ({ color }) => (
            <Ionicons name="chatbubble-ellipses" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "تصوير مستند",
          tabBarAccessibilityLabel: "تصوير مستند",
          tabBarIcon: ({ color }) => (
            <Ionicons name="camera" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: "الخدمات",
          tabBarAccessibilityLabel: "الخدمات",
          tabBarIcon: ({ color }) => (
            <Ionicons name="grid" size={28} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
