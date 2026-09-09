import React, { useState, useEffect, useRef } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import { T, palette } from '../constants/theme';

const { width } = Dimensions.get('window');
const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; name?: string }>();
  const email = (params.email || '').trim();
  const name = params.name || '';

  const { verifyOtp } = useAuth();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [timer, setTimer] = useState<number>(RESEND_COOLDOWN);
  const [canResend, setCanResend] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const inputsRef = useRef<(TextInput | null)[]>([]);

  // ── Countdown Timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (timer <= 0) {
      setCanResend(true);
      return;
    }
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  // ── Handle digit input ─────────────────────────────────────────────────────
  const handleChangeText = (text: string, index: number) => {
    setError(null);

    // Handle full OTP pasted into any slot
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length > 1) {
      const newOtp = [...otp];
      for (let i = 0; i < OTP_LENGTH; i++) {
        if (cleaned[i]) {
          newOtp[i] = cleaned[i];
        }
      }
      setOtp(newOtp);
      const nextFocus = Math.min(cleaned.length, OTP_LENGTH - 1);
      inputsRef.current[nextFocus]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = cleaned;
    setOtp(newOtp);

    // If a digit was entered, advance focus to next input
    if (cleaned && index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
      setActiveIdx(index + 1);
    }
  };

  // ── Handle backspace key ───────────────────────────────────────────────────
  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputsRef.current[index - 1]?.focus();
        setActiveIdx(index - 1);
      }
    }
  };

  // ── Submit OTP Verification ────────────────────────────────────────────────
  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < OTP_LENGTH) {
      setError(`Please enter all ${OTP_LENGTH} digits.`);
      return;
    }

    if (!email) {
      setError('Email address is missing. Please go back and register again.');
      return;
    }

    setError(null);
    setInfoMessage(null);
    setIsLoading(true);

    try {
      // Calls verifyOtp from AuthContext (which saves tokens & updates user state)
      const verifiedUser = await verifyOtp(email, code);

      // Successfully verified and logged in!
      // Navigate to complete-profile screen
      router.replace('/complete-profile' as any);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Verification failed. Please check the code and try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (!canResend || isResending) return;

    if (!email) {
      setError('Email is missing. Please return to the registration screen.');
      return;
    }

    setError(null);
    setIsResending(true);
    try {
      const res = await authService.resendOtp(email);
      setInfoMessage(res.message || 'A fresh verification code has been sent!');
      setOtp(Array(OTP_LENGTH).fill(''));
      inputsRef.current[0]?.focus();
      setActiveIdx(0);
      setTimer(RESEND_COOLDOWN);
      setCanResend(false);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to resend code. Please try again later.';
      setError(msg);
    } finally {
      setIsResending(false);
    }
  };

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
        {/* Decorative Top-Right Header Elements */}
        <View className="absolute top-0 right-0 overflow-hidden w-40 h-40">
          <View
            className="absolute rounded-full bg-[#ff9db4] opacity-50"
            style={{
              width: width * 0.25,
              height: width * 0.25,
              top: width * 0.05,
              right: width * 0.05,
            }}
          />
          <View
            className="absolute rounded-full bg-[#ff9db4] opacity-40"
            style={{
              width: width * 0.15,
              height: width * 0.15,
              top: width * 0.18,
              right: -width * 0.02,
            }}
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
        <View className="flex-1 px-8 pt-[32%] pb-10">
          {/* Header */}
          <View className="items-center mb-6">
            <View className="w-16 h-16 rounded-full bg-[#fff0f3] items-center justify-center mb-4">
              <Ionicons name="mail-unread-outline" size={32} color="#ff5b83" />
            </View>
            <Text className="text-3xl font-bold text-[#ff5b83] mb-2">
              Verify Email
            </Text>
            <Text className="text-gray-500 text-center text-sm px-4">
              We've sent a 6-digit verification code to
            </Text>
            <Text className="text-gray-900 font-bold text-base text-center mt-1">
              {email || 'your email'}
            </Text>
            <Pressable onPress={() => router.back()} className="mt-1">
              <Text className="text-[#ff5b83] text-xs font-semibold">
                Wrong email? Change
              </Text>
            </Pressable>
          </View>

          {/* Success / Info Banner */}
          {infoMessage ? (
            <View className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 flex-row items-center">
              <Ionicons name="checkmark-circle-outline" size={18} color="#10b981" />
              <Text className="text-emerald-700 text-sm ml-2 flex-1">
                {infoMessage}
              </Text>
            </View>
          ) : null}

          {/* Error Banner */}
          {error ? (
            <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 flex-row items-center">
              <Ionicons name="alert-circle-outline" size={18} color="#ef4444" />
              <Text className="text-red-500 text-sm ml-2 flex-1">{error}</Text>
            </View>
          ) : null}

          {/* 6-Digit OTP Input Boxes */}
          <View className="flex-row justify-between items-center my-6">
            {otp.map((digit, index) => {
              const isFocused = activeIdx === index;
              return (
                <View
                  key={index}
                  className={`w-12 h-14 rounded-xl border-2 items-center justify-center bg-[#fafafa] ${
                    isFocused
                      ? 'border-[#ff5b83] bg-white'
                      : digit
                      ? 'border-gray-400 bg-white'
                      : 'border-gray-200'
                  }`}
                  style={{
                    shadowColor: isFocused ? '#ff5b83' : '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isFocused ? 0.2 : 0.05,
                    shadowRadius: 3,
                    elevation: isFocused ? 2 : 1,
                  }}
                >
                  <TextInput
                    ref={(ref) => {
                      inputsRef.current[index] = ref;
                    }}
                    value={digit}
                    onChangeText={(text) => handleChangeText(text, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    onFocus={() => setActiveIdx(index)}
                    keyboardType="number-pad"
                    maxLength={index === 0 ? OTP_LENGTH : 1}
                    selectTextOnFocus
                    className="text-2xl font-bold text-gray-900 text-center w-full h-full"
                    editable={!isLoading}
                  />
                </View>
              );
            })}
          </View>

          {/* Verify Button */}
          <View className="mt-4 mb-6">
            <Pressable
              onPress={handleVerify}
              disabled={isLoading || otp.join('').length < OTP_LENGTH}
              className="bg-[#ff5b83] py-[16px] rounded-xl items-center shadow-sm active:bg-[#e04f73]"
              style={{
                opacity:
                  isLoading || otp.join('').length < OTP_LENGTH ? 0.6 : 1,
              }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View className="flex-row items-center">
                  <Text className="text-white font-bold text-lg">
                    Verify & Continue
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color="white"
                    style={{ marginLeft: 8 }}
                  />
                </View>
              )}
            </Pressable>
          </View>

          {/* Resend Section */}
          <View className="items-center mt-2">
            {canResend ? (
              <Pressable
                onPress={handleResend}
                disabled={isResending}
                className="flex-row items-center py-2 px-4 rounded-full active:bg-gray-100"
              >
                {isResending ? (
                  <ActivityIndicator size="small" color="#ff5b83" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={16} color="#ff5b83" />
                    <Text className="text-[#ff5b83] font-bold text-sm ml-2">
                      Resend Code
                    </Text>
                  </>
                )}
              </Pressable>
            ) : (
              <Text className="text-gray-400 text-sm">
                Resend code in{' '}
                <Text className="text-[#ff5b83] font-semibold">
                  {timer}s
                </Text>
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
