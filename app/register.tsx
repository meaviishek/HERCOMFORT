import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import authService from '../services/authService';
import { T, palette } from '../constants/theme';

const { width } = Dimensions.get('window');

export default function RegisterScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      // Send OTP — does NOT register yet, only sends an email
      await authService.sendOtp({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      // Navigate to OTP screen, passing email and name as query params
      router.push({
        pathname: '/verify-otp' as any,
        params: { email: email.trim().toLowerCase(), name: name.trim() },
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to send verification code. Please try again.';
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
        {/* Header Graphics */}
        <View className="absolute top-0 right-0 overflow-hidden w-40 h-40">
          <View
            className="absolute rounded-full bg-[#ff9db4] opacity-50"
            style={{ width: width * 0.25, height: width * 0.25, top: width * 0.05, right: width * 0.05 }}
          />
          <View
            className="absolute rounded-full bg-[#ff9db4] opacity-40"
            style={{ width: width * 0.15, height: width * 0.15, top: width * 0.18, right: -width * 0.02 }}
          />
        </View>

        {/* Back Button */}
        <Pressable
          onPress={() => router.back()}
          className="absolute top-14 left-6 z-10 p-2"
        >
          <Ionicons name="arrow-back" size={24} color="#ff5b83" />
        </Pressable>

        {/* Main Content */}
        <View className="flex-1 px-8 pt-[35%] pb-10">
          <View className="items-center mb-8">
            <Text className="text-3xl font-bold text-[#ff5b83] mb-2">Create account</Text>
            <Text className="text-gray-400 text-base">We'll send a code to verify your email</Text>
          </View>

          {/* Error Banner */}
          {error ? (
            <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 flex-row items-center">
              <Ionicons name="alert-circle-outline" size={18} color="#ef4444" />
              <Text className="text-red-500 text-sm ml-2 flex-1">{error}</Text>
            </View>
          ) : null}

          {/* Form Inputs */}
          <View className="space-y-5">
            {/* Full Name */}
            <View>
              <View className="flex-row items-center mb-2">
                <Ionicons name="person-outline" size={16} color="#9ca3af" />
                <Text className="text-gray-500 font-medium ml-2 text-sm">Full name</Text>
              </View>
              <TextInput
                className="border-b border-gray-200 py-2 text-base text-gray-800"
                placeholder="ex: Jane Doe"
                placeholderTextColor="#d1d5db"
                value={name}
                onChangeText={setName}
                editable={!isLoading}
                autoCapitalize="words"
              />
            </View>

            {/* Email */}
            <View className="mt-5">
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

            {/* Password */}
            <View className="mt-5">
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
          </View>

          {/* Send OTP Button */}
          <View className="mt-10 mb-6">
            <Pressable
              onPress={handleRegister}
              disabled={isLoading}
              className="bg-[#ff5b83] py-[16px] rounded-xl items-center shadow-sm active:bg-[#e04f73]"
              style={{ opacity: isLoading ? 0.7 : 1 }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View className="flex-row items-center">
                  <Text className="text-white font-bold text-lg">Send Verification Code</Text>
                  <Ionicons name="send" size={18} color="white" style={{ marginLeft: 8 }} />
                </View>
              )}
            </Pressable>
          </View>

          <View className="flex-row justify-center mt-auto">
            <Text className="text-gray-400 text-sm">Already have an account? </Text>
            <Link href="/login" asChild>
              <Pressable>
                <Text className="text-[#ff5b83] text-sm font-bold">Sign In</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
