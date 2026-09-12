import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { HapticTab } from '@/components/haptic-tab';
import { T, palette } from '../../constants/theme';

// ─── Theme Colors ─────────────────────────────────────────────────────────────
const PINK_PRIMARY = '#E84EA1';  // Vibrant signature Nari pink
const PINK_DEEP = '#BE185D';     // Deep pink for 3D gradient/accent
const PINK_GLOW = '#F472B6';     // Glow highlight
const PINK_LIGHT = '#FDF2F8';    // Very soft blush for inactive tabs
const PINK_MUTED = '#9CA3AF';    // Unselected icon color

// ─── Regular Tab Icon with 3D depth ──────────────────────────────────────────
function TabIcon({
  focused,
  children,
}: {
  focused: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.tabIconWrapper}>
      <View
        style={[
          styles.tabIconInner,
          focused && styles.tabIconInnerFocused,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

// ─── Center 3D Floating Action Button (Session) matching Reference Image ─────
function CenterSessionButton({ focused }: { focused: boolean }) {
  return (
    <View style={styles.centerFabContainer}>
      {/* Outer subtle shadow/glow ring */}
      <View style={styles.centerFabRing}>
        {/* 3D Main circular button with layered bevel */}
        <View
          style={[
            styles.centerFab,
            focused ? styles.centerFabFocused : styles.centerFabNormal,
          ]}
        >
          {/* Top gloss highlight bevel */}
          <View style={styles.centerFabGloss} />
          <Ionicons
            name="flash"
            size={25}
            color="#FFFFFF"
            style={styles.centerFabIcon}
          />
        </View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.2,
          marginTop: -2,
          marginBottom: Platform.OS === 'ios' ? 0 : 5,
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#FCE7F3',
          height: Platform.OS === 'ios' ? 88 : 74,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 4,
          elevation: 20,
          shadowColor: PINK_PRIMARY,
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
        },
        tabBarActiveTintColor: PINK_PRIMARY,
        tabBarInactiveTintColor: PINK_MUTED,
        tabBarButton: HapticTab,
      }}
    >
      {/* ── 1. Today / Home (Far Left) ─────────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: 'Today',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <Ionicons
                name={focused ? 'calendar' : 'calendar-outline'}
                size={22}
                color={focused ? PINK_PRIMARY : PINK_MUTED}
              />
            </TabIcon>
          ),
        }}
      />

      {/* ── 2. AI Chat (Left of Center) ────────────────────────────── */}
      <Tabs.Screen
        name="ai-chat"
        options={{
          tabBarLabel: 'AI Chat',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <MaterialCommunityIcons
                name={focused ? 'chat-processing' : 'chat-processing-outline'}
                size={22}
                color={focused ? PINK_PRIMARY : PINK_MUTED}
              />
            </TabIcon>
          ),
        }}
      />

      {/* ── 3. Session (Center 3D Floating Action Button) ─────────── */}
      <Tabs.Screen
        name="session"
        options={{
          tabBarLabel: 'Session',
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '800',
            color: PINK_PRIMARY,
            marginTop: 4,
            marginBottom: Platform.OS === 'ios' ? 0 : 4,
          },
          tabBarIcon: ({ focused }) => (
            <CenterSessionButton focused={focused} />
          ),
        }}
      />

      {/* ── 4. History (Right of Center) ───────────────────────────── */}
      <Tabs.Screen
        name="history"
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <Ionicons
                name={focused ? 'time' : 'time-outline'}
                size={23}
                color={focused ? PINK_PRIMARY : PINK_MUTED}
              />
            </TabIcon>
          ),
        }}
      />

      {/* ── 5. Profile (Far Right) ─────────────────────────────────── */}
      <Tabs.Screen
        name="account"
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={22}
                color={focused ? PINK_PRIMARY : PINK_MUTED}
              />
            </TabIcon>
          ),
        }}
      />

      {/* ── Hidden routes (Insights, Scanner, etc. accessible in app) ── */}
      <Tabs.Screen
        name="explore"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="chat"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="favorite"
        options={{ href: null }}
      />
    </Tabs>
  );
}

// ─── 3D Styles matching reference image with vibrant Pink UI ──────────────────
const styles = StyleSheet.create({
  tabIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    width: 44,
  },
  tabIconInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconInnerFocused: {
    backgroundColor: PINK_LIGHT,
    elevation: 2,
    shadowColor: PINK_PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  // Center 3D Floating Action Button
  centerFabContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
  },
  centerFabRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFF0F7',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: PINK_PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 12,
  },
  centerFab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  centerFabNormal: {
    backgroundColor: PINK_PRIMARY,
    borderWidth: 2,
    borderColor: '#FDF2F8',
    elevation: 8,
    shadowColor: PINK_PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  centerFabFocused: {
    backgroundColor: PINK_DEEP,
    borderWidth: 2.5,
    borderColor: '#FCE7F3',
    transform: [{ scale: 1.05 }],
    elevation: 12,
    shadowColor: PINK_DEEP,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  centerFabGloss: {
    position: 'absolute',
    top: 0,
    left: 4,
    right: 4,
    height: 18,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  centerFabIcon: {
    zIndex: 2,
    elevation: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 2,
  },
});
