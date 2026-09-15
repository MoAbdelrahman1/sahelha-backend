import { Stack } from "expo-router";

export default function DirectServicesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[serviceId]" options={{ title: "التقديم بالصوت" }} />
    </Stack>
  );
}
