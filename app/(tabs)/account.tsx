import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useAppLock } from '../../context/AppLockContext';
import { T } from '../../constants/theme';

// Reusable menu item component
interface MenuItemProps {
  icon: string;
  label: string;
  iconType?: 'feather' | 'ionicons' | 'material';
  isDestructive?: boolean;
  onPress?: () => void;
  badge?: string;
}

const MenuItem = ({
  icon,
  label,
  iconType = 'feather',
  isDestructive = false,
  onPress,
  badge,
}: MenuItemProps) => (
  <TouchableOpacity
    onPress={onPress}
    className="flex-row items-center justify-between py-4 border-b border-gray-100 last:border-0 active:opacity-70"
  >
    <View className="flex-row items-center flex-1">
      {iconType === 'feather' && (
        <Feather
          name={icon as any}
          size={20}
          color={isDestructive ? T.text.danger : T.text.secondary}
        />
      )}
      {iconType === 'ionicons' && (
        <Ionicons
          name={icon as any}
          size={20}
          color={isDestructive ? T.text.danger : T.text.secondary}
        />
      )}
      {iconType === 'material' && (
        <MaterialCommunityIcons
          name={icon as any}
          size={20}
          color={isDestructive ? T.text.danger : T.text.secondary}
        />
      )}
      <Text
        className={`ml-4 text-base font-medium ${
          isDestructive ? 'text-rose-500' : 'text-gray-700'
        }`}
      >
        {label}
      </Text>
    </View>

    <View className="flex-row items-center">
      {badge && (
        <View className="bg-pink-100 px-2.5 py-0.5 rounded-full mr-2">
          <Text className="text-pink-600 text-xs font-semibold">{badge}</Text>
        </View>
      )}
      <Feather
        name="chevron-right"
        size={20}
        color={isDestructive ? T.text.danger : T.text.muted}
      />
    </View>
  </TouchableOpacity>
);

