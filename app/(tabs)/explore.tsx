/**
 * Live Dashboard Screen — explore.tsx
 *
 * Updated for new ESP32 JSON schema:
 * { temp, bpm, raw_analog, system_active, motor, led, beat_detected }
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useBluetooth, CONNECTION_STATUS } from '../../context/BluetoothContext';

// ─── Animated pulse ring ──────────────────────────────────────────────────────
function PulseRing({ active }: { active: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!active) return;
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.4, duration: 700, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [active]);

  if (!active) return null;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: '#fca5a5',
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

// ─── Vital Card ───────────────────────────────────────────────────────────────
function VitalCard({ icon, label, value, unit, subLabel, subColor, isPulsing = false, iconColor = '#f43f5e', bg = '#fff0f4' }: any) {
  return (
    <View className="flex-1 bg-white rounded-3xl p-5 border border-pink-50 items-center"
      style={{ elevation: 2 }}>
      <View className="items-center justify-center mb-3" style={{ width: 48, height: 48 }}>
        <PulseRing active={isPulsing} />
        <View className="w-12 h-12 rounded-full items-center justify-center z-10" style={{ backgroundColor: bg }}>
          {icon}
        </View>
      </View>
      <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">{label}</Text>
      <View className="flex-row items-baseline">
        <Text className="text-3xl font-black text-gray-800">{value}</Text>
        {unit ? <Text className="text-sm font-semibold ml-1" style={{ color: iconColor }}>{unit}</Text> : null}
      </View>
      {subLabel ? (
        <View className="mt-2 px-3 py-1 rounded-full" style={{ backgroundColor: subColor + '20' }}>
          <Text className="text-[10px] font-bold" style={{ color: subColor }}>{subLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Status Chip ──────────────────────────────────────────────────────────────
function StatusChip({ label, isOn, icon }: any) {
  return (
    <View className={`flex-row items-center px-4 py-3 rounded-2xl border flex-1 ${isOn ? 'bg-rose-50 border-rose-200' : 'bg-gray-50 border-gray-100'}`}>
      <View className={`w-8 h-8 rounded-full items-center justify-center mr-2 ${isOn ? 'bg-rose-100' : 'bg-gray-100'}`}>
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">{label}</Text>
        <Text className={`text-sm font-bold mt-0.5 ${isOn ? 'text-rose-500' : 'text-gray-400'}`}>
          {isOn ? 'ON' : 'OFF'}
        </Text>
      </View>
      <View className={`w-2 h-2 rounded-full ${isOn ? 'bg-rose-400' : 'bg-gray-300'}`} />
    </View>
  );
}

// ─── Analog Sensor Bar ────────────────────────────────────────────────────────
function AnalogBar({ value }: { value: number }) {
  // Typical range 1600–1900 from the ESP32 ADC
  const MIN = 1500, MAX = 2000;
  const pct = Math.min(Math.max(((value - MIN) / (MAX - MIN)) * 100, 0), 100);
  const color = '#a855f7'; // purple for raw sensor

  return (
    <View className="mt-3">
      <View className="flex-row justify-between mb-1">
        <Text className="text-[10px] text-gray-400 font-medium">{MIN}</Text>
        <Text className="text-[10px] font-bold" style={{ color }}>{value ?? '—'}</Text>
        <Text className="text-[10px] text-gray-400 font-medium">{MAX}</Text>
      </View>
      <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 999 }} />
      </View>
    </View>
  );
}

// ─── Temperature bar ─────────────────────────────────────────────────────────
function TempBar({ temp }: { temp: number }) {
  const MIN = 35, MAX = 42;
  const pct = Math.min(Math.max(((temp - MIN) / (MAX - MIN)) * 100, 0), 100);
  const color = temp > 40 ? '#ef4444' : temp > 38 ? '#f97316' : '#22c55e';

  return (
    <View className="mt-3">
      <View className="flex-row justify-between mb-1">
        <Text className="text-[10px] text-gray-400 font-medium">{MIN}°C</Text>
        <Text className="text-[10px] font-bold" style={{ color }}>{temp?.toFixed(1)}°C</Text>
        <Text className="text-[10px] text-gray-400 font-medium">{MAX}°C</Text>
      </View>
      <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 999 }} />
      </View>
    </View>
  );
}

// ─── Disconnected State ───────────────────────────────────────────────────────
function DisconnectedState() {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <View className="w-24 h-24 rounded-full bg-gray-50 items-center justify-center mb-5">
        <Feather name="bluetooth-off" size={40} color="#d1d5db" />
      </View>
      <Text className="text-gray-700 font-bold text-xl mb-2">Not Connected</Text>
      <Text className="text-gray-400 text-sm text-center px-10 leading-5">
        Go to the Devices tab to connect to your HerComfort band.
      </Text>
    </View>
  );
}

// ─── Raw JSON Debug ───────────────────────────────────────────────────────────
function JsonDebugView({ data }: { data: any }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="bg-gray-900 rounded-3xl overflow-hidden mb-6">
      <TouchableOpacity onPress={() => setOpen(!open)} className="flex-row items-center justify-between p-4">
        <View className="flex-row items-center">
          <MaterialCommunityIcons name="code-json" size={18} color="#6ee7b7" />
          <Text className="text-green-300 font-bold ml-2 text-sm">Raw ESP32 JSON</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#6b7280" />
      </TouchableOpacity>
      {open && (
        <View className="px-4 pb-4 border-t border-gray-700">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text className="text-green-400 font-mono text-xs mt-3 leading-5">
              {JSON.stringify(data, null, 2)}
            </Text>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function LiveDashboardScreen() {
  const { liveData, connectedDevice, connectionStatus } = useBluetooth();
  const isConnected = connectionStatus === CONNECTION_STATUS.CONNECTED;

  const liveDot = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isConnected) return;
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(liveDot, { toValue: 0.2, duration: 800, useNativeDriver: true }),
        Animated.timing(liveDot, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [isConnected]);

  const data = liveData;

  // ── Status helpers ──────────────────────────────────────────────────────────
  const tempStatus = () => {
    if (!data) return { label: '—', color: '#9ca3af' };
    if (data.temp > 40) return { label: 'Elevated', color: '#ef4444' };
    if (data.temp > 38) return { label: 'Warm', color: '#f97316' };
    return { label: 'Normal', color: '#22c55e' };
  };

  const bpmStatus = () => {
    if (!data) return { label: '—', color: '#9ca3af' };
    if (data.bpm === 0) return { label: 'No Signal', color: '#9ca3af' };
    if (data.bpm > 100) return { label: 'High', color: '#ef4444' };
    if (data.bpm < 55) return { label: 'Low', color: '#3b82f6' };
    return { label: 'Normal', color: '#22c55e' };
  };

  const ts = tempStatus();
  const bs = bpmStatus();

  return (
    <SafeAreaView className="flex-1 bg-[#fffbfd]">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
        <View>
          <Text className="text-2xl font-black text-gray-800">Dashboard</Text>
          <Text className="text-gray-400 text-sm mt-0.5">{connectedDevice?.name || 'No device'}</Text>
        </View>
        <View className="flex-row items-center bg-white border border-gray-100 px-3 py-2 rounded-full" style={{ elevation: 2 }}>
          <Animated.View style={{ opacity: liveDot }} className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-gray-300'}`} />
          <Text className={`text-xs font-bold ${isConnected ? 'text-green-600' : 'text-gray-400'}`}>
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </Text>
        </View>
      </View>

      {!isConnected ? (
        <DisconnectedState />
      ) : (
        <ScrollView className="flex-1 px-5 pt-3" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

          {/* System Active Banner */}
          <View className={`flex-row items-center px-4 py-3 rounded-2xl mb-4 ${data?.system_active ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
            <View className={`w-2.5 h-2.5 rounded-full mr-2 ${data?.system_active ? 'bg-green-400' : 'bg-gray-300'}`} />
            <MaterialCommunityIcons
              name={data?.system_active ? 'check-circle' : 'pause-circle'}
              size={18}
              color={data?.system_active ? '#22c55e' : '#9ca3af'}
            />
            <Text className={`ml-2 font-bold text-sm ${data?.system_active ? 'text-green-700' : 'text-gray-500'}`}>
              {data?.system_active ? 'System Active — Therapy Running' : 'System Idle'}
            </Text>
          </View>

          {/* Beat Detected badge */}
          {data?.beat_detected && (
            <View className="flex-row items-center bg-rose-50 border border-rose-200 px-4 py-3 rounded-2xl mb-4">
              <Ionicons name="heart" size={18} color="#f43f5e" />
              <Text className="text-rose-600 font-bold text-sm ml-2">Heartbeat Detected</Text>
            </View>
          )}

          {/* Vitals Row — Temp & BPM */}
          <View className="flex-row gap-3 mb-4">
            <VitalCard
              label="Temperature"
              value={data?.temp?.toFixed(1) ?? '—'}
              unit="°C"
              subLabel={ts.label}
              subColor={ts.color}
              iconColor="#f43f5e"
              bg="#fff0f4"
              icon={<Ionicons name="thermometer" size={22} color="#f43f5e" />}
            />
            <VitalCard
              label="Heart Rate"
              value={data?.bpm ?? '—'}
              unit="BPM"
              subLabel={bs.label}
              subColor={bs.color}
              iconColor="#ec4899"
              bg="#fdf2f8"
              isPulsing={isConnected && !!data?.beat_detected}
              icon={<Ionicons name="heart" size={22} color="#ec4899" />}
            />
          </View>

          {/* Temperature Range Bar */}
          <View className="bg-white rounded-3xl p-5 mb-4 border border-pink-50" style={{ elevation: 2 }}>
            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Temperature Range</Text>
            <TempBar temp={data?.temp ?? 36.5} />
          </View>

          {/* Raw Analog Sensor */}
          <View className="bg-white rounded-3xl p-5 mb-4 border border-purple-50" style={{ elevation: 2 }}>
            <View className="flex-row items-center mb-1">
              <MaterialCommunityIcons name="waveform" size={16} color="#a855f7" />
              <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider ml-2">Raw Sensor (ADC)</Text>
            </View>
            <AnalogBar value={data?.raw_analog ?? 0} />
          </View>

          {/* Motor + LED Status Chips */}
          <View className="flex-row gap-3 mb-4">
            <StatusChip
              label="Motor"
              isOn={data?.motor ?? false}
              icon={<MaterialCommunityIcons name="vibrate" size={18} color={data?.motor ? '#f43f5e' : '#9ca3af'} />}
            />
            <StatusChip
              label="LED"
              isOn={data?.led ?? false}
              icon={<Ionicons name="bulb" size={18} color={data?.led ? '#f43f5e' : '#9ca3af'} />}
            />
          </View>

          {/* Raw JSON Debug */}
          {data && <JsonDebugView data={data} />}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
