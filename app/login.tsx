import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { T, palette } from '../constants/theme';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      await AsyncStorage.setItem('@nari_onboarding_completed_v1', 'true');
      router.replace('/(tabs)');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Login failed. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Graphic Area */}
        <View className="h-[38%] relative bg-white overflow-hidden">
        <View
            className="absolute w-[150%] h-full rounded-b-[150px]"
            style={{ left: '-25%', top: 0, backgroundColor: palette.pink200 }}
          >
            <View
              className="absolute rounded-full opacity-50"
              style={{ width: width * 0.7, height: width * 0.7, top: -height * 0.05, right: -width * 0.2, backgroundColor: palette.pink300 }}
            />
            <View
              className="absolute rounded-full opacity-50"
              style={{ width: width * 0.6, height: width * 0.6, top: height * 0.15, left: -width * 0.1, backgroundColor: palette.pink300 }}
            />
          </View>

          {/* Back Button */}
          <Pressable
            onPress={() => router.back()}
            className="absolute top-14 left-6 w-10 h-10 bg-white/50 rounded-full items-center justify-center z-10"
          >
            <Ionicons name="arrow-back" size={24} color={T.pink.action} />
          </Pressable>
        </View>

        {/* Main Content */}
        <View className="flex-1 px-8 pt-8 pb-10">
          <View className="items-center mb-8">
            <Text className="text-3xl font-bold mb-2" style={{ color: T.pink.action }}>Welcome back</Text>
            <Text className="text-gray-400 text-base">Login to your account</Text>
          </View>

          {/* Error Banner */}
          {error ? (
            <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 flex-row items-center">
              <Ionicons name="alert-circle-outline" size={18} color="#ef4444" />
              <Text className="text-red-500 text-sm ml-2 flex-1">{error}</Text>
            </View>
          ) : null}

          {/* Form Inputs */}
          <View className="space-y-6">
            {/* Email Input */}
            <View>
              <View className="flex-row items-center mb-2">
                <Ionicons name="mail-outline" size={16} color="#9ca3af" />
                <Text className="text-gray-500 font-medium ml-2 text-sm">E-mail</Text>
              </View>
              <TextInput
                className="border-b border-gray-200 py-2 text-base text-gray-800"
                placeholder="ex: hello@elia.com"
                placeholderTextColor="#d1d5db"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                editable={!isLoading}
              />
            </View>

            {/* Password Input */}
            <View className="mt-6">
              <View className="flex-row items-center mb-2">
                <Ionicons name="lock-closed-outline" size={16} color="#9ca3af" />
                <Text className="text-gray-500 font-medium ml-2 text-sm">Password</Text>
              </View>
              <View className="flex-row items-center border-b border-gray-200">
                <TextInput
                  className="flex-1 py-2 text-base text-gray-800"
                  placeholder="••••••••"
                  placeholderTextColor="#d1d5db"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  editable={!isLoading}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} className="p-1">
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#9ca3af"
                  />
                </Pressable>
              </View>
            </View>

            {/* Remember me & Forgot Password */}
            <View className="flex-row justify-between items-center mt-6">
              <Pressable className="flex-row items-center">
                <View className="w-4 h-4 rounded border border-gray-300 mr-2 items-center justify-center border-transparent" style={{ backgroundColor: T.pink.action }}>
                  <Ionicons name="checkmark" size={12} color="white" />
                </View>
                <Text className="text-gray-500 text-sm">Remember me</Text>
              </Pressable>
              <Pressable>
                <Text className="text-sm font-semibold" style={{ color: T.pink.action }}>Forgot password?</Text>
              </Pressable>
            </View>
          </View>

          {/* Sign In Button */}
          <View className="mt-8 mb-6">
            <Pressable
              onPress={handleLogin}
              disabled={isLoading}
              className="py-[16px] rounded-xl items-center shadow-sm"
              style={{ backgroundColor: T.pink.action, opacity: isLoading ? 0.7 : 1 }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-lg">Sign In</Text>
              )}
            </Pressable>
          </View>

          <View className="flex-row justify-center mt-auto">
            <Text className="text-gray-400 text-sm">Don't have account? </Text>
            <Link href="/register" asChild>
              <Pressable>
                <Text className="text-sm font-bold" style={{ color: T.pink.action }}>Sign Up</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
