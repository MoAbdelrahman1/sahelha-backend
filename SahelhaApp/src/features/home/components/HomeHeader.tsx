import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const IconButton = ({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) => {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-14 w-14 items-center justify-center rounded-full bg-brandBlueDeep active:opacity-80"
    >
      <Ionicons name={icon} size={26} color="#FFFFFF" />
    </Pressable>
  );
};

export function HomeHeader() {
  return (
    <View className="flex-row-reverse items-center justify-between">
      <View className="flex-shrink">
        <Text className="text-right text-lg font-bold text-ink">مرحباً بك</Text>
        <Text className="mt-1 text-right text-4xl font-extrabold text-ink">سهلها عليا</Text>
      </View>

      <View className="flex-row-reverse items-center gap-3">
        <IconButton
          icon="notifications-outline"
          label="الإشعارات"
          // TODO: wire to a real notifications screen/panel once it exists.
          onPress={() => {}}
        />
        <IconButton
          icon="settings-outline"
          label="الإعدادات"
          // TODO: wire to a real settings screen once it exists.
          onPress={() => {}}
        />
      </View>
    </View>
  );
}