export default function AccountScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { screenLockEnabled, toggleScreenLock } = useAppLock();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            router.replace('/login');
          } catch (err) {
            console.error('Logout error:', err);
          }
        },
      },
    ]);
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f9fafb]">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
        <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: T.pink.bg }}>
          <Ionicons name="infinite" size={18} color={T.pink.action} />
        </View>
        <Text className="text-xl font-bold text-gray-800">Account</Text>
        <TouchableOpacity>
          <Feather name="more-vertical" size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Profile Card with Real User Data */}
        <TouchableOpacity
          onPress={() => router.push('/personal-info' as any)}
          className="bg-white rounded-2xl p-4 mt-4 shadow-sm border border-gray-100 active:opacity-90"
        >
          <View className="flex-row items-center">
            {user?.avatar ? (
              <Image
                source={{ uri: user.avatar }}
                className="w-16 h-16 rounded-full"
              />
            ) : (
              <View className="w-16 h-16 rounded-full items-center justify-center" style={{ backgroundColor: T.pink.bg, borderWidth: 2, borderColor: T.pink.border }}>
                <Text className="font-extrabold text-xl" style={{ color: T.pink.action }}>{getInitials(user?.name)}</Text>
              </View>
            )}

            <View className="ml-4 flex-1">
              <Text className="text-lg font-bold text-gray-800">
                {user?.name || 'Wellness User'}
              </Text>
              <Text className="text-gray-500 text-sm mt-0.5">
                {user?.email || 'No email registered'}
              </Text>
            </View>

            <Feather name="chevron-right" size={20} color="#9ca3af" />
          </View>

          {/* Health Profile Badges */}
          {user?.profile && (
            <View className="flex-row items-center flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
              {user.profile.bloodGroup && (
                <View className="bg-[#fff0f3] px-2.5 py-1 rounded-full flex-row items-center">
                  <Ionicons name="water" size={12} color="#ff5b83" />
                  <Text className="text-[#ff5b83] text-xs font-semibold ml-1">
                    {user.profile.bloodGroup}
                  </Text>
                </View>
              )}
              {!!user.profile.age && (
                <View className="bg-gray-100 px-2.5 py-1 rounded-full">
                  <Text className="text-gray-700 text-xs font-medium">
                    {user.profile.age} yrs
                  </Text>
                </View>
              )}
              {!!user.profile.weight && (
                <View className="bg-gray-100 px-2.5 py-1 rounded-full">
                  <Text className="text-gray-700 text-xs font-medium">
                    {user.profile.weight} kg
                  </Text>
                </View>
              )}
              {!!user.profile.height && (
                <View className="bg-gray-100 px-2.5 py-1 rounded-full">
                  <Text className="text-gray-700 text-xs font-medium">
                    {user.profile.height} cm
                  </Text>
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>

        {/* ── Personal AI Health Companion & Disaster Shield (Edge AI) ── */}
        <View className="mt-5">
          <View className="flex-row items-center justify-between px-1 mb-2">
            <View className="flex-row items-center">
              <View className="w-2 h-2 rounded-full bg-pink-500 mr-2" />
              <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Edge AI Health & Disaster Shield
              </Text>
            </View>
            <View className="bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <Text className="text-[10px] font-bold text-emerald-700">100% On-Device AI</Text>
            </View>
          </View>

          {/* Feature Hub Card */}
          <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-2">
            {/* 1. Disaster Health Alerts */}
            <TouchableOpacity
              onPress={() => router.push('/disaster-alerts' as any)}
              className="flex-row items-center justify-between py-3 border-b border-gray-100 active:opacity-70"
            >
              <View className="flex-row items-center flex-1 pr-2">
                <View className="w-10 h-10 rounded-xl bg-amber-50 items-center justify-center mr-3 border border-amber-100">
                  <MaterialCommunityIcons name="weather-lightning-rainy" size={20} color="#d97706" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-base font-semibold text-gray-800">Disaster Health Alerts</Text>
                    <View className="bg-amber-100 px-2 py-0.5 rounded-full ml-2">
                      <Text className="text-[10px] font-bold text-amber-700">India Shield</Text>
                    </View>
                  </View>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    Heatwaves, severe AQI smog, flood & cyclone early warnings
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color="#9ca3af" />
            </TouchableOpacity>

            {/* 2. Edge AI Vitals & Anomaly Monitor */}
            <TouchableOpacity
              onPress={() => router.push('/edge-ai-vitals' as any)}
              className="flex-row items-center justify-between py-3 border-b border-gray-100 active:opacity-70"
            >
              <View className="flex-row items-center flex-1 pr-2">
                <View className="w-10 h-10 rounded-xl bg-rose-50 items-center justify-center mr-3 border border-rose-100">
                  <Ionicons name="pulse" size={20} color="#e11d48" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-base font-semibold text-gray-800">Edge AI Anomaly Monitor</Text>
                    <View className="bg-rose-100 px-2 py-0.5 rounded-full ml-2">
                      <Text className="text-[10px] font-bold text-rose-700">Real-time</Text>
                    </View>
                  </View>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    HR, SpO2, core temp, heat stress & dehydration inference
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color="#9ca3af" />
            </TouchableOpacity>

            {/* 3. Emergency SOS & Fall Guardian */}
            <TouchableOpacity
              onPress={() => router.push('/emergency-sos' as any)}
              className="flex-row items-center justify-between py-3 border-b border-gray-100 active:opacity-70"
            >
              <View className="flex-row items-center flex-1 pr-2">
                <View className="w-10 h-10 rounded-xl bg-red-50 items-center justify-center mr-3 border border-red-100">
                  <MaterialCommunityIcons name="alert-octagon" size={20} color="#dc2626" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-base font-semibold text-gray-800">Emergency SOS & Fall Guardian</Text>
                    <View className="bg-red-100 px-2 py-0.5 rounded-full ml-2">
                      <Text className="text-[10px] font-bold text-red-700">112 SOS</Text>
                    </View>
                  </View>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    Kinematic fall impact sensor, acoustic siren & GPS dispatch
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color="#9ca3af" />
            </TouchableOpacity>

            {/* 4. Climate Resilience & Wellness Dashboard */}
            <TouchableOpacity
              onPress={() => router.push('/climate-dashboard' as any)}
              className="flex-row items-center justify-between py-3 border-b border-gray-100 active:opacity-70"
            >
              <View className="flex-row items-center flex-1 pr-2">
                <View className="w-10 h-10 rounded-xl bg-indigo-50 items-center justify-center mr-3 border border-indigo-100">
                  <MaterialCommunityIcons name="chart-bell-curve-cumulative" size={20} color="#4f46e5" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-base font-semibold text-gray-800">Climate Resilience Dashboard</Text>
                    <View className="bg-indigo-100 px-2 py-0.5 rounded-full ml-2">
                      <Text className="text-[10px] font-bold text-indigo-700">Daily Score</Text>
                    </View>
                  </View>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    Heat/Respiratory/Cardio risk scores & climate hydration target
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color="#9ca3af" />
            </TouchableOpacity>

            {/* 5. Privacy & Edge AI Vault */}
            <TouchableOpacity
              onPress={() => router.push('/edge-privacy' as any)}
              className="flex-row items-center justify-between py-3 active:opacity-70"
            >
              <View className="flex-row items-center flex-1 pr-2">
                <View className="w-10 h-10 rounded-xl bg-emerald-50 items-center justify-center mr-3 border border-emerald-100">
                  <MaterialCommunityIcons name="shield-check" size={20} color="#059669" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-base font-semibold text-gray-800">Edge Privacy & Data Vault</Text>
                    <View className="bg-emerald-100 px-2 py-0.5 rounded-full ml-2">
                      <Text className="text-[10px] font-bold text-emerald-700">Zero Cloud</Text>
                    </View>
                  </View>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    100% on-device data sovereignty, encrypted export & local wipe
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu Options Group */}
        <View className="bg-white rounded-2xl px-4 py-2 mt-4 shadow-sm border border-gray-100 flex-col mb-28">
          <MenuItem
            icon="user"
            label="Personal Info"
            onPress={() => router.push('/personal-info' as any)}
          />
          <MenuItem
            icon="settings"
            label="Preferences"
            onPress={() => router.push('/preferences' as any)}
          />
          <MenuItem
            icon="clock"
            label="Reminder"
            onPress={() => router.push('/reminders' as any)}
          />
          <MenuItem
            icon="shield"
            label="Account & Security"
            onPress={() => router.push('/account-security' as any)}
          />
          {/* ── Screen Lock Toggle ────────────────────────────────────── */}
          <TouchableOpacity
            onPress={toggleScreenLock}
            className="flex-row items-center justify-between py-4 border-b border-gray-100 active:opacity-70"
          >
            <View className="flex-row items-center flex-1">
              <Ionicons
                name={screenLockEnabled ? 'finger-print' : 'finger-print-outline'}
                size={20}
                color={screenLockEnabled ? T.pink.action : T.text.secondary}
              />
              <View className="ml-4 flex-1">
                <Text className="text-base font-medium text-gray-700">Screen Lock</Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  {screenLockEnabled
                    ? 'Fingerprint / PIN required to open'
                    : 'Tap to enable biometric lock'}
                </Text>
              </View>
            </View>
            <Switch
              value={screenLockEnabled}
              onValueChange={toggleScreenLock}
              trackColor={{ false: '#E5E7EB', true: '#FBCFE8' }}
              thumbColor={screenLockEnabled ? T.pink.action : '#9CA3AF'}
            />
          </TouchableOpacity>
          <MenuItem
            icon="activity"
            label="Data & Analytics"
            onPress={() => router.push('/data-analytics' as any)}
          />
          <MenuItem
            icon="eye"
            label="App Appearance"
            onPress={() => router.push('/app-appearance' as any)}
          />
          <MenuItem
            icon="help-circle"
            label="Help & Support"
            onPress={() => router.push('/help-support' as any)}
          />
          <MenuItem
            icon="star"
            label="Rate us"
            onPress={() => Alert.alert('Rate Nari Health', 'Thank you for supporting Nari! Would you like to rate us 5 stars on the store?', [{ text: 'Later', style: 'cancel' }, { text: 'Rate 5 Stars', onPress: () => Alert.alert('Thank You!', 'We appreciate your feedback.') }])}
          />
          <MenuItem
            icon="log-out"
            label="Logout"
            isDestructive={true}
            onPress={handleLogout}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
