import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/features/theme/ThemeContext";

type ActionCardsProps = {
  onBrowseServices?: () => void;
};

export const ActionCards = ({ onBrowseServices }: ActionCardsProps) => {
  const router = useRouter();
  const { colors, themeMode } = useTheme();

  return (
    <View style={[styles.section, { backgroundColor: colors.bgScreen }]}>
      <View style={styles.container}>
        {/* Card 1: افتح حساب أو سجّل الدخول (Right in RTL) */}
        <Pressable
          onPress={() => router.push("/login")}
          accessibilityRole="button"
          accessibilityLabel="افتح حساب أو سجّل الدخول، اشترك وكن جزءاً من سهلها عليا"
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.bgCard,
              borderColor: colors.border,
              borderWidth: colors.borderWidth,
            },
            pressed && styles.cardPressed,
          ]}
        >
          <View
            style={[
              styles.navyCircle,
              {
                backgroundColor: colors.btnPrimaryBg,
              },
            ]}
          >
            <Ionicons name="person" size={28} color={colors.btnPrimaryText} />
          </View>

          <View style={styles.textColumn}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              افتح حساب أو سجّل الدخول
            </Text>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
              اشترك واستفد من جميع الخدمات الحكومية الرقمية
            </Text>
          </View>
        </Pressable>

        {/* Card 2: تصفح كل الخدمات (Left in RTL) */}
        <Pressable
          onPress={onBrowseServices || (() => router.push("/(tabs)/services"))}
          accessibilityRole="button"
          accessibilityLabel="تصفح كل الخدمات، استعرض جميع الخدمات الحكومية المتاحة الآن"
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.bgCard,
              borderColor: colors.border,
              borderWidth: colors.borderWidth,
            },
            pressed && styles.cardPressed,
          ]}
        >
          <View
            style={[
              styles.greenCircle,
              {
                backgroundColor: themeMode === "high-contrast" ? "#000000" : "#2BB673",
              },
            ]}
          >
            <Ionicons
              name="add"
              size={32}
              color={themeMode === "high-contrast" ? "#FFCC00" : "#FFFFFF"}
            />
          </View>

          <View style={styles.textColumn}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              تصفح كل الخدمات
            </Text>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
              استعرض جميع خدمات مصر الرقمية مع إمكانية التقديم الصوتي
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  container: {
    maxWidth: 1200,
    width: "100%",
    marginHorizontal: "auto",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
  },
  card: {
    flex: 1,
    minWidth: 300,
    borderRadius: 16,
    padding: 24,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  cardPressed: {
    opacity: 0.85,
  },
  navyCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  greenCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  textColumn: {
    flex: 1,
    alignItems: "flex-end",
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "900",
    textAlign: "right",
    marginBottom: 4,
    lineHeight: 28,
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
    lineHeight: 20,
  },
});
