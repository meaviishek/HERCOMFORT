/**
 * Device Scanner Screen — chat.tsx (repurposed tab)
 *
 * Displays paired + discovered Bluetooth devices with signal strength,
 * connection state, pull-to-refresh scanning, and one-tap connect.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  useBluetooth,
  CONNECTION_STATUS,
} from '../../context/BluetoothContext';

// ─── RSSI → bars helper (1-4) ─────────────────────────────────────────────────
function rssiToBars(rssi) {
  if (!rssi) return 0;
  if (rssi >= -60) return 4;
  if (rssi >= -70) return 3;
  if (rssi >= -80) return 2;
  return 1;
}

function rssiLabel(rssi) {
  if (!rssi) return 'Unknown';
  const bars = rssiToBars(rssi);
  return ['', 'Weak', 'Fair', 'Good', 'Excellent'][bars];
}

// ─── Signal Bars Component ────────────────────────────────────────────────────
function SignalBars({ rssi, color = '#f43f5e' }) {
  const bars = rssiToBars(rssi);
  const heights = [6, 10, 14, 18];
  return (
    <View className="flex-row items-end gap-[2px]">
      {heights.map((h, i) => (
        <View
          key={i}
          style={{
            width: 4,
            height: h,
            borderRadius: 2,
            backgroundColor: i < bars ? color : '#e5e7eb',
          }}
        />
      ))}
    </View>
  );
}

// ─── Device Row ───────────────────────────────────────────────────────────────
function DeviceRow({ device, isPaired, isConnected, isConnecting, onPress }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  const isESP32 =
    (device.name || '').toLowerCase().includes('painreliefband') ||
    (device.name || '').toLowerCase().includes('hc-05') ||
    (device.name || '').toLowerCase().includes('hc-06') ||
    (device.name || '').toLowerCase().includes('esp32');

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => onPress(device)}
        disabled={isConnected || isConnecting}
        className={`bg-white rounded-2xl p-4 mb-3 border ${
          isConnected
            ? 'border-green-200 bg-green-50'
            : isESP32
            ? 'border-pink-200'
            : 'border-gray-100'
        }`}
        style={{ elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}
      >
        <View className="flex-row items-center">
          {/* Device icon */}
          <View
            className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${
              isConnected ? 'bg-green-100' : isESP32 ? 'bg-pink-50' : 'bg-gray-50'
            }`}
          >
            {isESP32 ? (
              <MaterialCommunityIcons
                name="chip"
                size={24}
                color={isConnected ? '#16a34a' : '#f43f5e'}
              />
            ) : (
              <Feather
                name="bluetooth"
                size={22}
                color={isConnected ? '#16a34a' : '#9ca3af'}
              />
            )}
          </View>

          {/* Name + address */}
          <View className="flex-1">
            <View className="flex-row items-center flex-wrap gap-2">
              <Text
                className="text-gray-800 font-bold text-base"
                numberOfLines={1}
              >
                {device.name || 'Unknown Device'}
              </Text>
              {isPaired && (
                <View className="bg-blue-50 px-2 py-0.5 rounded-full">
                  <Text className="text-blue-600 text-[10px] font-bold">PAIRED</Text>
                </View>
              )}
              {isESP32 && !isConnected && (
                <View className="bg-pink-50 px-2 py-0.5 rounded-full">
                  <Text className="text-pink-600 text-[10px] font-bold">ESP32</Text>
                </View>
              )}
              {isConnected && (
                <View className="bg-green-50 px-2 py-0.5 rounded-full flex-row items-center">
                  <View className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1" />
                  <Text className="text-green-600 text-[10px] font-bold">CONNECTED</Text>
                </View>
              )}
            </View>
            <Text className="text-gray-400 text-xs mt-1">{device.address}</Text>
            {device.rssi && (
              <Text className="text-gray-400 text-[10px] mt-0.5">
                Signal: {rssiLabel(device.rssi)} ({device.rssi} dBm)
              </Text>
            )}
          </View>

          {/* Right side: signal + action */}
          <View className="items-end ml-3 gap-2">
            {device.rssi !== undefined && (
              <SignalBars rssi={device.rssi} color={isConnected ? '#16a34a' : '#f43f5e'} />
            )}

            {isConnecting ? (
              <ActivityIndicator size="small" color="#f43f5e" />
            ) : isConnected ? (
              <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
            ) : (
              <View
                className={`px-3 py-1.5 rounded-full ${
                  isESP32 ? 'bg-[#f43f5e]' : 'bg-gray-100'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${isESP32 ? 'text-white' : 'text-gray-500'}`}
                >
                  Connect
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Toast Banner ─────────────────────────────────────────────────────────────
function ToastBanner({ toast }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return;
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [toast?.id]);

  if (!toast) return null;

  const colors = {
    success: { bg: '#f0fdf4', border: '#86efac', text: '#16a34a', icon: 'checkmark-circle' },
    error: { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626', icon: 'alert-circle' },
    info: { bg: '#eff6ff', border: '#93c5fd', text: '#2563eb', icon: 'information-circle' },
  };
  const c = colors[toast.type] || colors.info;

  return (
    <Animated.View
      style={{ opacity }}
      className={`mx-5 mb-3 p-3 rounded-xl border flex-row items-center`}
      style={{ backgroundColor: c.bg, borderColor: c.border, opacity }}
    >
      <Ionicons name={c.icon} size={18} color={c.text} />
      <Text style={{ color: c.text }} className="ml-2 text-sm font-medium flex-1">
        {toast.message}
      </Text>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DeviceScannerScreen() {
  const {
    pairedDevices,
    discoveredDevices,
    connectedDevice,
    connectionStatus,
    isScanning,
    toast,
    scan,
    connect,
    disconnect,
  } = useBluetooth();

  const isConnecting = connectionStatus === CONNECTION_STATUS.CONNECTING;

  // Merge paired + discovered into one unified list for display
  const pairedAddresses = new Set(pairedDevices.map((d) => d.address));
  const allDevices = [
    ...pairedDevices,
    ...discoveredDevices.filter((d) => !pairedAddresses.has(d.address)),
  ];

  const handleDevicePress = useCallback(
    (device) => {
      if (connectedDevice?.address === device.address) return;
      connect(device);
    },
    [connectedDevice, connect]
  );

  const renderDevice = ({ item }) => (
    <DeviceRow
      device={item}
      isPaired={pairedAddresses.has(item.address)}
      isConnected={connectedDevice?.address === item.address}
      isConnecting={isConnecting && connectionStatus === CONNECTION_STATUS.CONNECTING}
      onPress={handleDevicePress}
    />
  );

  const renderEmpty = () => (
    <View className="items-center justify-center py-16">
      <View className="w-20 h-20 rounded-full bg-pink-50 items-center justify-center mb-4">
        <Feather name="bluetooth" size={36} color="#f43f5e" />
      </View>
      <Text className="text-gray-700 font-bold text-lg mb-1">No devices found</Text>
      <Text className="text-gray-400 text-sm text-center px-8">
        Pull down to scan, or tap the scan button to discover nearby Bluetooth devices.
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#fffbfd]">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-4 pb-3">
        <View>
          <Text className="text-2xl font-black text-gray-800">Devices</Text>
          <Text className="text-gray-400 text-sm mt-0.5">
            {isScanning
              ? 'Scanning…'
              : `${allDevices.length} device${allDevices.length !== 1 ? 's' : ''} found`}
          </Text>
        </View>

        {/* Scan button */}
        <TouchableOpacity
          onPress={scan}
          disabled={isScanning}
          className={`flex-row items-center px-4 py-2.5 rounded-full ${
            isScanning ? 'bg-gray-100' : 'bg-[#f43f5e]'
          }`}
          style={{ elevation: isScanning ? 0 : 4, shadowColor: '#f43f5e', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}
        >
          {isScanning ? (
            <ActivityIndicator size="small" color="#9ca3af" />
          ) : (
            <Ionicons name="radio" size={16} color="white" />
          )}
          <Text
            className={`ml-2 font-bold text-sm ${isScanning ? 'text-gray-400' : 'text-white'}`}
          >
            {isScanning ? 'Scanning' : 'Scan'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Toast */}
      <ToastBanner toast={toast} />

      {/* Connected device banner */}
      {connectedDevice && (
        <View className="mx-5 mb-3 p-4 bg-green-50 border border-green-200 rounded-2xl flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center mr-3">
            <MaterialCommunityIcons name="chip" size={20} color="#16a34a" />
          </View>
          <View className="flex-1">
            <Text className="text-green-800 font-bold">
              {connectedDevice.name || connectedDevice.address}
            </Text>
            <View className="flex-row items-center mt-0.5">
              <View className="w-2 h-2 rounded-full bg-green-500 mr-1.5" />
              <Text className="text-green-600 text-xs font-medium">Connected · Live data active</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={disconnect}
            className="bg-white border border-green-200 px-3 py-1.5 rounded-full"
          >
            <Text className="text-green-700 text-xs font-bold">Disconnect</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Device List */}
      {isScanning && allDevices.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f43f5e" />
          <Text className="text-gray-400 mt-4 text-sm font-medium">
            Discovering Bluetooth devices…
          </Text>
        </View>
      ) : (
        <FlatList
          data={allDevices}
          keyExtractor={(item) => item.address}
          renderItem={renderDevice}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isScanning}
              onRefresh={scan}
              tintColor="#f43f5e"
              colors={['#f43f5e']}
            />
          }
          ListHeaderComponent={
            allDevices.length > 0 ? (
              <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3 mt-2">
                {pairedDevices.length > 0
                  ? `Paired (${pairedDevices.length}) + Nearby`
                  : 'Nearby Devices'}
              </Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
