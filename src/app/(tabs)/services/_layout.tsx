import { Stack } from "expo-router";

export default function ServicesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "الخدمات" }} />
      <Stack.Screen name="[serviceId]" options={{ title: "تفاصيل الخدمة" }} />
    </Stack>
  );
}
