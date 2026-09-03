import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const PreferenceItem = ({ label, value, isToggle = false, isLast = false }) => {
    const [isEnabled, setIsEnabled] = useState(true);

    return (
        <TouchableOpacity
            disabled={isToggle}
            className={`flex-row items-center justify-between py-4 ${!isLast ? 'border-b border-gray-100' : ''}`}
        >
            <Text className="text-base text-gray-800">{label}</Text>
            <View className="flex-row items-center">
                {isToggle ? (
                    <Switch
                        trackColor={{ false: "#e5e7eb", true: "#f43f5e" }}
                        thumbColor="#ffffff"
                        ios_backgroundColor="#e5e7eb"
                        onValueChange={() => setIsEnabled(!isEnabled)}
                        value={isEnabled}
                    />
                ) : (
                    <>
                        <Text className="text-gray-500 mr-2">{value}</Text>
                        <Feather name="chevron-right" size={20} color="#9ca3af" />
                    </>
                )}
            </View>
        </TouchableOpacity>
    );
};

export default function PreferencesScreen() {
    const router = useRouter();

    return (
        <SafeAreaView className="flex-1 bg-[#f9fafb]">
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 pt-2 pb-4">
                <TouchableOpacity onPress={() => router.back()} className="p-2">
                    <Feather name="arrow-left" size={24} color="#374151" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-gray-800">Preferences</Text>
                <View className="w-10" /> {/* Spacer */}
            </View>

            <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>

                {/* Physical Settings */}
                <View className="bg-white rounded-2xl px-4 py-1 mb-4 shadow-sm border border-gray-100">
                    <PreferenceItem label="Weight Unit" value="kg" />
                    <PreferenceItem label="Height Unit" value="cm" />
                    <PreferenceItem label="Body Mass Index (BMI)" isToggle={true} isLast={true} />
                </View>

                {/* Temperature */}
                <View className="bg-white rounded-2xl px-4 py-1 mb-4 shadow-sm border border-gray-100">
                    <PreferenceItem label="Temperature Unit" value="°C" isLast={true} />
                </View>

                {/* Hydration */}
                <View className="bg-white rounded-2xl px-4 py-1 mb-4 shadow-sm border border-gray-100">
                    <PreferenceItem label="Water Intake Goal" value="2,400" />
                    <PreferenceItem label="Cup Unit" value="mL" isLast={true} />
                </View>

                {/* Calendar & Time */}
                <View className="bg-white rounded-2xl px-4 py-1 mb-4 shadow-sm border border-gray-100">
                    <PreferenceItem label="First Day of Week" value="Sunday" />
                    <PreferenceItem label="Time Format" value="System Default" />
                    <PreferenceItem label="Day Reset Time" value="00:00 AM" isLast={true} />
                </View>

                {/* App Data */}
                <View className="bg-white rounded-2xl px-4 py-1 mb-10 shadow-sm border border-gray-100">
                    <PreferenceItem label="Restart All Progress" value="" />
                    <PreferenceItem label="Clear Cache" value="45.8 MB" isLast={true} />
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}
