import "../../global.css";

import { Stack } from "expo-router";
import { I18nManager } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/store/authStore";
import { AppearanceProvider } from "@/store/appearanceStore";
import { ApplicationsProvider } from "@/store/applicationsStore";
import { DocumentsProvider } from "@/store/documentsStore";
import { ToastProvider } from "@/store/toastStore";

// RTL only takes effect after the native app restarts (I18nManager caches
// the layout direction natively), so this applies on the next reload.
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

export default function RootLayout() {
  return (
    <AppearanceProvider>
      <AuthProvider>
        <ApplicationsProvider>
          <DocumentsProvider>
            <ToastProvider>
              <SafeAreaProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="login" />
                  <Stack.Screen name="register" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="services" />
                  <Stack.Screen name="+not-found" />
                </Stack>
              </SafeAreaProvider>
            </ToastProvider>
          </DocumentsProvider>
        </ApplicationsProvider>
      </AuthProvider>
    </AppearanceProvider>
  );
}
