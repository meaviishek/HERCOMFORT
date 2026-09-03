/**
 * Manual Control Screen — favorite.tsx (repurposed tab)
 *
 * Allows the user to:
 *  - Toggle between Auto and Manual mode
 *  - Manually override the vibration motor and heater
 * Controls are disabled in Auto mode.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useBluetooth, CONNECTION_STATUS } from '../../context/BluetoothContext';

// ─── Animated Toggle Button ───────────────────────────────────────────────────
function BigToggleButton({ label, sublabel, isOn, onToggle, disabled, activeColor, icon, loadingKey }) {
  const scale = useRef(new Animated.Value(1)).current;
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (loading || disabled) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();

    setLoading(true);
    try {
      await onToggle(!isOn);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        disabled={disabled || loading}
        className={`rounded-3xl p-5 border-2 ${
          isOn
            ? `border-[${activeColor}]`
            : 'border-gray-100 bg-white'
        }`}
        style={{
          backgroundColor: isOn ? activeColor + '12' : '#ffffff',
          borderColor: isOn ? activeColor : '#f3f4f6',
          elevation: 3,
          shadowColor: isOn ? activeColor : '#000',
          shadowOpacity: isOn ? 0.15 : 0.04,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 3 },
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <View className="flex-row items-center justify-between">
          {/* Icon + labels */}
          <View className="flex-row items-center flex-1">
            <View
              className="w-14 h-14 rounded-2xl items-center justify-center mr-4"
              style={{ backgroundColor: isOn ? activeColor + '20' : '#f9fafb' }}
            >
              {icon}
            </View>
            <View className="flex-1">
              <Text className="text-gray-800 font-bold text-base">{label}</Text>
              <Text className="text-gray-400 text-xs mt-0.5">{sublabel}</Text>
            </View>
          </View>

          {/* State pill */}
          {loading ? (
            <ActivityIndicator color={activeColor} />
          ) : (
            <View
              className="px-4 py-2 rounded-full"
              style={{ backgroundColor: isOn ? activeColor : '#f3f4f6' }}
            >
              <Text
                className="font-bold text-sm"
                style={{ color: isOn ? '#ffffff' : '#9ca3af' }}
              >
                {isOn ? 'ON' : 'OFF'}
              </Text>
            </View>
          )}
        </View>

        {/* State bar at bottom */}
        <View className="mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <View
            style={{
              width: isOn ? '100%' : '0%',
              height: '100%',
              backgroundColor: activeColor,
              borderRadius: 999,
            }}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Mode Toggle ──────────────────────────────────────────────────────────────
function ModeToggle({ autoMode, onToggle, loading }) {
  return (
    <View className="bg-gray-50 rounded-3xl p-1.5 flex-row mb-6">
      <TouchableOpacity
        onPress={() => !autoMode && onToggle(true)}
        disabled={autoMode || loading}
        className={`flex-1 py-3.5 rounded-2xl items-center flex-row justify-center ${
          autoMode ? 'bg-[#f43f5e]' : 'bg-transparent'
        }`}
        style={autoMode ? { elevation: 3, shadowColor: '#f43f5e', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } } : {}}
      >
        {loading && autoMode && <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />}
        <MaterialCommunityIcons
          name="robot"
          size={18}
          color={autoMode ? 'white' : '#9ca3af'}
        />
        <Text
          className={`ml-2 font-bold text-sm ${autoMode ? 'text-white' : 'text-gray-400'}`}
        >
          Auto
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => autoMode && onToggle(false)}
        disabled={!autoMode || loading}
        className={`flex-1 py-3.5 rounded-2xl items-center flex-row justify-center ${
          !autoMode ? 'bg-amber-500' : 'bg-transparent'
        }`}
        style={!autoMode ? { elevation: 3, shadowColor: '#d97706', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } } : {}}
      >
        {loading && !autoMode && <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />}
        <MaterialCommunityIcons
          name="hand-pointing-right"
          size={18}
          color={!autoMode ? 'white' : '#9ca3af'}
        />
        <Text
          className={`ml-2 font-bold text-sm ${!autoMode ? 'text-white' : 'text-gray-400'}`}
        >
          Manual
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Disconnected placeholder ─────────────────────────────────────────────────
function DisconnectedMsg() {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <View className="w-24 h-24 rounded-full bg-gray-50 items-center justify-center mb-5">
        <Feather name="bluetooth-off" size={40} color="#d1d5db" />
      </View>
      <Text className="text-gray-700 font-bold text-xl mb-2">Not Connected</Text>
      <Text className="text-gray-400 text-sm text-center px-10 leading-5">
        Connect to your PainReliefBand from the Devices tab to enable manual controls.
      </Text>
    </View>
  );
}

