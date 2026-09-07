import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

const SAMPLE_SERVICES = [
  { id: "national-id", title: "تجديد البطاقة الشخصية", icon: "card-outline" },
  {
    id: "birth-certificate",
    title: "شهادة الميلاد",
    icon: "document-text-outline",
  },
  { id: "pension", title: "المعاش", icon: "cash-outline" },
] as const;

export default function ServicesScreen() {
  return (
    <View className="flex-1 bg-white px-4 pt-6">
      <Text className="mb-2 text-center text-2xl font-bold text-gray-900">
        الخدمات
      </Text>
      <Text className="mb-6 text-center text-base text-gray-500">
        قيد الإنشاء
      </Text>

      {SAMPLE_SERVICES.map((service) => (
        <Link key={service.id} href={`/services/${service.id}`} asChild>
          <Pressable className="mb-3 min-h-[56px] flex-row items-center gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <Ionicons name={service.icon} size={28} color="#0B5FFF" />
            <Text className="text-lg text-gray-900">{service.title}</Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}
