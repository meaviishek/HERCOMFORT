import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
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
        {/* Upgrade Banner */}
        <TouchableOpacity className="rounded-2xl p-4 flex-row items-center mt-4 shadow-sm" style={{ backgroundColor: T.pink.primary }}>
          <View className="w-12 h-12 bg-white/20 rounded-full items-center justify-center mr-4">
            <View className="w-10 h-10 bg-white rounded-full items-center justify-center">
              <Ionicons name={'crown' as any} size={20} color="#fbbf24" />
            </View>
          </View>
          <View className="flex-1">
            <Text className="text-white text-lg font-bold">
              Upgrade Plan Now!
            </Text>
            <Text className="text-white/80 text-xs mt-1">
              Enjoy all the benefits and explore more possibilities
            </Text>
          </View>
        </TouchableOpacity>

        {/* Profile Card with Real User Data */}
        <TouchableOpacity
          onPress={() => router.push('/personal-info' as any)}
          className="bg-white rounded-2xl p-4 mt-6 shadow-sm border border-gray-100 active:opacity-90"
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

        {/* Menu Options Group */}
        <View className="bg-white rounded-2xl px-4 py-2 mt-6 shadow-sm border border-gray-100 flex-col mb-28">
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
          <MenuItem icon="clock" label="Reminder" />
          <MenuItem icon="shield" label="Account & Security" />
          <MenuItem icon="credit-card" label="Payment Methods" />
          <MenuItem icon="file-text" label="Billing & Subscriptions" />
          <MenuItem icon="activity" label="Data & Analytics" />
          <MenuItem icon="eye" label="App Appearance" />
          <MenuItem icon="help-circle" label="Help & Support" />
          <MenuItem icon="star" label="Rate us" />
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
