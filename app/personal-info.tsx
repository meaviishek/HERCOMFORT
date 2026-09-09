import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { T } from '../constants/theme';

interface InfoCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
}

const InfoCard = ({ label, value, icon }: InfoCardProps) => (
  <View className="mb-4">
    <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
      {label}
    </Text>
    <View className="bg-gray-50 rounded-2xl px-4 py-3.5 border border-gray-100 flex-row items-center">
      <View className="mr-3">{icon}</View>
      <Text className="flex-1 text-gray-800 text-base font-medium">
        {value || 'Not provided'}
      </Text>
    </View>
  </View>
);

export default function PersonalInfoScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-4 border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-2 -ml-1 rounded-full active:bg-gray-100"
        >
          <Feather name="arrow-left" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-xl font-bold text-gray-800 mr-8">
          Personal Info
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-6 pt-6"
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Avatar */}
        <View className="items-center mb-8">
          <View className="relative">
            {user?.avatar ? (
              <Image
                source={{ uri: user.avatar }}
                className="w-24 h-24 rounded-full border-4 border-[#fff0f3] shadow-sm"
              />
            ) : (
              <View className="w-24 h-24 rounded-full items-center justify-center" style={{ backgroundColor: T.pink.bg, borderWidth: 4, borderColor: T.pink.border }}>
                <Text className="font-black text-3xl" style={{ color: T.pink.action }}>
                  {getInitials(user?.name)}
                </Text>
              </View>
            )}
          </View>
          <Text className="text-xl font-bold text-gray-900 mt-3">
            {user?.name || 'Wellness Member'}
          </Text>
          <Text className="text-gray-500 text-sm">{user?.email}</Text>
        </View>

        {/* Account Details Section */}
        <View className="mb-6">
          <Text className="text-sm font-bold text-gray-900 mb-3">
            Account Details
          </Text>
          <InfoCard
            label="Full Name"
            value={user?.name || ''}
            icon={<Feather name="user" size={18} color={T.pink.action} />}
          />
          <InfoCard
            label="Email Address"
            value={user?.email || ''}
            icon={<Feather name="mail" size={18} color={T.pink.action} />}
          />
        </View>

        {/* Health Profile Section */}
        <View className="mb-8">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-bold text-gray-900">
              Health Metrics
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/complete-profile' as any)}
            >
              <Text className="text-xs font-bold" style={{ color: T.pink.action }}>
                Edit Health Profile
              </Text>
            </TouchableOpacity>
          </View>

          {/* Date of Birth & Age Row */}
          <View className="flex-row gap-3 mb-3">
            <View style={{ flex: 1.2, backgroundColor: T.pink.bg, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: T.pink.border }}>
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-xs text-gray-500 font-semibold">Date of Birth</Text>
                <Ionicons name="calendar-outline" size={16} color={T.pink.action} />
              </View>
              <Text className="text-base font-bold text-gray-900">
                {user?.profile?.dateOfBirth
                  ? new Date(user.profile.dateOfBirth).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '--'}
              </Text>
            </View>

            <View style={{ flex: 1, backgroundColor: T.pink.bg, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: T.pink.border }}>
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-xs text-gray-500 font-semibold">Age (Calculated)</Text>
                <Ionicons name="time-outline" size={16} color={T.pink.action} />
              </View>
              <Text className="text-xl font-bold text-gray-900">
                {user?.profile?.age ? `${user.profile.age} yrs` : '--'}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3 mb-3">
            <View style={{ flex: 1, backgroundColor: T.pink.bg, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: T.pink.border }}>
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-xs text-gray-500 font-semibold">
                  Blood Group
                </Text>
                <Ionicons name="water-outline" size={16} color={T.pink.action} />
              </View>
              <Text className="text-xl font-bold" style={{ color: T.pink.primary }}>
                {user?.profile?.bloodGroup || '--'}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-xs text-gray-500 font-semibold">
                  Weight
                </Text>
                <MaterialCommunityIcons name="scale-bathroom" size={18} color={T.pink.action} />
              </View>
              <Text className="text-xl font-bold text-gray-900">
                {user?.profile?.weight ? `${user.profile.weight} kg` : '--'}
              </Text>
            </View>

            <View className="flex-1 bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-xs text-gray-500 font-semibold">
                  Height
                </Text>
                <MaterialCommunityIcons name="human-male-height" size={18} color={T.pink.action} />
              </View>
              <Text className="text-xl font-bold text-gray-900">
                {user?.profile?.height ? `${user.profile.height} cm` : '--'}
              </Text>
            </View>
          </View>
        </View>

        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