// ─── Last Command Badge ───────────────────────────────────────────────────────
function LastCommandBadge({ lastCommand }) {
  if (!lastCommand) return null;
  const ago = Math.round((Date.now() - lastCommand.sentAt) / 1000);
  return (
    <View className="flex-row items-center justify-center mt-4">
      <View className="bg-gray-800 px-4 py-2 rounded-full flex-row items-center">
        <MaterialCommunityIcons name="send-check" size={13} color="#6ee7b7" />
        <Text className="text-gray-300 text-[11px] font-mono ml-2">
          Sent: {JSON.stringify(lastCommand).replace(/,"sentAt":\d+/, '')} · {ago}s ago
        </Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ManualControlScreen() {
  const { liveData, connectedDevice, connectionStatus, sendCommand, lastCommand } = useBluetooth();
  const isConnected = connectionStatus === CONNECTION_STATUS.CONNECTED;

  const [modeLoading, setModeLoading] = useState(false);

  // Derived state from live device data
  const systemActive = liveData?.system_active ?? false;
  const motorOn = liveData?.motor ?? false;
  const ledOn = liveData?.led ?? false;
  const beatDetected = liveData?.beat_detected ?? false;

  const manualDisabled = false; // ESP32 manages its own mode; always allow commands

  // ─── Mode toggle ──────────────────────────────────────────────────────────
  const handleModeToggle = useCallback(async (wantAuto) => {
    setModeLoading(true);
    try {
      await sendCommand({ mode: wantAuto ? 'auto' : 'manual' });
    } finally {
      setModeLoading(false);
    }
  }, [sendCommand]);

  // ─── Motor toggle ─────────────────────────────────────────────────────────
  const handleMotorToggle = useCallback(async (wantOn) => {
    await sendCommand({ motor: wantOn ? 1 : 0 });
  }, [sendCommand]);

  // ─── LED toggle ────────────────────────────────────────────────────────────
  const handleLedToggle = useCallback(async (wantOn) => {
    await sendCommand({ led: wantOn ? 1 : 0 });
  }, [sendCommand]);

  return (
    <SafeAreaView className="flex-1 bg-[#fffbfd]">
      {/* Header */}
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-black text-gray-800">Control</Text>
        <Text className="text-gray-400 text-sm mt-0.5">
          {isConnected
            ? connectedDevice?.name || 'PainReliefBand'
            : 'No device connected'}
        </Text>
      </View>

      {!isConnected ? (
        <DisconnectedMsg />
      ) : (
        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* System Active Banner */}
          <View className={`flex-row items-center px-4 py-3 rounded-2xl mb-4 ${systemActive ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
            <View className={`w-2.5 h-2.5 rounded-full mr-2 ${systemActive ? 'bg-green-400' : 'bg-gray-300'}`} />
            <Text className={`font-bold text-sm ${systemActive ? 'text-green-700' : 'text-gray-500'}`}>
              {systemActive ? 'System Active — Therapy Running' : 'System Idle'}
            </Text>
            {beatDetected && (
              <View className="ml-auto flex-row items-center bg-rose-100 px-2 py-1 rounded-full">
                <Ionicons name="heart" size={12} color="#f43f5e" />
                <Text className="text-rose-600 text-[10px] font-bold ml-1">Beat ✓</Text>
              </View>
            )}
          </View>

          {/* Mode Section */}
          <View className="bg-white rounded-3xl p-5 mb-4 border border-gray-100" style={{ elevation: 2 }}>
            <View className="flex-row items-center mb-4">
              <View className="w-8 h-8 rounded-xl bg-pink-50 items-center justify-center mr-3">
                <MaterialCommunityIcons name="cog" size={18} color="#f43f5e" />
              </View>
              <View>
                <Text className="text-gray-800 font-bold text-base">Manual Overrides</Text>
                <Text className="text-gray-400 text-xs">Send commands directly to the device</Text>
              </View>
            </View>
            <View className="p-3 rounded-2xl bg-pink-50">
              <Text className="text-xs leading-5 font-medium text-rose-500">
                {'🩺  Commands are sent directly to the ESP32. The device firmware controls safety shutoffs automatically.'}
              </Text>
            </View>
          </View>

          {/* Controls Section */}
          <View className="mb-4">
            {manualDisabled && (
              <View className="flex-row items-center mb-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                <Ionicons name="lock-closed" size={14} color="#9ca3af" />
                <Text className="text-gray-400 text-xs ml-2">
                  Switch to Manual mode to enable overrides
                </Text>
              </View>
            )}

            <View className="gap-3">
              {/* Motor */}
              <BigToggleButton
                label="Vibration Motor"
                sublabel="Pulse massage therapy"
                isOn={motorOn}
                onToggle={handleMotorToggle}
                disabled={manualDisabled}
                activeColor="#f43f5e"
                icon={<MaterialCommunityIcons name="vibrate" size={26} color={motorOn ? '#f43f5e' : '#9ca3af'} />}
              />

              {/* LED */}
              <BigToggleButton
                label="LED Indicator"
                sublabel="Device status light"
                isOn={ledOn}
                onToggle={handleLedToggle}
                disabled={manualDisabled}
                activeColor="#f59e0b"
                icon={<Ionicons name="bulb" size={26} color={ledOn ? '#f59e0b' : '#9ca3af'} />}
              />
            </View>
          </View>

          {/* Live status summary */}
          {liveData && (
            <View className="bg-gray-900 rounded-3xl p-5 mb-4">
              <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Current Device State</Text>
              <View className="flex-row flex-wrap gap-2">
                {[
                  { key: 'Motor', val: motorOn ? 'ON' : 'OFF', color: motorOn ? '#34d399' : '#6b7280' },
                  { key: 'LED', val: ledOn ? 'ON' : 'OFF', color: ledOn ? '#fbbf24' : '#6b7280' },
                  { key: 'System', val: systemActive ? 'ACTIVE' : 'IDLE', color: systemActive ? '#34d399' : '#6b7280' },
                  { key: 'Temp', val: `${liveData.temp?.toFixed(1)}°C`, color: '#f9a8d4' },
                  { key: 'BPM', val: `${liveData.bpm}`, color: '#f9a8d4' },
                  { key: 'ADC', val: `${liveData.raw_analog ?? '—'}`, color: '#c4b5fd' },
                ].map(({ key, val, color }) => (
                  <View key={key} className="flex-row items-center bg-gray-800 rounded-xl px-3 py-1.5">
                    <Text className="text-gray-500 text-[10px] font-bold mr-1.5">{key}</Text>
                    <Text className="text-xs font-bold" style={{ color }}>{val}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Last command */}
          <LastCommandBadge lastCommand={lastCommand} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
