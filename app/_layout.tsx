import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { BluetoothProvider } from '../context/BluetoothContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AppLockProvider } from '../context/AppLockContext';
import { useEffect, useState } from 'react';
import { DeviceEventEmitter, View, Text, SafeAreaView } from 'react-native';
import * as Notifications from 'expo-notifications';
import notificationService from '../services/notificationService';

export const unstable_settings = {
  anchor: '(tabs)',
};

// ─── Auth Guard ───────────────────────────────────────────────────────────────
/**
 * Redirects unauthenticated users to /login and authenticated users away
 * from the auth screens. Must be inside AuthProvider.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const currentScreen = segments[0] as string | undefined;
    const inProtectedGroup = currentScreen === '(tabs)';
    const onAuthScreen =
      currentScreen === 'login' ||
      currentScreen === 'register' ||
      currentScreen === 'verify-otp';
    const onCompleteProfile = currentScreen === 'complete-profile';

    if (!isAuthenticated) {
      // Not logged in but trying to access protected areas
      if (inProtectedGroup || onCompleteProfile) {
        router.replace('/login');
      }
    } else {
      // Authenticated user
      if (user && user.profileComplete === false) {
        // User has not completed their health profile yet
        if (!onCompleteProfile) {
          router.replace('/complete-profile' as any);
        }
      } else {
        // User has completed profile (or normal user)
        if (onAuthScreen || onCompleteProfile) {
          router.replace('/(tabs)');
        }
      }
    }
  }, [isAuthenticated, isLoading, user?.profileComplete, segments]);

  useEffect(() => {
    notificationService.init().catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = response.notification?.request?.content?.data?.route;
      if (route) {
        router.push(route as any);
      }
    });
    return () => {
      sub.remove();
    };
  }, [router]);

  return <>{children}</>;
}

// ─── Error Banner ─────────────────────────────────────────────────────────────
function GlobalErrorBanner() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('backendError', (msg) => {
      setErrorMsg(msg);
      setTimeout(() => {
        setErrorMsg(null);
      }, 4000);
    });
    return () => sub.remove();
  }, []);

  if (!errorMsg) return null;

  return (
    <SafeAreaView style={{ position: 'absolute', top: 0, width: '100%', zIndex: 9999, backgroundColor: '#ef4444' }}>
      <View style={{ padding: 12, alignItems: 'center' }}>
        <Text style={{ color: 'white', fontWeight: 'bold' }}>{errorMsg}</Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Root Layout ──────────────────────────────────────────────────────────────
export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <AppLockProvider>
        <BluetoothProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AuthGate>
              <GlobalErrorBanner />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="register" options={{ headerShown: false }} />
                <Stack.Screen name="verify-otp" options={{ headerShown: false }} />
                <Stack.Screen name="complete-profile" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
                <Stack.Screen name="ble-device" options={{ headerShown: false }} />
                <Stack.Screen name="personal-info" options={{ headerShown: false }} />
                <Stack.Screen name="preferences" options={{ headerShown: false }} />
                <Stack.Screen name="reminders" options={{ headerShown: false }} />
                <Stack.Screen name="account-security" options={{ headerShown: false }} />
                <Stack.Screen name="data-analytics" options={{ headerShown: false }} />
                <Stack.Screen name="app-appearance" options={{ headerShown: false }} />
                <Stack.Screen name="help-support" options={{ headerShown: false }} />
                <Stack.Screen name="medication-reminder" options={{ headerShown: false }} />
                <Stack.Screen name="disaster-alerts" options={{ headerShown: false }} />
                <Stack.Screen name="edge-ai-vitals" options={{ headerShown: false }} />
                <Stack.Screen name="emergency-sos" options={{ headerShown: false }} />
                <Stack.Screen name="climate-dashboard" options={{ headerShown: false }} />
                <Stack.Screen name="edge-privacy" options={{ headerShown: false }} />
              </Stack>
              <StatusBar style="auto" />
            </AuthGate>
          </ThemeProvider>
        </BluetoothProvider>
      </AppLockProvider>
    </AuthProvider>
  );
}
