import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function LogPainScreen() {
    const router = useRouter();
    const [painLevel, setPainLevel] = useState(5);
    const [notes, setNotes] = useState('');

    const symptomsList = [
        'Cramps', 'Headache', 'Backache', 'Nausea', 'Fatigue', 'Bloating', 'Acne', 'Mood Swings'
    ];
    const [selectedSymptoms, setSelectedSymptoms] = useState(['Cramps', 'Fatigue']);

    const toggleSymptom = (symptom) => {
        if (selectedSymptoms.includes(symptom)) {
            setSelectedSymptoms(selectedSymptoms.filter(s => s !== symptom));
        } else {
            setSelectedSymptoms([...selectedSymptoms, symptom]);
        }
    };

    // Helper dynamic color for pain level
    const getPainColor = () => {
        if (painLevel <= 3) return '#34d399'; // Green (Mild)
        if (painLevel <= 6) return '#fbbf24'; // Yellow (Moderate)
        return '#ef4444'; // Red (Severe)
    };

    return (
        <SafeAreaView className="flex-1 bg-[#f9fafb]">
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 pt-2 pb-4">
                <TouchableOpacity onPress={() => router.back()} className="p-2">
                    <Feather name="x" size={24} color="#374151" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-gray-800">Log Symptoms</Text>
                <TouchableOpacity className="p-2">
                    <Text className="text-[#f43f5e] font-bold">Save</Text>
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>

                {/* Auto-filled Date/Time */}
                <View className="items-center mb-8">
                    <Text className="text-gray-400 font-medium">Today, {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>

                {/* Dynamic Pain Slider Section */}
                <View className="bg-white rounded-[32px] p-6 mb-6 shadow-sm border border-gray-100 items-center">
                    <Text className="text-gray-800 font-bold text-lg mb-6">How severe is your pain?</Text>

                    {/* Pain Circular Display */}
                    <View className="items-center justify-center mb-8">
                        <View
                            className="w-24 h-24 rounded-full items-center justify-center border-4"
                            style={{ borderColor: getPainColor() }}
                        >
                            <Text className="text-4xl font-black" style={{ color: getPainColor() }}>{painLevel}</Text>
                        </View>
                        <Text className="text-gray-500 font-medium mt-3">
                            {painLevel <= 3 ? 'Mild Discomfort' : painLevel <= 6 ? 'Moderate Cramps' : 'Severe Pain'}
                        </Text>
                    </View>

                    {/* Custom Interactive Scale (Mocking 1-10 slider visually) */}
                    <View className="w-full">
                        <View className="flex-row justify-between mb-2">
                            <Text className="text-xs text-gray-400 font-bold">1</Text>
                            <Text className="text-xs text-gray-400 font-bold">10</Text>
                        </View>
                        <View className="flex-row justify-between items-center w-full h-8 relative">
                            {/* Background Track */}
                            <View className="absolute left-0 right-0 h-2 bg-gray-100 rounded-full" />

                            {/* 10 interaction points */}
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                                <TouchableOpacity
                                    key={val}
                                    onPress={() => setPainLevel(val)}
                                    className={`z-10 w-6 h-6 rounded-full items-center justify-center ${painLevel === val ? 'bg-white shadow-md' : 'bg-transparent'}`}
                                    style={painLevel === val ? { borderWidth: 2, borderColor: getPainColor() } : {}}
                                >
                                    <View className={`w-2 h-2 rounded-full ${painLevel >= val ? '' : 'bg-gray-300'}`}
                                        style={painLevel >= val && painLevel !== val ? { backgroundColor: getPainColor() } : {}} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>

                {/* Symptoms Selection */}
                <View className="mb-8">
                    <Text className="text-gray-800 font-bold text-lg mb-4 ml-1">Symptoms</Text>
                    <View className="flex-row flex-wrap">
                        {symptomsList.map((symptom) => (
                            <TouchableOpacity
                                key={symptom}
                                onPress={() => toggleSymptom(symptom)}
                                className={`px-4 py-2.5 rounded-full mr-2 mb-3 border 
                  ${selectedSymptoms.includes(symptom) ? 'bg-[#fff0f4] border-pink-200' : 'bg-white border-gray-200'}`}
                            >
                                <Text className={`font-medium ${selectedSymptoms.includes(symptom) ? 'text-[#f43f5e]' : 'text-gray-600'}`}>
                                    {symptom}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Optional Notes */}
                <View className="mb-24">
                    <Text className="text-gray-800 font-bold text-lg mb-4 ml-1">Notes (Optional)</Text>
                    <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 min-h-[120px]">
                        <TextInput
                            multiline
                            numberOfLines={4}
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="e.g. Stressful day at work, took ibuprofen..."
                            placeholderTextColor="#9ca3af"
                            className="flex-1 text-gray-800 text-base"
                            textAlignVertical="top"
                        />
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}
