import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { BluetoothProvider } from '../context/BluetoothContext';
import { useEffect, useState } from 'react';
import { DeviceEventEmitter, View, Text, SafeAreaView } from 'react-native';

export const unstable_settings = {
  anchor: '(tabs)',
};

function GlobalErrorBanner() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('backendError', (msg) => {
      setErrorMsg(msg);
      // Auto-hide after 4 seconds
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

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <BluetoothProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <GlobalErrorBanner />
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </BluetoothProvider>
  );
}
