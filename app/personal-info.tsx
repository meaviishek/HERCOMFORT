import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Reusable Input Field Form Component
const InfoField = ({ label, value, icon, isDropdown = false, keyboardType = 'default' }) => (
    <View className="mb-5">
        <Text className="text-sm font-medium text-gray-700 mb-2">{label}</Text>
        <View className="bg-gray-50/50 rounded-xl px-4 py-3 border border-gray-100 flex-row items-center">
            {icon && <View className="mr-3">{icon}</View>}

            {isDropdown ? (
                <TouchableOpacity className="flex-1 flex-row justify-between items-center">
                    <Text className="text-gray-800 text-base">{value}</Text>
                    <Feather name="chevron-down" size={20} color="#6b7280" />
                </TouchableOpacity>
            ) : (
                <TextInput
                    value={value}
                    keyboardType={keyboardType}
                    className="flex-1 text-gray-800 text-base py-0.5"
                    editable={!isDropdown}
                />
            )}
        </View>
    </View>
);

export default function PersonalInfoScreen() {
    const router = useRouter();

    return (
        <SafeAreaView className="flex-1 bg-white">
            {/* Header */}
            <View className="flex-row items-center px-4 pt-2 pb-6 border-b border-gray-50">
                <TouchableOpacity onPress={() => router.back()} className="p-2">
                    <Feather name="arrow-left" size={24} color="#374151" />
                </TouchableOpacity>
                <Text className="flex-1 text-center text-xl font-bold text-gray-800 mr-8">Personal Info</Text>
            </View>

            <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>

                {/* Profile Image Edit */}
                <View className="items-center mb-8">
                    <View className="relative">
                        <Image
                            source={{ uri: 'https://i.pravatar.cc/150?u=a042581f4e29026024d' }}
                            className="w-24 h-24 rounded-full border-4 border-white shadow-sm"
                        />
                        <TouchableOpacity className="absolute bottom-0 right-0 bg-[#f43f5e] w-8 h-8 rounded-full items-center justify-center border-2 border-white">
                            <Feather name="edit-2" size={14} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Form Fields */}
                <InfoField
                    label="Full Name"
                    value="Isabella Ainsley"
                />

                <InfoField
                    label="Email"
                    value="isabella.ainsley@yourdomain.com"
                    icon={<Feather name="mail" size={18} color="#6b7280" />}
                    keyboardType="email-address"
                />

                {/* Phone Field (Custom Layout based on image) */}
                <View className="mb-5">
                    <Text className="text-sm font-medium text-gray-700 mb-2">Phone Number</Text>
                    <View className="bg-gray-50/50 rounded-xl px-4 py-3 border border-gray-100 flex-row items-center">
                        <TouchableOpacity className="flex-row items-center border-r border-gray-200 pr-3 mr-3">
                            <Text className="mr-1 text-lg">🇺🇸</Text>
                            <Feather name="chevron-down" size={16} color="#6b7280" />
                        </TouchableOpacity>
                        <TextInput
                            value="+1 (646) 555-4099"
                            keyboardType="phone-pad"
                            className="flex-1 text-gray-800 text-base py-0.5"
                        />
                    </View>
                </View>

                <InfoField
                    label="Gender"
                    value="Female"
                    isDropdown={true}
                />

                <InfoField
                    label="Date of Birth"
                    value="12-25-1995"
                    isDropdown={true} // Using dropdown visually to act as a date picker button
                    icon={null} // Icon on the right side handled differently, let's inject it via value string or custom
                />

                {/* Date of Birth Custom Overide for Right Icon */}
                <View className="-mt-[72px] mb-[72px] pointer-events-none items-end justify-center pr-4 h-[50px]">
                    <Feather name="calendar" size={18} color="#6b7280" />
                </View>

                <View className="h-10" />
            </ScrollView>
        </SafeAreaView>
    );
}
