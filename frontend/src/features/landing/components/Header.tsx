import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/features/theme/ThemeContext";

type HeaderProps = {
  onServicesPress?: () => void;
};

export const Header = ({ onServicesPress }: HeaderProps) => {
  const router = useRouter();
  const { colors, themeMode } = useTheme();

  return (
    <View
      accessibilityRole="header"
      style={[
        styles.header,
        {
          backgroundColor: colors.navBarBg,
          borderBottomColor: colors.border,
          borderBottomWidth: colors.borderWidth,
        },
      ]}
    >
      <View style={styles.container}>
        {/* Right Section: Logos (RTL) */}
        <View style={styles.rightGroup}>
          <Pressable
            onPress={() => router.push("/")}
            accessibilityRole="link"
            accessibilityLabel="سهلها عليا - الصفحة الرئيسية"
            style={({ pressed }) => [
              styles.logoPressable,
              pressed && styles.pressedState,
            ]}
          >
            <View
              style={[
                styles.emblemBox,
                {
                  backgroundColor: colors.btnPrimaryBg,
                  borderColor: colors.border,
                  borderWidth: colors.borderWidth,
                },
              ]}
            >
              <Ionicons
                name="business"
                size={24}
                color={colors.btnPrimaryText}
              />
            </View>
            <View style={styles.brandTextColumn}>
              <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>
                سهلها عليا
              </Text>
              <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>
                بوابة الخدمات الحكومية الرقمية
              </Text>
            </View>
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.ministryBox}>
            <Text style={[styles.ministryTitle, { color: colors.textPrimary }]}>
              جمهورية مصر العربية
            </Text>
            <Text style={[styles.ministrySubtitle, { color: colors.textSecondary }]}>
              وزارة الاتصالات وتكنولوجيا المعلومات
            </Text>
          </View>
        </View>

        {/* Center Section: Navigation Links */}
        <View style={styles.navLinks}>
          <Pressable
            onPress={onServicesPress || (() => router.push("/(tabs)/services"))}
            accessibilityRole="link"
            accessibilityLabel="تصفح جميع الخدمات الحكومية"
            style={({ pressed }) => [
              styles.navLink,
              pressed && styles.pressedState,
            ]}
          >
            <Text style={[styles.navLinkText, { color: colors.textPrimary }]}>
              تصفح الخدمات
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(tabs)/scan")}
            accessibilityRole="link"
            accessibilityLabel="مسح بطاقة الرقم القومي"
            style={({ pressed }) => [
              styles.navLink,
              pressed && styles.pressedState,
            ]}
          >
            <Text style={[styles.navLinkText, { color: colors.textPrimary }]}>
              مسح بطاقة الرقم القومي
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(tabs)/chat")}
            accessibilityRole="link"
            accessibilityLabel="المساعد الصوتي الذكي"
            style={({ pressed }) => [
              styles.navLink,
              pressed && styles.pressedState,
            ]}
          >
            <Text style={[styles.navLinkText, { color: colors.textPrimary }]}>
              المساعد الصوتي
            </Text>
          </Pressable>
        </View>

        {/* Left Section: Login & App Entry */}
        <View style={styles.leftGroup}>
          <Pressable
            onPress={() => router.push("/login")}
            accessibilityRole="button"
            accessibilityLabel="تسجيل الدخول إلى حسابك"
            style={({ pressed }) => [
              styles.loginButton,
              {
                backgroundColor: colors.btnPrimaryBg,
                borderColor: colors.border,
                borderWidth: colors.borderWidth,
              },
              pressed && styles.pressedState,
            ]}
          >
            <Ionicons name="person-circle-outline" size={22} color={colors.btnPrimaryText} />
            <Text style={[styles.loginButtonText, { color: colors.btnPrimaryText }]}>
              تسجيل الدخول
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(tabs)")}
            accessibilityRole="button"
            accessibilityLabel="القائمة الكاملة"
            style={({ pressed }) => [
              styles.menuButton,
              {
                backgroundColor: colors.bgSurface,
                borderColor: colors.border,
                borderWidth: colors.borderWidth,
              },
              pressed && styles.pressedState,
            ]}
          >
            <Ionicons name="menu" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 50,
  },
  container: {
    maxWidth: 1200,
    width: "100%",
    marginHorizontal: "auto",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rightGroup: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 16,
  },
  logoPressable: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  emblemBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTextColumn: {
    alignItems: "flex-end",
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26,
    textAlign: "right",
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },
  divider: {
    width: 1,
    height: 32,
  },
  ministryBox: {
    alignItems: "flex-end",
  },
  ministryTitle: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  ministrySubtitle: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "right",
  },
  navLinks: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 24,
  },
  navLink: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  navLinkText: {
    fontSize: 16,
    fontWeight: "700",
  },
  leftGroup: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  loginButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "800",
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  pressedState: {
    opacity: 0.8,
  },
});
