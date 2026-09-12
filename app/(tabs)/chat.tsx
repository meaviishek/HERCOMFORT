/**
 * Device Scanner Screen — chat.tsx
 * Comprehensive Bluetooth & BLE manager for "Her Comfort" ESP32 band
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
  ListRenderItemInfo,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BluetoothDevice } from 'react-native-bluetooth-classic';
import { useBluetooth, CONNECTION_STATUS, ToastMessage } from '../../context/BluetoothContext';
import { T } from '../../constants/theme';

// ─── RSSI helpers ─────────────────────────────────────────────────────────────
function rssiToBars(rssi: number | undefined): number {
  if (!rssi) return 0;
  if (rssi >= -60) return 4;
  if (rssi >= -70) return 3;
  if (rssi >= -80) return 2;
  return 1;
}

function rssiLabel(rssi: number | undefined): string {
  if (!rssi) return 'Unknown';
  return ['', 'Weak', 'Fair', 'Good', 'Excellent'][rssiToBars(rssi)];
}

// ─── Signal Bars ──────────────────────────────────────────────────────────────
function SignalBars({ rssi, color = '#f43f5e' }: { rssi: number | undefined; color?: string }) {
  const bars = rssiToBars(rssi);
  const heights = [6, 10, 14, 18];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {heights.map((h, i) => (
        <View
          key={i}
          style={{ width: 4, height: h, borderRadius: 2, backgroundColor: i < bars ? color : '#e5e7eb' }}
        />
      ))}
    </View>
  );
}

// ─── Device Row ───────────────────────────────────────────────────────────────
interface DeviceRowProps {
  device: BluetoothDevice & { rssi?: number };
  isPaired: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  onPress: (device: BluetoothDevice) => void;
}

function DeviceRow({ device, isPaired, isConnected, isConnecting, onPress }: DeviceRowProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();

  const name = device.name ?? '';
  const isHerComfort =
    name.toLowerCase().includes('her comfort') ||
    name.toLowerCase().includes('hercomfort') ||
    name.toLowerCase().includes('painreliefband') ||
    name.toLowerCase().includes('esp32');

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => onPress(device)}
        disabled={isConnected || isConnecting}
        style={[
          s.deviceRow,
          isConnected
            ? s.deviceRowConnected
            : isHerComfort
            ? s.deviceRowHerComfort
            : s.deviceRowNormal,
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={[
              s.deviceIconBox,
              isConnected
                ? { backgroundColor: '#dcfce7' }
                : isHerComfort
                ? { backgroundColor: '#fdf2f8' }
                : { backgroundColor: '#f3f4f6' },
            ]}
          >
            {isHerComfort ? (
              <MaterialCommunityIcons
                name="chip"
                size={24}
                color={isConnected ? '#16a34a' : T.pink.primary}
              />
            ) : (
              <Feather name="bluetooth" size={22} color={isConnected ? '#16a34a' : '#9ca3af'} />
            )}
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <Text style={s.deviceName} numberOfLines={1}>
                {device.name || 'Unknown Device'}
              </Text>
              {isHerComfort && (
                <View style={s.badgePink}>
                  <Text style={s.badgePinkTxt}>HER COMFORT</Text>
                </View>
              )}
              {isPaired && (
                <View style={s.badgeBlue}>
                  <Text style={s.badgeBlueTxt}>PAIRED</Text>
                </View>
              )}
              {isConnected && (
                <View style={s.badgeGreen}>
                  <View style={s.dotGreen} />
                  <Text style={s.badgeGreenTxt}>CONNECTED</Text>
                </View>
              )}
            </View>
            <Text style={s.deviceAddr}>{device.address}</Text>
            {device.rssi != null && (
              <Text style={s.deviceRssi}>
                Signal: {rssiLabel(device.rssi)} ({device.rssi} dBm)
              </Text>
            )}
          </View>

          <View style={{ alignItems: 'flex-end', marginLeft: 10, gap: 6 }}>
            {device.rssi !== undefined && (
              <SignalBars rssi={device.rssi} color={isConnected ? '#16a34a' : T.pink.primary} />
            )}
            {isConnecting ? (
              <ActivityIndicator size="small" color={T.pink.primary} />
            ) : isConnected ? (
              <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
            ) : (
              <View style={[s.btnConnect, { backgroundColor: isHerComfort ? T.pink.primary : '#f3f4f6' }]}>
                <Text style={[s.btnConnectTxt, { color: isHerComfort ? '#fff' : '#6b7280' }]}>
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
const TOAST_COLORS = {
  success: { bg: '#f0fdf4', border: '#86efac', text: '#16a34a', icon: 'checkmark-circle' },
  error:   { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626', icon: 'alert-circle' },
  info:    { bg: '#eff6ff', border: '#93c5fd', text: '#2563eb', icon: 'information-circle' },
} as const;

function ToastBanner({ toast }: { toast: ToastMessage | null }) {
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
  const c = TOAST_COLORS[toast.type] ?? TOAST_COLORS.info;

  return (
    <Animated.View
      style={{
        opacity,
        backgroundColor: c.bg,
        borderColor: c.border,
        marginHorizontal: 20,
        marginBottom: 12,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Ionicons name={c.icon as any} size={18} color={c.text} />
      <Text style={{ color: c.text, marginLeft: 8, fontSize: 13, fontWeight: '600', flex: 1 }}>
        {toast.message}
      </Text>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DeviceScannerScreen() {
  const router = useRouter();
  const {
    pairedDevices,
    discoveredDevices,
    connectedDevice,
    connectionStatus,
    isScanning,
    liveData,
    packetCount,
    toast,
    scan,
    connect,
    disconnect,
  } = useBluetooth();

  const isConnected = connectionStatus === CONNECTION_STATUS.CONNECTED;
  const isConnecting = connectionStatus === CONNECTION_STATUS.CONNECTING;

  const pairedAddresses = new Set(pairedDevices.map((d) => d.address));
  const allDevices = [
    ...pairedDevices,
    ...discoveredDevices.filter((d) => !pairedAddresses.has(d.address)),
  ] as (BluetoothDevice & { rssi?: number })[];

  const handleDevicePress = useCallback(
    (device: BluetoothDevice) => {
      if (connectedDevice?.address === device.address) return;
      connect(device);
    },
    [connectedDevice, connect]
  );

  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isConnected) return;
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.25, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 700, useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [isConnected]);

  const renderDevice = ({ item }: ListRenderItemInfo<BluetoothDevice & { rssi?: number }>) => (
    <DeviceRow
      device={item}
      isPaired={pairedAddresses.has(item.address)}
      isConnected={connectedDevice?.address === item.address}
      isConnecting={isConnecting}
      onPress={handleDevicePress}
    />
  );

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Bluetooth Devices</Text>
          <Text style={s.subTitle}>
            {isConnected
              ? 'Her Comfort Band active & streaming'
              : isScanning
              ? 'Scanning for devices…'
              : `${allDevices.length} device${allDevices.length !== 1 ? 's' : ''} available`}
          </Text>
        </View>
        <TouchableOpacity
          onPress={scan}
          disabled={isScanning}
          style={[s.scanBtn, { backgroundColor: isScanning ? '#f3f4f6' : T.pink.primary }]}
          activeOpacity={0.85}
        >
          {isScanning ? (
            <ActivityIndicator size="small" color="#9ca3af" />
          ) : (
            <Ionicons name="radio" size={16} color="white" />
          )}
          <Text style={[s.scanBtnTxt, { color: isScanning ? '#9ca3af' : '#fff' }]}>
            {isScanning ? 'Scanning' : 'Scan'}
          </Text>
        </TouchableOpacity>
      </View>

      <ToastBanner toast={toast} />

      <FlatList
        data={allDevices}
        keyExtractor={(item) => item.address}
        renderItem={renderDevice}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isScanning} onRefresh={scan} tintColor={T.pink.primary} colors={[T.pink.primary]} />
        }
        ListHeaderComponent={
          <>
            {/* ─── Hero "Her Comfort" Band Card ─── */}
            <View style={[s.heroCard, isConnected ? s.heroCardConnected : s.heroCardIdle]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={[s.heroIcon, isConnected ? { backgroundColor: '#dcfce7' } : { backgroundColor: '#fdf2f8' }]}>
                  <MaterialCommunityIcons
                    name="watch-vibrate"
                    size={28}
                    color={isConnected ? '#16a34a' : T.pink.primary}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={s.heroTitle}>Her Comfort Smart Band</Text>
                  <Text style={s.heroSub}>
                    {isConnected
                      ? `${connectedDevice?.name || 'ESP32 Device'} (Connected)`
                      : isConnecting
                      ? 'Establishing GATT link…'
                      : 'ESP32 NimBLE / BT Therapy & Sensors'}
                  </Text>
                </View>
                {isConnected && (
                  <Animated.View
                    style={[
                      s.liveDot,
                      { transform: [{ scale: pulse }] },
                    ]}
                  />
                )}
              </View>

              {/* Status and telemetry preview when connected */}
              {isConnected && (
                <View style={s.telemetryBox}>
                  <View style={s.telemetryRow}>
                    <Text style={s.telemetryItem}>
                      🌡️ {Number(liveData?.temp ?? liveData?.temperature ?? 36.5).toFixed(1)}°C
                    </Text>
                    <Text style={s.telemetryDivider}>•</Text>
                    <Text style={s.telemetryItem}>
                      🔄 Gyro {liveData?.gx != null ? `${Number(liveData.gx) > 0 ? '+' : ''}${Number(liveData.gx).toFixed(1)}` : 'Active'}
                    </Text>
                    <Text style={s.telemetryDivider}>•</Text>
                    <Text style={s.telemetryItem}>
                      📦 {packetCount} packets
                    </Text>
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={s.heroBtnRow}>
                {isConnected ? (
                  <>
                    <TouchableOpacity
                      style={s.heroBtnPrimary}
                      onPress={() => router.push('/(tabs)/explore' as any)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="pulse" size={16} color="#fff" />
                      <Text style={s.heroBtnPrimaryTxt}>Open Live Dashboard</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.heroBtnSecondary}
                      onPress={disconnect}
                      activeOpacity={0.8}
                    >
                      <Text style={s.heroBtnSecondaryTxt}>Disconnect</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={s.heroBtnPrimary}
                    onPress={() => router.push('/ble-device' as any)}
                    activeOpacity={0.85}
                  >
                    <Feather name="bluetooth" size={16} color="#fff" />
                    <Text style={s.heroBtnPrimaryTxt}>Connect Her Comfort</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Section label */}
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>
                {allDevices.length > 0
                  ? `Nearby & Paired Devices (${allDevices.length})`
                  : isScanning
                  ? 'Searching for Bluetooth devices…'
                  : 'Available Devices'}
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          isScanning ? (
            <View style={s.emptyBox}>
              <ActivityIndicator size="large" color={T.pink.primary} />
              <Text style={s.emptyTitle}>Scanning for "Her Comfort"…</Text>
              <Text style={s.emptySub}>Make sure your ESP32 band is powered on</Text>
            </View>
          ) : (
            <View style={s.emptyBox}>
              <View style={s.emptyIconCircle}>
                <Feather name="bluetooth" size={32} color={T.pink.primary} />
              </View>
              <Text style={s.emptyTitle}>No Other Devices Found</Text>
              <Text style={s.emptySub}>
                Tap "⚡ Simulate Her Comfort" above for live testing, or tap "Scan" to find physical Bluetooth devices.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          <TouchableOpacity
            style={s.bleLinkCard}
            onPress={() => router.push('/ble-device' as any)}
            activeOpacity={0.85}
          >
            <View style={s.bleLinkIcon}>
              <Feather name="cpu" size={20} color={T.pink.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.bleLinkTitle}>Advanced ESP32 BLE Dashboard</Text>
              <Text style={s.bleLinkSub}>Direct GATT Service & Characteristic monitor</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#9ca3af" />
          </TouchableOpacity>
        }
      />
    </SafeAreaView>
  );
}

const s: Record<string, any> = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fffbfd' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  title: { fontSize: 24, fontWeight: '900', color: T.text.primary },
  subTitle: { fontSize: 13, color: T.text.muted, marginTop: 2, fontWeight: '500' },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
    elevation: 3,
    shadowColor: T.pink.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  scanBtnTxt: { fontSize: 13, fontWeight: '800' },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },

  // Hero Card
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1.5,
    elevation: 4,
    shadowColor: T.pink.primary,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  heroCardIdle: { borderColor: '#fce7f3' },
  heroCardConnected: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 18, fontWeight: '900', color: T.text.primary },
  heroSub: { fontSize: 12, color: T.text.muted, marginTop: 2, fontWeight: '500' },
  liveDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
  },
  telemetryBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  telemetryItem: { fontSize: 12, fontWeight: '700', color: '#16a34a' },
  telemetryDivider: { fontSize: 14, color: '#86efac' },
  heroBtnRow: { flexDirection: 'row', gap: 10 },
  heroBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.pink.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 8,
    elevation: 2,
    shadowColor: T.pink.primary,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  heroBtnPrimaryTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
  heroBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 6,
  },
  heroBtnSecondaryTxt: { color: '#4b5563', fontSize: 13, fontWeight: '700' },

  // Section Header
  sectionHeader: { marginBottom: 12, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Device Row
  deviceRow: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  deviceRowNormal: { borderColor: '#f3f4f6' },
  deviceRowHerComfort: { borderColor: '#fbcfe8', backgroundColor: '#fff5f8' },
  deviceRowConnected: { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' },
  deviceIconBox: {
    width: 48,
    height: 48,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  deviceName: { fontSize: 15, fontWeight: '800', color: T.text.primary },
  deviceAddr: { fontSize: 11, color: '#9ca3af', marginTop: 3 },
  deviceRssi: { fontSize: 10, color: '#16a34a', fontWeight: '600', marginTop: 2 },
  badgePink: { backgroundColor: '#fce7f3', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  badgePinkTxt: { color: T.pink.primary, fontSize: 9, fontWeight: '800' },
  badgeBlue: { backgroundColor: '#eff6ff', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  badgeBlueTxt: { color: '#2563eb', fontSize: 9, fontWeight: '800' },
  badgeGreen: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dotGreen: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16a34a' },
  badgeGreenTxt: { color: '#16a34a', fontSize: 9, fontWeight: '800' },
  btnConnect: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12 },
  btnConnectTxt: { fontSize: 12, fontWeight: '800' },

  // Empty Box
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fdf2f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: T.text.primary, marginBottom: 4 },
  emptySub: { fontSize: 13, color: T.text.muted, textAlign: 'center', lineHeight: 20 },

  // Bottom BLE Link
  bleLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#fce7f3',
    gap: 12,
  },
  bleLinkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fdf2f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bleLinkTitle: { fontSize: 14, fontWeight: '800', color: T.text.primary },
  bleLinkSub: { fontSize: 11, color: T.text.muted, marginTop: 1 },
});
