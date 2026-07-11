import { Text, View } from "react-native";

export default function ChatScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-center text-2xl font-bold text-gray-900">
        المساعد
      </Text>
      <Text className="mt-2 text-center text-base text-gray-500">
        قيد الإنشاء
      </Text>
    </View>
  );
}
