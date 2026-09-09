import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { BluetoothProvider } from '../context/BluetoothContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { DeviceEventEmitter, View, Text, SafeAreaView } from 'react-native';

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
      <BluetoothProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AuthGate>
            <GlobalErrorBanner />
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="register" options={{ headerShown: false }} />
              <Stack.Screen name="verify-otp" options={{ headerShown: false }} />
              <Stack.Screen name="complete-profile" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="modal"       options={{ presentation: 'modal', title: 'Modal' }} />
              <Stack.Screen name="ble-device" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="auto" />
          </AuthGate>
        </ThemeProvider>
      </BluetoothProvider>
    </AuthProvider>
  );
}
