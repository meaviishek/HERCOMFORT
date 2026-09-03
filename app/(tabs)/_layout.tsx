import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { HapticTab } from '@/components/haptic-tab';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 6,
          right: 6,
          backgroundColor: 'transparent',
          borderRadius: 30,
          height: 80,
          elevation: 10,
          borderTopWidth: 0,
          paddingVertical: 10,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarIconStyle: {
          marginTop: 8,
        },
        tabBarBackground: () => (
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: '#ffffff',
              borderRadius: 30,
              overflow: 'hidden',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.1,
              shadowRadius: 15,
              elevation: 5,
            }}
          />
        ),
        tabBarButton: HapticTab,
      }}
    >
      {/* ── Home Tab ─────────────────────────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <View className={`items-center justify-center mt-3 ${focused ? 'bg-[#fff0f4] rounded-2xl w-14 h-14' : 'w-14 h-14'}`}>
              <Ionicons name="home" size={26} color={focused ? '#f43f5e' : '#9ca3af'} />
              {focused && <View className="w-4 h-1 bg-[#f43f5e] rounded-full mt-1" />}
            </View>
          ),
        }}
      />

      {/* ── Device Scanner Tab ───────────────────────────────────── */}
      <Tabs.Screen
        name="chat"
        options={{
          tabBarIcon: ({ focused }) => (
            <View className={`items-center justify-center mt-3 ${focused ? 'bg-[#fff0f4] rounded-2xl w-14 h-14' : 'w-14 h-14'}`}>
              <Feather name="bluetooth" size={24} color={focused ? '#f43f5e' : '#9ca3af'} />
              {focused && <View className="w-4 h-1 bg-[#f43f5e] rounded-full mt-1" />}
            </View>
          ),
        }}
      />

      {/* ── Live Dashboard (center elevated) ─────────────────────── */}
      <Tabs.Screen
        name="explore"
        options={{
          tabBarIcon: ({ focused }) => (
            <View className="items-center justify-center -mt-8">
              <View
                className="items-center justify-center w-[64px] h-[64px] rounded-full border-[4px] border-[#fefcfd] overflow-hidden"
                style={{
                  backgroundColor: focused ? '#f43f5e' : '#fb7185',
                  elevation: 8,
                  shadowColor: '#f43f5e',
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 4 },
                }}
              >
                <Ionicons name="pulse" size={28} color="white" style={{ position: 'absolute', zIndex: 10, elevation: 10 }} />
              </View>
            </View>
          ),
        }}
      />

      {/* ── Manual Control Tab ───────────────────────────────────── */}
      <Tabs.Screen
        name="favorite"
        options={{
          tabBarIcon: ({ focused }) => (
            <View className={`items-center justify-center mt-3 ${focused ? 'bg-[#fff0f4] rounded-2xl w-14 h-14' : 'w-14 h-14'}`}>
              <MaterialCommunityIcons name="tune-vertical" size={24} color={focused ? '#f43f5e' : '#9ca3af'} />
              {focused && <View className="w-4 h-1 bg-[#f43f5e] rounded-full mt-1" />}
            </View>
          ),
        }}
      />

      {/* ── Account Tab ──────────────────────────────────────────── */}
      <Tabs.Screen
        name="account"
        options={{
          tabBarIcon: ({ focused }) => (
            <View className={`items-center justify-center mt-3 ${focused ? 'bg-[#fff0f4] rounded-2xl w-14 h-14' : 'w-14 h-14'}`}>
              <Ionicons name="person" size={26} color={focused ? '#f43f5e' : '#9ca3af'} />
              {focused && <View className="w-4 h-1 bg-[#f43f5e] rounded-full mt-1" />}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
