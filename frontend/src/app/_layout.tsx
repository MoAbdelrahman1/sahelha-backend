import "../../global.css";

import { useEffect } from "react";
import { Stack } from "expo-router";
import { I18nManager } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, Cairo_700Bold, Cairo_800ExtraBold, Cairo_900Black } from "@expo-google-fonts/cairo";
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from "@expo-google-fonts/ibm-plex-sans-arabic";

import { AppearanceProvider } from "@/store/appearanceStore";
import { ToastProvider } from "@/store/toastStore";
import { DocumentsProvider } from "@/store/documentsStore";

// RTL only takes effect after the native app restarts (I18nManager caches
// the layout direction natively), so this applies on the next reload.
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Cairo_700Bold,
    Cairo_800ExtraBold,
    Cairo_900Black,
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <AppearanceProvider>
        <DocumentsProvider>
          <ToastProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="login" />
              <Stack.Screen name="register" />
              <Stack.Screen name="camera" />
              <Stack.Screen name="document/[id]/index" />
              <Stack.Screen name="document/[id]/chat" />
              <Stack.Screen name="document/[id]/share" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="+not-found" />
            </Stack>
          </ToastProvider>
        </DocumentsProvider>
      </AppearanceProvider>
    </SafeAreaProvider>
  );
}
