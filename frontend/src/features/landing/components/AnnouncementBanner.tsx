import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTtsPlayer } from "@/features/voice/useTtsPlayer";
import { useTheme } from "@/features/theme/ThemeContext";

export const AnnouncementBanner = () => {
  const tts = useTtsPlayer();
  const { colors } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);

  const introText =
    "أهلاً بك في بوابة سهلها عليا للخدمات الحكومية. المنصة مهيأة بالكامل للمكفوفين وضعاف البصر، " +
    "مع دعم صوتي متكامل لقراءة البيانات وملء النماذج.";

  const handleToggleAudio = () => {
    if (isPlaying) {
      tts.stopCurrent();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      tts.speakTextContent(introText, "announcement-banner");
    }
  };

  return (
    <View
      style={[
        styles.bannerContainer,
        {
          backgroundColor: colors.bannerBg,
          borderBottomColor: colors.bannerBorder,
          borderBottomWidth: colors.borderWidth,
        },
      ]}
    >
      <View style={styles.contentWrapper}>
        <View style={styles.textGroup}>
          <Ionicons
            name="information-circle-outline"
            size={22}
            color={colors.textPrimary}
          />
          <Text style={[styles.bannerText, { color: colors.textPrimary }]}>
            بوابة <Text style={[styles.bannerTextBold, { color: colors.textPrimary }]}>سهلها عليا</Text> مهيأة بالكامل للمكفوفين وضعاف البصر مع دعم صوتي شامل لجميع الخدمات الحكومية.
          </Text>
        </View>

        <Pressable
          onPress={handleToggleAudio}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? "إيقاف الصوت" : "استمع لمقدمة البوابة"}
          style={({ pressed }) => [
            styles.audioButton,
            {
              backgroundColor: colors.btnPrimaryBg,
              borderColor: colors.border,
              borderWidth: colors.borderWidth,
            },
            pressed && styles.buttonPressed,
          ]}
        >
          <Ionicons
            name={isPlaying ? "volume-mute" : "volume-high"}
            size={18}
            color={colors.btnPrimaryText}
          />
          <Text style={[styles.audioButtonText, { color: colors.btnPrimaryText }]}>
            {isPlaying ? "إيقاف القراءة" : "استمع للمقدمة"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  contentWrapper: {
    maxWidth: 1200,
    width: "100%",
    marginHorizontal: "auto",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  textGroup: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 280,
  },
  bannerText: {
    textAlign: "right",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  bannerTextBold: {
    fontWeight: "900",
  },
  audioButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  audioButtonText: {
    fontSize: 14,
    fontWeight: "800",
  },
});
