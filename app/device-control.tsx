import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
// Using a basic slider if available, otherwise mock with interactive views. We'll mock for simplicity without community-slider dep.
import Slider from '@react-native-community/slider';

export default function DeviceControlScreen() {
    const router = useRouter();
    const [isConnected, setIsConnected] = useState(true);
    const [isAutoMode, setIsAutoMode] = useState(true);
    const [heatLevel, setHeatLevel] = useState(3); // 1-5
    const [vibeLevel, setVibeLevel] = useState(2); // 1-5
    const [isHeatOn, setIsHeatOn] = useState(true);
    const [isVibeOn, setIsVibeOn] = useState(true);

    return (
        <SafeAreaView className="flex-1 bg-[#f9fafb]">
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 pt-2 pb-4 border-b border-gray-100">
                <TouchableOpacity onPress={() => router.back()} className="p-2">
                    <Feather name="arrow-left" size={24} color="#374151" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-gray-800">Smart Therapy</Text>
                <TouchableOpacity className="p-2">
                    <Ionicons name="information-circle-outline" size={24} color="#6b7280" />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>

                {/* Device Connectivity Status */}
                <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100 flex-row items-center justify-between">
                    <View className="flex-row items-center">
                        <View className={`w-12 h-12 rounded-full items-center justify-center mr-3 ${isConnected ? 'bg-blue-50' : 'bg-gray-100'}`}>
                            <Feather name="bluetooth" size={24} color={isConnected ? '#3b82f6' : '#9ca3af'} />
                        </View>
                        <View>
                            <Text className="text-gray-800 font-bold text-base">Lunari N1 Pad</Text>
                            <View className="flex-row items-center mt-1">
                                <View className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                                <Text className="text-sm text-gray-500">{isConnected ? 'Connected' : 'Disconnected'}</Text>
                                {isConnected && (
                                    <Text className="text-sm text-gray-400 ml-3">· 85% Battery</Text>
                                )}
                            </View>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={() => setIsConnected(!isConnected)}
                        className={`px-3 py-1.5 rounded-full ${isConnected ? 'bg-gray-100' : 'bg-blue-500'}`}
                    >
                        <Text className={isConnected ? 'text-gray-600 font-medium' : 'text-white font-medium'}>
                            {isConnected ? 'Disconnect' : 'Connect'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Real-Time Vitals Dashboard */}
                <View className="flex-row justify-between mb-4">
                    {/* Heart Rate */}
                    <View className="bg-white flex-1 mr-2 rounded-2xl p-4 shadow-sm border border-rose-50 items-center">
                        <View className="flex-row items-center mb-2">
                            <Ionicons name="heart" size={16} color="#f43f5e" className="mr-1" />
                            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider ml-1">Live HR</Text>
                        </View>
                        <View className="flex-row items-baseline">
                            <Text className="text-3xl font-black text-gray-800">82</Text>
                            <Text className="text-gray-400 font-medium ml-1">bpm</Text>
                        </View>
                    </View>

                    {/* Skin Temp */}
                    <View className="bg-white flex-1 ml-2 rounded-2xl p-4 shadow-sm border border-orange-50 items-center">
                        <View className="flex-row items-center mb-2">
                            <Ionicons name="thermometer" size={16} color="#f97316" className="mr-1" />
                            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider ml-1">Skin Temp</Text>
                        </View>
                        <View className="flex-row items-baseline">
                            <Text className="text-3xl font-black text-gray-800">36.8</Text>
                            <Text className="text-gray-400 font-medium ml-1">°C</Text>
                        </View>
                    </View>
                </View>

                {/* AI Pain Detection Classification */}
                <View className="bg-white rounded-2xl p-5 mb-6 shadow-sm border border-yellow-100 items-center relative overflow-hidden">
                    <View className="absolute top-0 right-0 bg-yellow-100 px-3 py-1 rounded-bl-lg">
                        <Text className="text-yellow-700 text-[10px] font-bold tracking-widest uppercase">Auto-Detected</Text>
                    </View>
                    <Text className="text-gray-500 text-sm font-medium mb-1">Current Pain Level</Text>
                    <Text className="text-2xl font-black text-yellow-500 mb-2">Moderate Cramps</Text>

                    <View className="w-full flex-row mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <View className="w-1/3 bg-green-400" />
                        <View className="w-1/3 bg-yellow-400" />
                        <View className="w-1/3" /> {/* Red empty for mapping */}
                    </View>
                    <View className="w-full flex-row justify-between mt-1 px-1">
                        <Text className="text-[10px] text-gray-400">Mild</Text>
                        <Text className="text-[10px] text-yellow-500 font-bold">Moderate</Text>
                        <Text className="text-[10px] text-gray-400">Severe</Text>
                    </View>
                </View>

                {/* Therapy Control Panel */}
                <View className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-12">

                    {/* Mode Toggle Header */}
                    <View className="bg-gray-50 p-4 border-b border-gray-100 flex-row justify-between items-center">
                        <View>
                            <Text className="text-gray-800 font-bold text-lg">Therapy Mode</Text>
                            <Text className="text-gray-500 text-xs mt-0.5">
                                {isAutoMode ? 'Targeted relief based on ML detection' : 'Manual override engaged'}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setIsAutoMode(!isAutoMode)}
                            className={`px-4 py-2 rounded-full flex-row items-center ${isAutoMode ? 'bg-[#a78bfa]' : 'bg-gray-200'}`}
                        >
                            <Text className={`font-bold mr-1 ${isAutoMode ? 'text-white' : 'text-gray-600'}`}>
                                {isAutoMode ? 'AUTO' : 'MANUAL'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Controls Container */}
                    <View className={`p-5 ${isAutoMode ? 'opacity-50' : 'opacity-100'}`} pointerEvents={isAutoMode ? 'none' : 'auto'}>

                        {/* Heat Control */}
                        <View className="mb-6">
                            <View className="flex-row justify-between items-center mb-4">
                                <View className="flex-row items-center">
                                    <View className={`w-8 h-8 rounded-full items-center justify-center mr-2 ${isHeatOn ? 'bg-orange-100' : 'bg-gray-100'}`}>
                                        <Ionicons name="flame" size={16} color={isHeatOn ? '#ea580c' : '#9ca3af'} />
                                    </View>
                                    <Text className="text-gray-800 font-bold text-base">Heat Intensity</Text>
                                </View>
                                <Switch
                                    trackColor={{ false: "#e5e7eb", true: "#fdba74" }}
                                    thumbColor={isHeatOn ? "#ea580c" : "#f3f4f6"}
                                    onValueChange={() => setIsHeatOn(!isHeatOn)}
                                    value={isHeatOn}
                                />
                            </View>

                            {/* Mock Slider using flex layout for React Native without deps */}
                            <View className="flex-row justify-between items-center px-2">
                                {[1, 2, 3, 4, 5].map((level) => (
                                    <TouchableOpacity
                                        key={level}
                                        onPress={() => setHeatLevel(level)}
                                        className={`w-12 h-10 items-center justify-center rounded-lg border 
                        ${heatLevel === level && isHeatOn ? 'bg-orange-500 border-orange-500' : 'bg-gray-50 border-gray-200'}`}
                                    >
                                        <Text className={`font-bold ${heatLevel === level && isHeatOn ? 'text-white' : 'text-gray-400'}`}>L{level}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View className="h-[1px] bg-gray-100 w-full mb-6" />

                        {/* Vibration Control */}
                        <View>
                            <View className="flex-row justify-between items-center mb-4">
                                <View className="flex-row items-center">
                                    <View className={`w-8 h-8 rounded-full items-center justify-center mr-2 ${isVibeOn ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                                        <Ionicons name="hardware-chip" size={16} color={isVibeOn ? '#6366f1' : '#9ca3af'} />
                                    </View>
                                    <Text className="text-gray-800 font-bold text-base">Vibration Pattern</Text>
                                </View>
                                <Switch
                                    trackColor={{ false: "#e5e7eb", true: "#c7d2fe" }}
                                    thumbColor={isVibeOn ? "#4f46e5" : "#f3f4f6"}
                                    onValueChange={() => setIsVibeOn(!isVibeOn)}
                                    value={isVibeOn}
                                />
                            </View>

                            {/* Mock Slider for vibe */}
                            <View className="flex-row justify-between items-center px-2">
                                {[1, 2, 3, 4, 5].map((level) => (
                                    <TouchableOpacity
                                        key={level}
                                        onPress={() => setVibeLevel(level)}
                                        className={`w-12 h-10 items-center justify-center rounded-lg border 
                        ${vibeLevel === level && isVibeOn ? 'bg-indigo-500 border-indigo-500' : 'bg-gray-50 border-gray-200'}`}
                                    >
                                        <Text className={`font-bold ${vibeLevel === level && isVibeOn ? 'text-white' : 'text-gray-400'}`}>P{level}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}
