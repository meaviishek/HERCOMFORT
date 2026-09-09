import React from 'react';
import { View, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { HapticTab } from '@/components/haptic-tab';
import { T } from '../../constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: T.bg.card,
          borderTopWidth: 1,
          borderTopColor: T.border.default,
          height: Platform.OS === 'ios' ? 86 : 72,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          paddingTop: 6,
          elevation: 16,
          shadowColor: T.pink.primary,
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 10,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarIconStyle: {
          marginTop: 6,
        },
        tabBarButton: HapticTab,
      }}
    >
      {/* ── Home Tab ─────────────────────────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 12, width: 56, height: 56, borderRadius: 16, backgroundColor: focused ? T.tab.activeBg : 'transparent' }}>
              <Ionicons name="home" size={26} color={focused ? T.tab.active : T.tab.inactive} />
              {focused && <View style={{ width: 16, height: 4, backgroundColor: T.tab.indicator, borderRadius: 2, marginTop: 2 }} />}
            </View>
          ),
        }}
      />

      {/* ── Device Scanner Tab ───────────────────────────────────── */}
      <Tabs.Screen
        name="chat"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 12, width: 56, height: 56, borderRadius: 16, backgroundColor: focused ? T.tab.activeBg : 'transparent' }}>
              <Feather name="bluetooth" size={24} color={focused ? T.tab.active : T.tab.inactive} />
              {focused && <View style={{ width: 16, height: 4, backgroundColor: T.tab.indicator, borderRadius: 2, marginTop: 2 }} />}
            </View>
          ),
        }}
      />

      {/* ── Live Dashboard (center elevated) ─────────────────────── */}
      <Tabs.Screen
        name="explore"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: -32 }}>
              <View style={{ alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 32, borderWidth: 4, borderColor: '#fefcfd', overflow: 'hidden', backgroundColor: focused ? T.tab.fabBgFocused : T.tab.fabBg, elevation: 8, shadowColor: T.pink.primary, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
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
            <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 12, width: 56, height: 56, borderRadius: 16, backgroundColor: focused ? T.tab.activeBg : 'transparent' }}>
              <MaterialCommunityIcons name="tune-vertical" size={24} color={focused ? T.tab.active : T.tab.inactive} />
              {focused && <View style={{ width: 16, height: 4, backgroundColor: T.tab.indicator, borderRadius: 2, marginTop: 2 }} />}
            </View>
          ),
        }}
      />

      {/* ── Account Tab ──────────────────────────────────────────── */}
      <Tabs.Screen
        name="account"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 12, width: 56, height: 56, borderRadius: 16, backgroundColor: focused ? T.tab.activeBg : 'transparent' }}>
              <Ionicons name="person" size={26} color={focused ? T.tab.active : T.tab.inactive} />
              {focused && <View style={{ width: 16, height: 4, backgroundColor: T.tab.indicator, borderRadius: 2, marginTop: 2 }} />}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
