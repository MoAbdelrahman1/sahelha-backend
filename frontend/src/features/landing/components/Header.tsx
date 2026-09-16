import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/features/theme/ThemeContext";
import { useAuth } from "@/store/authStore";

type HeaderProps = {
  onServicesPress?: () => void;
};

export const Header = ({ onServicesPress }: HeaderProps) => {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, isLoggedIn, logoutUser } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    setIsMenuOpen(false);
    await logoutUser();
    router.replace("/");
  };

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
            onPress={() => router.push("/")}
            accessibilityRole="link"
            accessibilityLabel="الرئيسية"
            style={({ pressed }) => [
              styles.navLink,
              pressed && styles.pressedState,
            ]}
          >
            <Text style={[styles.navLinkText, { color: colors.textPrimary }]}>
              الرئيسية
            </Text>
          </Pressable>

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

        {/* Left Section: Login / User Profile & App Entry */}
        <View style={styles.leftGroup}>
          {isLoggedIn && user ? (
            <Pressable
              onPress={() => setIsUserMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`حساب ${user.full_name}`}
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
              <Ionicons name="person-circle" size={22} color={colors.btnPrimaryText} />
              <Text style={[styles.loginButtonText, { color: colors.btnPrimaryText }]} numberOfLines={1}>
                {user.full_name || user.email}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.btnPrimaryText} />
            </Pressable>
          ) : (
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
          )}

          <Pressable
            onPress={() => setIsMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="فتح القائمة الرئيسية"
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

      {/* User Account Dropdown Modal */}
      <Modal
        visible={isUserMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsUserMenuOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsUserMenuOpen(false)}>
          <View
            style={[
              styles.drawerContent,
              {
                backgroundColor: colors.bgSurface,
                borderColor: colors.border,
                borderWidth: colors.borderWidth,
              },
            ]}
          >
            <View style={styles.drawerHeader}>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.drawerTitle, { color: colors.textPrimary }]}>
                  {user?.full_name || "الحساب الشخصي"}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  {user?.email}
                </Text>
              </View>
              <Pressable
                onPress={() => setIsUserMenuOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="إغلاق القائمة"
                style={styles.closeDrawerBtn}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.drawerItem,
                { borderBottomColor: colors.border, borderBottomWidth: 1 },
                pressed && styles.pressedState,
              ]}
              onPress={() => {
                setIsUserMenuOpen(false);
                router.push("/");
              }}
            >
              <Ionicons name="home-outline" size={22} color={colors.textPrimary} />
              <Text style={[styles.drawerItemText, { color: colors.textPrimary }]}>
                الصفحة الرئيسية
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.drawerItem,
                { borderBottomColor: colors.border, borderBottomWidth: 1 },
                pressed && styles.pressedState,
              ]}
              onPress={() => {
                setIsUserMenuOpen(false);
                router.push("/(tabs)/scan");
              }}
            >
              <Ionicons name="folder-open-outline" size={22} color={colors.textPrimary} />
              <Text style={[styles.drawerItemText, { color: colors.textPrimary }]}>
                مستنداتي الممسوحة ضوئياً
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.drawerItem,
                { borderBottomColor: colors.border, borderBottomWidth: 1 },
                pressed && styles.pressedState,
              ]}
              onPress={() => {
                setIsUserMenuOpen(false);
                if (onServicesPress) onServicesPress();
                else router.push("/(tabs)/services");
              }}
            >
              <Ionicons name="grid-outline" size={22} color={colors.textPrimary} />
              <Text style={[styles.drawerItemText, { color: colors.textPrimary }]}>
                تصفح الخدمات
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.drawerItem,
                pressed && styles.pressedState,
              ]}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={22} color="#B3261E" />
              <Text style={[styles.drawerItemText, { color: "#B3261E" }]}>
                تسجيل الخروج
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Accessible Quick Navigation Modal Drawer */}
      <Modal
        visible={isMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMenuOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsMenuOpen(false)}>
          <View
            style={[
              styles.drawerContent,
              {
                backgroundColor: colors.bgSurface,
                borderColor: colors.border,
                borderWidth: colors.borderWidth,
              },
            ]}
          >
            <View style={styles.drawerHeader}>
              <Text style={[styles.drawerTitle, { color: colors.textPrimary }]}>
                قائمة التصفح السريع
              </Text>
              <Pressable
                onPress={() => setIsMenuOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="إغلاق القائمة"
                style={styles.closeDrawerBtn}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.drawerItem,
                { borderBottomColor: colors.border, borderBottomWidth: 1 },
                pressed && styles.pressedState,
              ]}
              onPress={() => {
                setIsMenuOpen(false);
                router.push("/");
              }}
            >
              <Ionicons name="home-outline" size={22} color={colors.textPrimary} />
              <Text style={[styles.drawerItemText, { color: colors.textPrimary }]}>
                الرئيسية
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.drawerItem,
                { borderBottomColor: colors.border, borderBottomWidth: 1 },
                pressed && styles.pressedState,
              ]}
              onPress={() => {
                setIsMenuOpen(false);
                if (onServicesPress) onServicesPress();
                else router.push("/(tabs)/services");
              }}
            >
              <Ionicons name="grid-outline" size={22} color={colors.textPrimary} />
              <Text style={[styles.drawerItemText, { color: colors.textPrimary }]}>
                تصفح جميع الخدمات الرقمية (18 خدمة)
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.drawerItem,
                { borderBottomColor: colors.border, borderBottomWidth: 1 },
                pressed && styles.pressedState,
              ]}
              onPress={() => {
                setIsMenuOpen(false);
                router.push("/(tabs)/scan");
              }}
            >
              <Ionicons name="camera-outline" size={22} color={colors.textPrimary} />
              <Text style={[styles.drawerItemText, { color: colors.textPrimary }]}>
                مسح بطاقة الرقم القومي والمستندات
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.drawerItem,
                { borderBottomColor: colors.border, borderBottomWidth: 1 },
                pressed && styles.pressedState,
              ]}
              onPress={() => {
                setIsMenuOpen(false);
                router.push("/(tabs)/chat");
              }}
            >
              <Ionicons name="mic-outline" size={22} color={colors.textPrimary} />
              <Text style={[styles.drawerItemText, { color: colors.textPrimary }]}>
                المساعد الصوتي الذكي
              </Text>
            </Pressable>

            {isLoggedIn && user ? (
              <Pressable
                style={({ pressed }) => [
                  styles.drawerItem,
                  pressed && styles.pressedState,
                ]}
                onPress={handleLogout}
              >
                <Ionicons name="log-out-outline" size={22} color="#B3261E" />
                <Text style={[styles.drawerItemText, { color: "#B3261E" }]}>
                  تسجيل الخروج ({user.full_name})
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.drawerItem,
                  pressed && styles.pressedState,
                ]}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push("/login");
                }}
              >
                <Ionicons name="person-outline" size={22} color={colors.textPrimary} />
                <Text style={[styles.drawerItemText, { color: colors.textPrimary }]}>
                  تسجيل الدخول إلى حسابك
                </Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    paddingTop: 60,
    paddingLeft: 20,
  },
  drawerContent: {
    width: 320,
    maxWidth: "90%",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  drawerHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#CBD5E1",
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  closeDrawerBtn: {
    padding: 4,
  },
  drawerItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  drawerItemText: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "right",
  },
});
