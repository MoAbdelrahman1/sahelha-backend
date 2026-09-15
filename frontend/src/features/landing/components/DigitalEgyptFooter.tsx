import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/features/theme/ThemeContext";

export const DigitalEgyptFooter = () => {
  const router = useRouter();
  const { colors, themeMode } = useTheme();

  const isLight = themeMode === "light";
  const bgCol = isLight ? "#0D254C" : colors.footerBg;
  const topBorderCol = isLight ? "#174384" : colors.border;
  const brandTitleCol = isLight ? "#FFFFFF" : colors.textPrimary;
  const brandDescCol = isLight ? "#BFDBFE" : colors.textSecondary;
  const headerCol = isLight ? "#FFFFFF" : colors.textPrimary;
  const linkCol = isLight ? "#93C5FD" : colors.textSecondary;

  return (
    <View
      style={[
        styles.footer,
        {
          backgroundColor: bgCol,
          borderTopColor: topBorderCol,
          borderTopWidth: 4,
        },
      ]}
    >
      <View style={styles.container}>
        <View style={[styles.topSection, { borderBottomColor: isLight ? "#1E3A8A" : colors.border }]}>
          {/* Brand Column */}
          <View style={styles.brandCol}>
            <View style={styles.brandTitleRow}>
              <View
                style={[
                  styles.brandIconBox,
                  {
                    backgroundColor: themeMode === "high-contrast" ? "#FFCC00" : "#2BB673",
                  },
                ]}
              >
                <Ionicons
                  name="business"
                  size={20}
                  color={themeMode === "high-contrast" ? "#000000" : "#FFFFFF"}
                />
              </View>
              <Text style={[styles.brandTitle, { color: brandTitleCol }]}>سهلها عليا</Text>
            </View>
            <Text style={[styles.brandDescription, { color: brandDescCol }]}>
              البوابة الرقمية الموحدة للخدمات الحكومية المصرية، مهيأة بالكامل
              بتقنيات الذكاء الاصطناعي والصوت لتمكين المكفوفين وضعاف البصر من
              إنجاز المعاملات الرسمية باستقلالية تامة.
            </Text>
          </View>

          {/* Links Column */}
          <View style={styles.linksCol}>
            <Text style={[styles.colTitle, { color: headerCol }]}>روابط سريعة</Text>
            <View style={styles.linksList}>
              <Pressable onPress={() => router.push("/(tabs)/services")}>
                <Text style={[styles.linkText, { color: linkCol }]}>تصفح جميع الخدمات</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/(tabs)/scan")}>
                <Text style={[styles.linkText, { color: linkCol }]}>مسح بطاقة الرقم القومي</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/(tabs)/chat")}>
                <Text style={[styles.linkText, { color: linkCol }]}>المساعد الصوتي الذكي</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/login")}>
                <Text style={[styles.linkText, { color: linkCol }]}>تسجيل الدخول الموحد</Text>
              </Pressable>
            </View>
          </View>

          {/* Hotline & Support Column */}
          <View style={styles.supportCol}>
            <Text style={[styles.colTitle, { color: headerCol }]}>
              الدعم الفني والشكاوى
            </Text>
            <View style={styles.supportList}>
              <View style={styles.hotlineRow}>
                <Ionicons name="call-outline" size={18} color="#2BB673" />
                <Text style={[styles.hotlineText, { color: headerCol }]}>الخط الساخن: 15999</Text>
              </View>
              <View style={styles.supportInfoRow}>
                <Ionicons name="time-outline" size={16} color="#60A5FA" />
                <Text style={[styles.supportInfoText, { color: brandDescCol }]}>
                  خدمة المواطنين على مدار 24 ساعة
                </Text>
              </View>
              <View style={styles.supportInfoRow}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#60A5FA" />
                <Text style={[styles.supportInfoText, { color: brandDescCol }]}>
                  بيانات مشفرة ومحمية بالكامل
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <Text style={[styles.copyrightText, { color: linkCol }]}>
            جمهورية مصر العربية - بوابة سهلها عليا 2026 جميع الحقوق محفوظة
          </Text>
          <Text style={[styles.wcagText, { color: isLight ? "#60A5FA" : colors.textSecondary }]}>
            متوافقة مع المعايير الدولية لإتاحة الويب للمكفوفين (WCAG 2.1 AA)
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    paddingTop: 44,
    paddingBottom: 28,
    paddingHorizontal: 16,
  },
  container: {
    maxWidth: 1200,
    width: "100%",
    marginHorizontal: "auto",
  },
  topSection: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 32,
    paddingBottom: 28,
    borderBottomWidth: 1,
  },
  brandCol: {
    maxWidth: 420,
    alignItems: "flex-end",
  },
  brandTitleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  brandIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "900",
  },
  brandDescription: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "right",
    lineHeight: 24,
  },
  linksCol: {
    minWidth: 150,
    alignItems: "flex-end",
  },
  colTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 14,
    textAlign: "right",
  },
  linksList: {
    gap: 10,
    alignItems: "flex-end",
  },
  linkText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
  },
  supportCol: {
    minWidth: 190,
    alignItems: "flex-end",
  },
  supportList: {
    gap: 12,
    alignItems: "flex-end",
  },
  hotlineRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  hotlineText: {
    fontSize: 16,
    fontWeight: "800",
  },
  supportInfoRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  supportInfoText: {
    fontSize: 12,
    fontWeight: "500",
  },
  bottomBar: {
    paddingTop: 20,
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  copyrightText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },
  wcagText: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "right",
  },
});
