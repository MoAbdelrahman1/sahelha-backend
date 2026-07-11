import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "الصفحة غير موجودة" }} />
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-center text-2xl font-bold text-gray-900">
          الصفحة غير موجودة
        </Text>
        <Link href="/" className="mt-4 text-base text-blue-600">
          العودة للرئيسية
        </Link>
      </View>
    </>
  );
}
