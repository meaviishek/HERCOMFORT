import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

// SVG Wave for the bottom of the pink header area
const WaveShape = () => {
  return (
    <View className="absolute -bottom-1 w-full" style={{ height: 60, zIndex: 10 }}>
      {/* 
        This is a smooth bezier curve drawing exactly like the bottom of the pink section 
        in the provided mockup.
      */}
      <Svg width={width} height="60" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <Path
          fill="#ffffff"
          d="M0,60 C320,120 420,0 720,60 C1020,120 1120,0 1440,60 L1440,120 L0,120 Z"
        />
      </Svg>
    </View>
  );
};

export default function HomeScreen() {
  const router = useRouter();

  const daysOfWeek = [
    { label: 'S', day: 10 },
    { label: 'M', day: 11 },
    { label: 'T', day: 12 },
    { label: 'W', day: 13 },
    { label: 'T', day: 14, active: true },
    { label: 'Today', day: 15, future: true },
    { label: 'S', day: 16, future: true },
  ];

  return (
    <View className="flex-1 bg-white pt-12">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120, backgroundColor: 'white' }}>

        {/* Pink Header Background Container */}
        <View className="bg-[#fce7f3] pt-2 pb-16 relative overflow-hidden" style={{ minHeight: 460 }}>

          {/* Top Nav Row */}
          <View className="flex-row justify-between items-center px-6 mb-8 z-20">
            <TouchableOpacity>
              <Feather name="menu" size={28} color="#374151" />
            </TouchableOpacity>

            <Text className="text-gray-900 text-lg font-extrabold tracking-wide">October 16</Text>

            <TouchableOpacity>
              <Feather name="calendar" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Days Calendar Row */}
          <View className="flex-row justify-between px-5 mb-8 z-20">
            {daysOfWeek.map((item, i) => (
              <View key={i} className="items-center">
                <Text className="text-gray-800 font-bold mb-3 text-xs tracking-widest">{item.label}</Text>

                {item.active ? (
                  // Active Day (Thursday, 14th)
                  <View className="w-10 h-10 bg-[#e84ea1] rounded-full items-center justify-center shadow-lg shadow-pink-900/40 border-2 border-white">
                    <Text className="text-white font-bold text-base">{item.day}</Text>
                  </View>
                ) : item.future ? (
                  // Future Days with dashed border (15, 16)
                  <View className="w-10 h-10 rounded-full border-[1.5px] border-dashed border-pink-300 items-center justify-center">
                    <Text className="text-pink-300 font-bold text-base">{item.day}</Text>
                  </View>
                ) : (
                  // Past Days (10, 11, 12, 13)
                  <View className="w-10 h-10 items-center justify-center">
                    <Text className="text-gray-700 font-bold text-base opacity-80">{item.day}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Concentric Circles & Main Content */}
          <View className="items-center justify-center mt-6 z-10">

            {/* Outermost Ring */}
            <View className="absolute bg-[#fbcfe8] rounded-full opacity-60 w-[380px] h-[380px]" />

            {/* Middle Ring */}
            <View className="absolute bg-[#f9a8d4] rounded-full opacity-80 w-[280px] h-[280px]" />

            {/* Inner Solid Circle */}
            <View className="bg-[#e84ea1] rounded-full w-[210px] h-[210px] items-center justify-center shadow-lg shadow-pink-900/10 z-20 p-5 mt-2">
              <Text className="text-white text-sm font-bold tracking-widest uppercase mb-1">Period:</Text>
              <Text className="text-white text-[56px] font-black leading-tight tracking-tighter">Day 1</Text>

              <Text className="text-white text-xs text-center font-medium opacity-90 px-4 mt-2 mb-4 leading-4">
                Low chance{'\n'}getting pregnant
              </Text>

              <TouchableOpacity className="bg-white/90 rounded-full px-5 py-2.5 flex-row items-center border border-pink-200">
                <Text className="text-[#e84ea1] font-bold text-xs mr-2">Edit Period</Text>
                <Feather name="edit-2" size={12} color="#e84ea1" />
              </TouchableOpacity>
            </View>
          </View>

          {/* The White Wave Overlay defining the bottom boundary */}
          <WaveShape />
        </View>

        {/* --- Below the Wave: Scrollable Cards Section --- */}

        {/* Feeling Stressed Card */}
        <View className="mx-6 bg-[#fdf2f8] rounded-[32px] p-6 flex-row items-center border border-pink-100 shadow-sm relative overflow-hidden mt-6">

          {/* Background Blob decoration */}
          <View className="absolute -bottom-8 -right-8 w-32 h-32 bg-[#fbcfe8] rounded-full opacity-60 border-[12px] border-[#fce7f3]" />

          <View className="flex-1 z-10 pr-2">
            <Text className="text-[22px] font-extrabold text-gray-900 mb-2 leading-7">Feeling Stressed{'\n'}Today?</Text>
            <Text className="text-gray-500 text-xs leading-5 mb-5 pr-4 font-medium">
              It's okay to slow down your body just needs a little calm and care.
            </Text>
            <TouchableOpacity className="bg-[#e84ea1] rounded-full py-3 px-5 self-start shadow-sm">
              <Text className="text-white font-bold text-sm">Explore Quick Relief</Text>
            </TouchableOpacity>
          </View>

          <View className="items-center justify-center z-10 ml-2 mt-4">
            {/* Stand-in for Yoga Illustration */}
            <Ionicons name="body" size={72} color="#f9a8d4" />
          </View>
        </View>

        {/* Current Health Status (IoT Data) */}
        <View className="mt-8 px-6 mb-2">
          <View className="flex-row justify-between items-end mb-4">
            <Text className="text-[22px] font-extrabold text-gray-900">Health Status</Text>
            <Text className="text-gray-400 font-medium text-xs">Last recorded 2h ago</Text>
          </View>
          <View className="flex-row justify-between">
            {/* Heart Rate */}
            <View className="bg-white flex-1 mr-2 rounded-[24px] p-4 shadow-sm border border-gray-100 items-center">
              <View className="flex-row items-center mb-2">
                <Ionicons name="heart" size={16} color="#e84ea1" className="mr-1" />
                <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest ml-1">Live HR</Text>
              </View>
              <View className="flex-row items-baseline mt-1">
                <Text className="text-3xl font-black text-gray-800 tracking-tight">82</Text>
                <Text className="text-pink-400 font-bold ml-1 text-xs">bpm</Text>
              </View>
            </View>

            {/* Skin Temp */}
            <View className="bg-white flex-1 ml-2 rounded-[24px] p-4 shadow-sm border border-gray-100 items-center">
              <View className="flex-row items-center mb-2">
                <Ionicons name="thermometer" size={16} color="#f9a8d4" className="mr-1" />
                <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest ml-1">Skin Temp</Text>
              </View>
              <View className="flex-row items-baseline mt-1">
                <Text className="text-3xl font-black text-gray-800 tracking-tight">36.8</Text>
                <Text className="text-pink-400 font-bold ml-1 text-xs">°C</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Symptoms & Activity Horizontal Scroll */}
        <View className="mt-8">
          <Text className="text-[22px] font-extrabold text-gray-900 mb-5 px-6">How's Your Cycle Today?</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="overflow-visible pl-6"
            contentContainerStyle={{ paddingRight: 40 }}
          >

            {/* Add Symptoms Button */}
            <TouchableOpacity
              onPress={() => router.push('/log-pain')}
              className="bg-[#fdf2f8] w-[130px] h-[170px] rounded-[32px] mr-4 p-5 items-center justify-center border border-pink-100 shadow-sm"
            >
              <View className="w-12 h-12 rounded-full border-2 border-pink-200 items-center justify-center mb-3 bg-white shadow-sm">
                <Feather name="plus" size={20} color="#f472b6" />
              </View>
              <Text className="text-gray-800 font-extrabold text-sm text-center tracking-tight">Add{'\n'}Symptoms</Text>
            </TouchableOpacity>

            {/* Stress Meditation Card (Orange) */}
            <TouchableOpacity className="bg-[#fb923c] w-[150px] h-[170px] rounded-[32px] mr-4 p-5 relative overflow-hidden shadow-sm shadow-orange-900/20">
              <View className="flex-row items-center bg-white/30 px-2 py-1 rounded-full self-start mb-2">
                <Text className="text-white text-[10px] font-bold">5 min</Text>
              </View>
              <Text className="text-white font-extrabold text-[16px] leading-5 pr-4 mt-1">Stress{'\n'}Meditation</Text>

              {/* Decorative icon mapping to illustration */}
              <View className="absolute -bottom-6 -right-2 opacity-90">
                <Ionicons name="leaf" size={80} color="white" />
              </View>
            </TouchableOpacity>

            {/* Basic Relaxation Card (Purple) */}
            <TouchableOpacity className="bg-[#7c3aed] w-[150px] h-[170px] rounded-[32px] mr-4 p-5 relative overflow-hidden shadow-sm shadow-purple-900/20">
              <View className="flex-row items-center bg-white/20 px-2 py-1 rounded-full self-start mb-2">
                <Text className="text-white text-[10px] font-bold">10 min</Text>
              </View>
              <Text className="text-white font-extrabold text-[16px] leading-5 w-2/3 pr-2 mt-1">Basic{'\n'}relaxation</Text>

              <View className="absolute -bottom-6 right-0 opacity-80">
                <Ionicons name="moon" size={76} color="white" />
              </View>
            </TouchableOpacity>

          </ScrollView>
        </View>

      </ScrollView>
    </View>
  );
}
