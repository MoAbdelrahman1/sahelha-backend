import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useVoiceAssistant, type ChatMessage } from "@/features/voice/useVoiceAssistant";

export default function ChatScreen() {
  const router = useRouter();
  const [inputText, setInputText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const {
    messages,
    assistantState,
    errorMessage,
    durationMillis,
    speakingId,
    startListening,
    stopListeningAndAsk,
    cancelRecording,
    sendTextMessage,
    replayMessageAudio,
  } = useVoiceAssistant();

  const handleMicPress = () => {
    if (assistantState === "recording") {
      stopListeningAndAsk();
    } else if (assistantState === "idle" || assistantState === "error") {
      startListening();
    }
  };

  const handleSendText = () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText("");
    sendTextMessage(text);
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";
    const isSpeakingThis = speakingId === item.id;

    return (
      <View
        className={`my-2 max-w-[85%] rounded-2xl p-4 ${
          isUser
            ? "self-start bg-brandBlueDeep rounded-br-none"
            : "self-end border border-line bg-gray-50 rounded-bl-none shadow-sm"
        }`}
      >
        <Text
          className={`text-base font-bold leading-relaxed text-right ${
            isUser ? "text-white" : "text-gray-900"
          }`}
        >
          {item.text}
        </Text>

        {!isUser ? (
          <>
            {item.serviceId ? (
              <Pressable
                onPress={() => router.push(`/services/${item.serviceId}`)}
                accessibilityRole="button"
                accessibilityLabel={`الانتقال إلى ${item.serviceTitle || "الخدمة"}`}
                className="mt-3 flex-row-reverse items-center justify-between rounded-xl bg-brandBlueDeep px-3 py-2.5 active:opacity-85 shadow-sm"
              >
                <View className="flex-row-reverse items-center gap-2 flex-1">
                  <Ionicons name="document-text" size={18} color="#FFFFFF" />
                  <Text className="text-xs font-extrabold text-white text-right flex-1" numberOfLines={1}>
                    الانتقال لملء الاستمارة: {item.serviceTitle}
                  </Text>
                </View>
                <Ionicons name="chevron-back" size={16} color="#FFFFFF" />
              </Pressable>
            ) : null}

            <View className="mt-3 flex-row-reverse items-center justify-between border-t border-gray-200/80 pt-2">
              <Pressable
                onPress={() => replayMessageAudio(item)}
                accessibilityRole="button"
                accessibilityLabel={`استمع لإجابة المساعد ${item.text}`}
                className="flex-row-reverse items-center gap-1.5 rounded-full bg-blue-100/80 px-3 py-1 active:opacity-80"
              >
                <Ionicons
                  name={isSpeakingThis ? "volume-high" : "volume-medium"}
                  size={18}
                  color="#1D4ED8"
                />
                <Text className="text-xs font-extrabold text-brandBlueDeep">
                  {isSpeakingThis ? "جارٍ التشغيل…" : "استمع للإجابة"}
                </Text>
              </Pressable>

              <Text className="text-xs font-bold text-gray-400">
                {item.timestamp.toLocaleTimeString("ar-EG", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </>
        ) : (
          <Text className="mt-1 text-left text-xs font-bold text-blue-100">
            {item.timestamp.toLocaleTimeString("ar-EG", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="bg-white"
    >
      {/* Header */}
      <View className="border-b border-line bg-white px-5 py-3 pt-10 flex-row-reverse items-center justify-between shadow-sm">
        <View className="flex-row-reverse items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-brandBlueDeep/10">
            <Ionicons name="sparkles" size={22} color="#1D4ED8" />
          </View>
          <View>
            <Text className="text-right text-lg font-extrabold text-ink">
              المساعد الصوتي الذكي
            </Text>
            <Text className="text-right text-xs font-bold text-gray-500">
              سهلها عليا لمساعدتك في المستندات
            </Text>
          </View>
        </View>

        {assistantState === "speaking" ? (
          <View className="flex-row-reverse items-center gap-1 rounded-full bg-green-100 px-3 py-1">
            <Ionicons name="volume-high" size={16} color="#16A34A" />
            <Text className="text-xs font-bold text-green-700">يتحدث…</Text>
          </View>
        ) : null}
      </View>

      {/* Error banner */}
      {errorMessage ? (
        <View className="bg-red-50 px-4 py-2 border-b border-red-200">
          <Text className="text-right text-sm font-bold text-red-700">
            {errorMessage}
          </Text>
        </View>
      ) : null}

      {/* Message List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessageItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Sleek Non-Blocking Bottom Action Bar */}
      <View className="border-t border-line bg-white px-4 py-3">
        {assistantState === "recording" ? (
          <View className="flex-row-reverse items-center justify-between gap-3 rounded-full border border-red-200 bg-red-50 p-1.5 px-4">
            <View className="flex-row-reverse items-center gap-2">
              <View className="h-3 w-3 rounded-full bg-red-600 animate-pulse" />
              <Text className="text-base font-extrabold text-red-600">
                جارٍ الاستماع… {formatDuration(durationMillis)}
              </Text>
            </View>

            <View className="flex-row-reverse items-center gap-2">
              <Pressable
                onPress={stopListeningAndAsk}
                accessibilityRole="button"
                accessibilityLabel="إرسال التسجيل"
                className="h-10 w-10 items-center justify-center rounded-full bg-red-600 active:opacity-80"
              >
                <Ionicons name="send" size={18} color="#FFFFFF" />
              </Pressable>

              <Pressable
                onPress={cancelRecording}
                accessibilityRole="button"
                accessibilityLabel="إلغاء التسجيل"
                className="h-10 w-10 items-center justify-center rounded-full bg-gray-200 active:opacity-80"
              >
                <Ionicons name="close" size={18} color="#4B5563" />
              </Pressable>
            </View>
          </View>
        ) : assistantState === "thinking" ? (
          <View className="flex-row-reverse items-center justify-center gap-3 rounded-full border border-line bg-gray-50 py-2.5">
            <ActivityIndicator color="#1D4ED8" />
            <Text className="text-base font-extrabold text-brandBlueDeep">
              جارٍ التفكير والتأكد…
            </Text>
          </View>
        ) : (
          <View className="flex-row-reverse items-center gap-2">
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="اكتب سؤالك هنا أو اضغط الميكروفون…"
              placeholderTextColor="#9CA3AF"
              textAlign="right"
              onSubmitEditing={handleSendText}
              className="flex-1 min-h-[46px] rounded-full border border-line bg-gray-50 px-5 text-right text-base font-bold text-ink"
            />

            {inputText.trim().length > 0 ? (
              <Pressable
                onPress={handleSendText}
                accessibilityRole="button"
                accessibilityLabel="إرسال السؤال"
                className="h-11 w-11 items-center justify-center rounded-full bg-brandBlueDeep active:opacity-80 shadow-sm"
              >
                <Ionicons name="send" size={18} color="#FFFFFF" />
              </Pressable>
            ) : (
              <Pressable
                onPress={handleMicPress}
                accessibilityRole="button"
                accessibilityLabel="تحدث الآن مع سهلها عليا"
                className="h-11 w-11 items-center justify-center rounded-full bg-brandBlueDeep active:opacity-80 shadow-sm"
              >
                <Ionicons name="mic" size={20} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
