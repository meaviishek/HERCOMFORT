import React, { useState, useRef } from 'react';
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
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { T, palette } from '../constants/theme';

const { width } = Dimensions.get('window');

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { completeProfile } = useAuth();

  // Date of Birth fields
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  // Other health fields
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [bloodGroup, setBloodGroup] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  // Auto calculate age preview on the client as user types
  const calculateAgePreview = (): number | null => {
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    if (
      isNaN(d) ||
      isNaN(m) ||
      isNaN(y) ||
      d < 1 ||
      d > 31 ||
      m < 1 ||
      m > 12 ||
      y < 1920 ||
      y > new Date().getFullYear()
    ) {
      return null;
    }

    const birthDate = new Date(y, m - 1, d);
    if (isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 && age <= 120 ? age : null;
  };

  const calculatedAge = calculateAgePreview();

  const handleSaveProfile = async () => {
    // Validate DOB
    const d = parseInt(day.trim(), 10);
    const m = parseInt(month.trim(), 10);
    const y = parseInt(year.trim(), 10);

    if (!day.trim() || !month.trim() || !year.trim()) {
      setError('Please enter your full date of birth (DD / MM / YYYY).');
      return;
    }

    if (isNaN(d) || d < 1 || d > 31) {
      setError('Please enter a valid day (1 - 31).');
      return;
    }
    if (isNaN(m) || m < 1 || m > 12) {
      setError('Please enter a valid month (1 - 12).');
      return;
    }
    const currentYear = new Date().getFullYear();
    if (isNaN(y) || y < 1920 || y > currentYear) {
      setError(`Please enter a valid year (1920 - ${currentYear}).`);
      return;
    }

    const formattedDob = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const parsedDate = new Date(formattedDob);
    if (isNaN(parsedDate.getTime())) {
      setError('Invalid date of birth. Please check the entered date.');
      return;
    }

    if (!weight.trim()) {
      setError('Please enter your weight.');
      return;
    }
    const numWeight = parseFloat(weight.trim());
    if (isNaN(numWeight) || numWeight < 20 || numWeight > 300) {
      setError('Please enter a valid weight in kg (20 - 300).');
      return;
    }

    if (!height.trim()) {
      setError('Please enter your height.');
      return;
    }
    const numHeight = parseFloat(height.trim());
    if (isNaN(numHeight) || numHeight < 50 || numHeight > 250) {
      setError('Please enter a valid height in cm (50 - 250).');
      return;
    }

    if (!bloodGroup) {
      setError('Please select your blood group.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await completeProfile({
        dateOfBirth: formattedDob,
        weight: numWeight,
        height: numHeight,
        bloodGroup,
      });

      // Navigate to main application
      router.replace('/(tabs)' as any);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to save profile. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
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
        <View className="absolute top-0 right-0 overflow-hidden w-44 h-44">
          <View
            className="absolute rounded-full bg-[#ff9db4] opacity-40"
            style={{
              width: width * 0.3,
              height: width * 0.3,
              top: width * 0.02,
              right: width * 0.02,
            }}
          />
          <View
            className="absolute rounded-full bg-[#ff5b83] opacity-20"
            style={{
              width: width * 0.18,
              height: width * 0.18,
              top: width * 0.2,
              right: -width * 0.04,
            }}
          />
        </View>

        <View className="flex-1 px-8 pt-16 pb-10">
          {/* Header Title & Subtitle */}
          <View className="items-center mb-8">
            <View className="w-16 h-16 rounded-full bg-[#fff0f3] items-center justify-center mb-3">
              <FontAwesome5 name="heartbeat" size={30} color="#ff5b83" />
            </View>
            <Text className="text-3xl font-bold text-[#ff5b83] text-center">
              Complete Profile
            </Text>
            <Text className="text-gray-400 text-sm text-center mt-2 px-2">
              Help us customize your wellness tracking and smart health insights
            </Text>
          </View>

          {/* Error Banner */}
          {error ? (
            <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 flex-row items-center">
              <Ionicons name="alert-circle-outline" size={18} color="#ef4444" />
              <Text className="text-red-500 text-sm ml-2 flex-1">{error}</Text>
            </View>
          ) : null}

          {/* Form Fields */}
          <View className="space-y-5">
            {/* Date of Birth */}
            <View>
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                  <Ionicons name="calendar-outline" size={18} color="#ff5b83" />
                  <Text className="text-gray-700 font-semibold ml-2 text-sm">
                    Date of Birth
                  </Text>
                </View>
                {calculatedAge !== null && (
                  <View className="bg-[#fff0f3] px-2.5 py-0.5 rounded-full">
                    <Text className="text-[#ff5b83] text-xs font-bold">
                      Age: {calculatedAge} yrs
                    </Text>
                  </View>
                )}
              </View>

              {/* 3 segmented inputs: DD, MM, YYYY */}
              <View className="flex-row gap-2.5">
                <View className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                  <Text className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">
                    Day
                  </Text>
                  <TextInput
                    placeholder="DD"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    maxLength={2}
                    value={day}
                    onChangeText={(val) => {
                      setDay(val);
                      setError(null);
                      if (val.length === 2) {
                        monthRef.current?.focus();
                      }
                    }}
                    className="text-base font-bold text-gray-900"
                    editable={!isLoading}
                  />
                </View>

                <View className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                  <Text className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">
                    Month
                  </Text>
                  <TextInput
                    ref={monthRef}
                    placeholder="MM"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    maxLength={2}
                    value={month}
                    onChangeText={(val) => {
                      setMonth(val);
                      setError(null);
                      if (val.length === 2) {
                        yearRef.current?.focus();
                      }
                    }}
                    className="text-base font-bold text-gray-900"
                    editable={!isLoading}
                  />
                </View>

                <View className="flex-[1.5] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                  <Text className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">
                    Year
                  </Text>
                  <TextInput
                    ref={yearRef}
                    placeholder="YYYY"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    maxLength={4}
                    value={year}
                    onChangeText={(val) => {
                      setYear(val);
                      setError(null);
                    }}
                    className="text-base font-bold text-gray-900"
                    editable={!isLoading}
                  />
                </View>
              </View>
            </View>

            {/* Weight (kg) */}
            <View className="mt-5">
              <View className="flex-row items-center mb-2">
                <MaterialCommunityIcons name="scale-bathroom" size={18} color="#ff5b83" />
                <Text className="text-gray-700 font-semibold ml-2 text-sm">
                  Weight (kg)
                </Text>
              </View>
              <TextInput
                className="border-b border-gray-200 py-2.5 text-base text-gray-900"
                placeholder="e.g. 58"
                placeholderTextColor="#d1d5db"
                keyboardType="decimal-pad"
                value={weight}
                onChangeText={(val) => {
                  setWeight(val);
                  setError(null);
                }}
                editable={!isLoading}
                maxLength={5}
              />
            </View>

            {/* Height (cm) */}
            <View className="mt-5">
              <View className="flex-row items-center mb-2">
                <MaterialCommunityIcons name="human-male-height" size={20} color="#ff5b83" />
                <Text className="text-gray-700 font-semibold ml-2 text-sm">
                  Height (cm)
                </Text>
              </View>
              <TextInput
                className="border-b border-gray-200 py-2.5 text-base text-gray-900"
                placeholder="e.g. 165"
                placeholderTextColor="#d1d5db"
                keyboardType="decimal-pad"
                value={height}
                onChangeText={(val) => {
                  setHeight(val);
                  setError(null);
                }}
                editable={!isLoading}
                maxLength={5}
              />
            </View>

            {/* Blood Group Selector */}
            <View className="mt-6">
              <View className="flex-row items-center mb-3">
                <Ionicons name="water-outline" size={18} color="#ff5b83" />
                <Text className="text-gray-700 font-semibold ml-2 text-sm">
                  Blood Group
                </Text>
              </View>
              <View className="flex-row flex-wrap justify-between">
                {BLOOD_GROUPS.map((bg) => {
                  const isSelected = bloodGroup === bg;
                  return (
                    <Pressable
                      key={bg}
                      onPress={() => {
                        setBloodGroup(bg);
                        setError(null);
                      }}
                      className={`w-[22%] py-3 mb-3 rounded-xl items-center justify-center border ${
                        isSelected
                          ? 'bg-[#ff5b83] border-[#ff5b83]'
                          : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                      }`}
                      style={{
                        shadowColor: isSelected ? '#ff5b83' : '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: isSelected ? 0.3 : 0.05,
                        shadowRadius: 2,
                        elevation: isSelected ? 2 : 1,
                      }}
                    >
                      <Text
                        className={`font-bold text-base ${
                          isSelected ? 'text-white' : 'text-gray-700'
                        }`}
                      >
                        {bg}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Privacy Note */}
          <View className="flex-row items-center bg-[#fff8fa] p-3 rounded-xl mt-6 border border-[#ffe0e8]">
            <Ionicons name="shield-checkmark-outline" size={18} color="#ff5b83" />
            <Text className="text-gray-500 text-xs ml-2 flex-1">
              Your health data is securely stored and never shared with third parties.
            </Text>
          </View>

          {/* Submit Button */}
          <View className="mt-8 mb-6">
            <Pressable
              onPress={handleSaveProfile}
              disabled={isLoading}
              className="bg-[#ff5b83] py-[16px] rounded-xl items-center shadow-sm active:bg-[#e04f73]"
              style={{ opacity: isLoading ? 0.7 : 1 }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View className="flex-row items-center">
                  <Text className="text-white font-bold text-lg">Save & Continue</Text>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color="white"
                    style={{ marginLeft: 8 }}
                  />
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
