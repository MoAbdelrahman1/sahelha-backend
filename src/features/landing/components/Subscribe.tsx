import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui/Button";

export const Subscribe = () => {
  const [email, setEmail] = useState("");
  return (
    <View className="rounded-card bg-soft p-5">
      <Text className="text-right text-2xl font-extrabold text-ink">Stay in the loop</Text>
      <Text className="mt-2 text-right text-lg font-semibold leading-7 text-ink">
        Get product updates and practical notes about building better workflows.
      </Text>
      <View className="mt-5 gap-3">
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email address"
          placeholderTextColor="#374151"
          keyboardType="email-address"
          autoCapitalize="none"
          className="min-h-[56px] rounded-full border-2 border-line bg-white px-5 py-4 text-right text-xl font-bold text-ink"
        />
        <Button>Subscribe</Button>
      </View>
    </View>
  );
};
