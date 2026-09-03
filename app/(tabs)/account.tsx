import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Reusable menu item component
const MenuItem = ({ icon, label, iconType = 'feather', isDestructive = false, onPress }) => (
    <TouchableOpacity
        onPress={onPress}
        className="flex-row items-center justify-between py-4 border-b border-gray-100 last:border-0"
    >
        <View className="flex-row items-center">
            {iconType === 'feather' ? (
                <Feather name={icon} size={20} color={isDestructive ? '#f43f5e' : '#4b5563'} />
            ) : (
                <Ionicons name={icon} size={20} color={isDestructive ? '#f43f5e' : '#4b5563'} />
            )}
            <Text className={`ml-4 text-base font-medium ${isDestructive ? 'text-rose-500' : 'text-gray-700'}`}>
                {label}
            </Text>
        </View>
        <Feather name="chevron-right" size={20} color={isDestructive ? '#f43f5e' : '#9ca3af'} />
    </TouchableOpacity>
);

export default function AccountScreen() {
    const router = useRouter();

    return (
        <SafeAreaView className="flex-1 bg-[#f9fafb]">
            {/* Header */}
            <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
                <View className="w-8 h-8 rounded-full bg-pink-100 items-center justify-center">
                    <Ionicons name="infinite" size={18} color="#f43f5e" />
                </View>
                <Text className="text-xl font-bold text-gray-800">Account</Text>
                <TouchableOpacity>
                    <Feather name="more-vertical" size={24} color="#374151" />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
                {/* Upgrade Banner */}
                <TouchableOpacity className="bg-gradient-to-r from-pink-400 to-rose-400 rounded-2xl p-4 flex-row items-center mt-4 bg-pink-500 shadow-sm">
                    <View className="w-12 h-12 bg-white/20 rounded-full items-center justify-center mr-4">
                        <View className="w-10 h-10 bg-white rounded-full items-center justify-center">
                            <Ionicons name="crown" size={20} color="#fbbf24" />
                        </View>
                    </View>
                    <View className="flex-1">
                        <Text className="text-white text-lg font-bold">Upgrade Plan Now!</Text>
                        <Text className="text-white/80 text-xs mt-1">Enjoy all the benefits and explore more possibilities</Text>
                    </View>
                </TouchableOpacity>

                {/* Profile Card */}
                <TouchableOpacity
                    onPress={() => router.push('/personal-info')}
                    className="bg-white rounded-2xl p-4 flex-row items-center mt-6 shadow-sm border border-gray-100"
                >
                    <Image
                        source={{ uri: 'https://i.pravatar.cc/150?u=a042581f4e29026024d' }}
                        className="w-16 h-16 rounded-full"
                    />
                    <View className="ml-4 flex-1">
                        <Text className="text-lg font-bold text-gray-800">Isabella Ainsley</Text>
                        <Text className="text-gray-500 text-sm mt-0.5">isabella.ainsley@yourdomain.com</Text>
                    </View>
                    <Feather name="chevron-right" size={20} color="#9ca3af" />
                </TouchableOpacity>

                {/* Menu Options Group 1 */}
                <View className="bg-white rounded-2xl px-4 py-2 mt-6 shadow-sm border border-gray-100 flex-col mb-24">
                    <MenuItem
                        icon="settings"
                        label="Preferences"
                        onPress={() => router.push('/preferences')}
                    />
                    <MenuItem icon="clock" label="Reminder" />
                    <MenuItem icon="shield" label="Account & Security" />
                    <MenuItem icon="credit-card" label="Payment Methods" />
                    <MenuItem icon="file-text" label="Billing & Subscriptions" />
                    <MenuItem icon="shuffle" label="Linked Accounts" />
                    <MenuItem icon="activity" label="Data & Analytics" />
                    <MenuItem icon="eye" label="App Appearance" />
                    <MenuItem icon="help-circle" label="Help & Support" />
                    <MenuItem icon="star" label="Rate us" />
                    <MenuItem icon="log-out" label="Logout" isDestructive={true} />
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}
