/**
 * Live Dashboard Screen — explore.tsx
 * Comprehensive Live Sensor Dashboard for "Her Comfort" ESP32 Band.
 *
 * Sensors:
 * - DS18B20 High-Precision Temperature Sensor
 * - MPU6500 3-Axis Gyroscope (gx, gy, gz)
 * - Heart Rate / BPM sensor
 * - Motor & Heater Actuators
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Polyline, Line } from 'react-native-svg';
import { useBluetooth, CONNECTION_STATUS } from '../../context/BluetoothContext';
import { T } from '../../constants/theme';

const { width } = Dimensions.get('window');
const GRAPH_W = width - 72;
const GRAPH_H = 100;
const MAX_GRAPH_PTS = 40;

// ─── Animated Pulse Ring ──────────────────────────────────────────────────────
function PulseRing({ active }: { active: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!active) return;
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.5, duration: 600, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(scale, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.1, duration: 600, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 600, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [active]);

  if (!active) return null;
  return (
    <Animated.View
      style={[
        s.pulseRing,
        { transform: [{ scale }], opacity },
      ]}
    />
  );
}

// ─── Polyline Mini Graph ──────────────────────────────────────────────────────
function LiveWaveGraph({
  data,
  color,
  label,
  unit,
  yMin,
  yMax,
}: {
  data: number[];
  color: string;
  label: string;
  unit: string;
  yMin: number;
  yMax: number;
}) {
  const pts = data.slice(-MAX_GRAPH_PTS);
  const range = yMax - yMin || 1;
  const toY = (v: number) =>
    Math.max(4, Math.min(GRAPH_H - 4, GRAPH_H - ((v - yMin) / range) * GRAPH_H));

  const points = pts
    .map((v, i) => `${((i / Math.max(pts.length - 1, 1)) * GRAPH_W).toFixed(1)},${toY(v).toFixed(1)}`)
    .join(' ');

  const currentVal = pts.length > 0 ? pts[pts.length - 1] : 0;

  return (
    <View style={s.graphCard}>
      <View style={s.graphHeader}>
        <View style={[s.graphDot, { backgroundColor: color }]} />
        <Text style={s.graphLabel}>{label}</Text>
        <Text style={[s.graphCurrent, { color }]}>
          {currentVal.toFixed(2)} {unit}
        </Text>
      </View>
      <View style={{ height: GRAPH_H, width: GRAPH_W, overflow: 'hidden' }}>
        <Svg width={GRAPH_W} height={GRAPH_H}>
          {/* Zero baseline if range spans negative */}
          {yMin < 0 && (
            <Line
              x1="0"
              y1={toY(0).toFixed(1)}
              x2={String(GRAPH_W)}
              y2={toY(0).toFixed(1)}
              stroke={color + '33'}
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          )}
          {pts.length > 1 && (
            <Polyline
              points={points}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
        </Svg>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function LiveDashboardScreen() {
  const router = useRouter();
  const {
    liveData,
    history,
    packetCount,
    connectedDevice,
    connectionStatus,
    isDemo,
    startDemo,
    stopDemo,
    disconnect,
    sendCommand,
  } = useBluetooth();

  const isConnected = connectionStatus === CONNECTION_STATUS.CONNECTED;

  // Dot animation
  const liveDot = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isConnected) return;
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(liveDot, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(liveDot, { toValue: 1.0, duration: 600, useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [isConnected]);

  // Extract sensor fields safely as numbers
  const tempVal: number = Number(liveData?.temp ?? liveData?.temperature ?? 36.6);
  const bpmVal: number = Number(liveData?.bpm ?? 72);
  const gxVal: number = Number(liveData?.gx ?? 0);
  const gyVal: number = Number(liveData?.gy ?? 0);
  const gzVal: number = Number(liveData?.gz ?? 0);
  const motorOn = Boolean(liveData?.motor);
  const heaterOn = Boolean(liveData?.heater);
  const beatDetected = Boolean(liveData?.beat_detected);

  // Derive posture / motion category from Gyroscope magnitude
  const gyroMag = Math.sqrt(gxVal * gxVal + gyVal * gyVal + gzVal * gzVal);
  const motionStatus =
    gyroMag < 0.5
      ? { text: 'Resting / Stable', color: '#16a34a', icon: 'shield-checkmark' }
      : gyroMag < 1.8
      ? { text: 'Gentle Motion', color: '#3b82f6', icon: 'walk' }
      : { text: 'Active Movement', color: '#f59e0b', icon: 'body' };

  // Temperature status category
  const tempStatus =
    tempVal > 38.0
      ? { text: 'Warm / Heat Therapy Active', color: '#ea580c', bg: '#fff7ed' }
      : tempVal < 36.0
      ? { text: 'Cool / Mild', color: '#0284c7', bg: '#f0f9ff' }
      : { text: 'Optimal Body Temp', color: '#16a34a', bg: '#f0fdf4' };

  // Graph data series from history
  const tempSeries: number[] = history.map((h) => Number(h.temp ?? h.temperature ?? 36.5));
  const gxSeries: number[] = history.map((h) => Number(h.gx ?? 0));
  const gySeries: number[] = history.map((h) => Number(h.gy ?? 0));

  // Toggle controls
  const handleToggleHeater = async () => {
    try {
      await sendCommand({ heater: !heaterOn });
    } catch {}
  };

  const handleToggleMotor = async () => {
    try {
      await sendCommand({ motor: !motorOn });
    } catch {}
  };

  return (
    <SafeAreaView style={s.root}>
      {/* ─── Top Header ─── */}
      <View style={s.topBar}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.headerTitle}>Her Comfort Live</Text>
            {isConnected && (
              <View style={s.livePill}>
                <Animated.View style={[s.liveIndicatorDot, { opacity: liveDot }]} />
                <Text style={s.livePillTxt}>LIVE</Text>
              </View>
            )}
          </View>
          <Text style={s.headerSub}>
            {connectedDevice
              ? `${connectedDevice.name || 'Her Comfort Band'} · ${packetCount} packets`
              : 'Sensor Telemetry & Relief Dashboard'}
          </Text>
        </View>

        {isConnected ? (
          <TouchableOpacity onPress={disconnect} style={s.btnHeaderSmall}>
            <Text style={s.btnHeaderSmallTxt}>Disconnect</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={isDemo ? stopDemo : startDemo}
            style={s.btnHeaderPrimary}
            activeOpacity={0.85}
          >
            <Ionicons name="flash" size={14} color="#fff" />
            <Text style={s.btnHeaderPrimaryTxt}>{isDemo ? 'Stop Demo' : '⚡ Simulate'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ─── Device Connection Status Hero Card ─── */}
        <View
          style={[
            s.deviceCard,
            isConnected ? s.deviceCardConnected : s.deviceCardDisconnected,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={[
                s.deviceIconCircle,
                { backgroundColor: isConnected ? '#dcfce7' : '#fdf2f8' },
              ]}
            >
              <MaterialCommunityIcons
                name="watch-vibrate"
                size={26}
                color={isConnected ? '#16a34a' : T.pink.primary}
              />
            </View>

            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={s.deviceCardTitle}>
                {connectedDevice?.name || 'Her Comfort ESP32 Band'}
              </Text>
              <Text style={s.deviceCardSub}>
                {isConnected
                  ? `Telemetry active · ${packetCount} packets rx`
                  : 'Device is offline. Connect or run simulator.'}
              </Text>
            </View>

            {!isConnected ? (
              <TouchableOpacity
                style={s.btnConnectHero}
                onPress={() => router.push('/(tabs)/chat' as any)}
                activeOpacity={0.85}
              >
                <Feather name="bluetooth" size={14} color="#fff" />
                <Text style={s.btnConnectHeroTxt}>Connect</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.connectedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                <Text style={s.connectedBadgeTxt}>Online</Text>
              </View>
            )}
          </View>

          {/* Quick Info bar */}
          <View style={s.deviceInfoRow}>
            <View style={s.infoPill}>
              <Text style={s.infoPillLbl}>PROTOCOL</Text>
              <Text style={s.infoPillVal}>ESP32 NimBLE / BT</Text>
            </View>
            <View style={s.infoPill}>
              <Text style={s.infoPillLbl}>MOTION</Text>
              <Text style={[s.infoPillVal, { color: motionStatus.color }]}>
                {motionStatus.text}
              </Text>
            </View>
            <View style={s.infoPill}>
              <Text style={s.infoPillLbl}>THERMAL</Text>
              <Text style={[s.infoPillVal, { color: tempStatus.color }]}>
                {tempVal.toFixed(1)}°C
              </Text>
            </View>
          </View>
        </View>

        {/* ─── 4 Primary Vital Stat Cards ─── */}
        <Text style={s.sectionHeader}>Live Sensors</Text>
        <View style={s.vitalsGrid}>
          {/* 1. DS18B20 Temperature */}
          <View style={s.vitalCard}>
            <View style={s.vitalIconBox}>
              <View style={[s.vitalIconCircle, { backgroundColor: '#fee2e2' }]}>
                <MaterialCommunityIcons name="thermometer" size={24} color="#ef4444" />
              </View>
              <View style={[s.statusBadge, { backgroundColor: tempStatus.bg }]}>
                <Text style={[s.statusBadgeTxt, { color: tempStatus.color }]}>
                  DS18B20
                </Text>
              </View>
            </View>
            <Text style={s.vitalLabel}>BODY TEMPERATURE</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
              <Text style={s.vitalValue}>{tempVal.toFixed(1)}</Text>
              <Text style={s.vitalUnit}>°C</Text>
            </View>
            <Text style={[s.vitalFootnote, { color: tempStatus.color }]}>
              {tempStatus.text}
            </Text>
          </View>

          {/* 2. MPU6500 Gyroscope */}
          <View style={s.vitalCard}>
            <View style={s.vitalIconBox}>
              <View style={[s.vitalIconCircle, { backgroundColor: '#fce7f3' }]}>
                <MaterialCommunityIcons name="axis-arrow" size={24} color={T.pink.primary} />
              </View>
              <View style={[s.statusBadge, { backgroundColor: '#fdf2f8' }]}>
                <Text style={[s.statusBadgeTxt, { color: T.pink.primary }]}>
                  MPU6500
                </Text>
              </View>
            </View>
            <Text style={s.vitalLabel}>GYROSCOPE (X / Y / Z)</Text>
            <View style={{ marginTop: 4 }}>
              <Text style={s.gyroCoord}>
                X: <Text style={s.gyroVal}>{gxVal.toFixed(2)}</Text>  Y: <Text style={s.gyroVal}>{gyVal.toFixed(2)}</Text>
              </Text>
              <Text style={s.gyroCoord}>
                Z: <Text style={s.gyroVal}>{gzVal.toFixed(2)}</Text> °/s
              </Text>
            </View>
            <Text style={[s.vitalFootnote, { color: motionStatus.color }]}>
              {motionStatus.text}
            </Text>
          </View>

          {/* 3. Heart Rate / Pulse */}
          <View style={s.vitalCard}>
            <View style={s.vitalIconBox}>
              <View style={{ position: 'relative', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <PulseRing active={beatDetected || isConnected} />
                <View style={[s.vitalIconCircle, { backgroundColor: '#fdf2f8' }]}>
                  <Ionicons name="heart" size={22} color={T.pink.primary} />
                </View>
              </View>
              <View style={[s.statusBadge, { backgroundColor: '#fdf2f8' }]}>
                <Text style={[s.statusBadgeTxt, { color: T.pink.primary }]}>
                  PULSE
                </Text>
              </View>
            </View>
            <Text style={s.vitalLabel}>HEART RATE</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
              <Text style={s.vitalValue}>{bpmVal}</Text>
              <Text style={s.vitalUnit}>BPM</Text>
            </View>
            <Text style={[s.vitalFootnote, { color: '#16a34a' }]}>
              {bpmVal < 60 ? 'Resting' : bpmVal > 100 ? 'Elevated' : 'Optimal Rhythm'}
            </Text>
          </View>

          {/* 4. Actuator / Relief Therapy State */}
          <View style={s.vitalCard}>
            <View style={s.vitalIconBox}>
              <View style={[s.vitalIconCircle, { backgroundColor: heaterOn ? '#fff7ed' : '#f3f4f6' }]}>
                <MaterialCommunityIcons
                  name="radiator"
                  size={24}
                  color={heaterOn ? '#ea580c' : '#9ca3af'}
                />
              </View>
              <View style={[s.statusBadge, { backgroundColor: heaterOn ? '#ffedd5' : '#f3f4f6' }]}>
                <Text style={[s.statusBadgeTxt, { color: heaterOn ? '#c2410c' : '#6b7280' }]}>
                  {heaterOn ? 'HEATING' : 'STANDBY'}
                </Text>
              </View>
            </View>
            <Text style={s.vitalLabel}>RELIEF THERAPY</Text>
            <View style={{ marginTop: 6, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[s.actuatorDot, { backgroundColor: heaterOn ? '#ea580c' : '#d1d5db' }]} />
                <Text style={s.actuatorTxt}>Heat: {heaterOn ? 'ACTIVE' : 'OFF'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[s.actuatorDot, { backgroundColor: motorOn ? T.pink.primary : '#d1d5db' }]} />
                <Text style={s.actuatorTxt}>Vibration: {motorOn ? 'ON' : 'OFF'}</Text>
              </View>
            </View>
            <Text style={[s.vitalFootnote, { color: T.pink.primary }]}>
              {heaterOn || motorOn ? 'Therapy Running' : 'Ready for Treatment'}
            </Text>
          </View>
        </View>

        {/* ─── Relief Actuator Quick Control Buttons ─── */}
        <Text style={s.sectionHeader}>Instant Relief Controls</Text>
        <View style={s.controlsRow}>
          {/* Heat Toggle Button */}
          <TouchableOpacity
            style={[s.controlBtn, heaterOn && s.controlBtnActiveHeat]}
            onPress={handleToggleHeater}
            activeOpacity={0.85}
          >
            <View style={[s.controlBtnIcon, { backgroundColor: heaterOn ? '#ffedd5' : '#f3f4f6' }]}>
              <MaterialCommunityIcons
                name="fire"
                size={22}
                color={heaterOn ? '#ea580c' : '#9ca3af'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.controlBtnTitle}>Heat Therapy</Text>
              <Text style={s.controlBtnSub}>
                {heaterOn ? 'Soothing warmth ON' : 'Tap to start warming'}
              </Text>
            </View>
            <View style={[s.switchPill, heaterOn && { backgroundColor: '#ea580c' }]}>
              <Text style={[s.switchPillTxt, heaterOn && { color: '#fff' }]}>
                {heaterOn ? 'ON' : 'OFF'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Motor / Vibration Toggle Button */}
          <TouchableOpacity
            style={[s.controlBtn, motorOn && s.controlBtnActiveMotor]}
            onPress={handleToggleMotor}
            activeOpacity={0.85}
          >
            <View style={[s.controlBtnIcon, { backgroundColor: motorOn ? '#fdf2f8' : '#f3f4f6' }]}>
              <MaterialCommunityIcons
                name="vibrate"
                size={22}
                color={motorOn ? T.pink.primary : '#9ca3af'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.controlBtnTitle}>Vibration Relief</Text>
              <Text style={s.controlBtnSub}>
                {motorOn ? 'Micro-pulse massage ON' : 'Tap to activate vibration'}
              </Text>
            </View>
            <View style={[s.switchPill, motorOn && { backgroundColor: T.pink.primary }]}>
              <Text style={[s.switchPillTxt, motorOn && { color: '#fff' }]}>
                {motorOn ? 'ON' : 'OFF'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ─── Real-Time Dynamic Trend Charts ─── */}
        <Text style={s.sectionHeader}>Real-Time Sensor Telemetry Waves</Text>

        {/* Temperature Trend Line */}
        <LiveWaveGraph
          data={tempSeries.length > 0 ? tempSeries : [36.5, 36.6, 36.7, 36.65]}
          color="#ef4444"
          label="DS18B20 Body Temperature"
          unit="°C"
          yMin={35.0}
          yMax={39.0}
        />

        {/* Gyroscope X Wave */}
        <LiveWaveGraph
          data={gxSeries.length > 0 ? gxSeries : [0.1, -0.2, 0.4, 0.1, -0.1]}
          color={T.pink.primary}
          label="MPU6500 Gyro X Wave"
          unit="°/s"
          yMin={-3.0}
          yMax={3.0}
        />

        {/* Gyroscope Y Wave */}
        <LiveWaveGraph
          data={gySeries.length > 0 ? gySeries : [-0.1, 0.3, -0.3, 0.2]}
          color="#6366f1"
          label="MPU6500 Gyro Y Wave"
          unit="°/s"
          yMin={-3.0}
          yMax={3.0}
        />

        {/* ─── Raw ESP32 JSON Telemetry Inspector ─── */}
        <Text style={s.sectionHeader}>ESP32 Raw Packet Inspector</Text>
        <View style={s.rawCard}>
          <View style={s.rawHeader}>
            <View style={s.rawDot} />
            <Text style={s.rawTitle}>LIVE TELEMETRY PAYLOAD</Text>
            <Text style={s.rawCount}>{packetCount} packets rx</Text>
          </View>
          <Text style={s.rawJson} selectable>
            {JSON.stringify(
              liveData || {
                temperature: tempVal,
                gx: gxVal,
                gy: gyVal,
                gz: gzVal,
                bpm: bpmVal,
                heater: heaterOn,
                motor: motorOn,
                status: isConnected ? 'online' : 'demo_ready',
              },
              null,
              2
            )}
          </Text>
        </View>

        {/* ─── Bottom Device Tuning Link ─── */}
        <TouchableOpacity
          style={s.bottomLinkCard}
          onPress={() => router.push('/(tabs)/favorite' as any)}
          activeOpacity={0.85}
        >
          <View style={s.bottomLinkIcon}>
            <MaterialCommunityIcons name="tune-vertical" size={22} color={T.pink.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.bottomLinkTitle}>Manual Wave & Intensity Tuning</Text>
            <Text style={s.bottomLinkSub}>Adjust frequency, auto-mode, and temperature thresholds</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s: Record<string, any> = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fffbfd' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: '900', color: T.text.primary },
  headerSub: { fontSize: 13, color: T.text.muted, marginTop: 2, fontWeight: '500' },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  liveIndicatorDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16a34a' },
  livePillTxt: { color: '#16a34a', fontSize: 10, fontWeight: '800' },
  btnHeaderPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.pink.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    gap: 6,
  },
  btnHeaderPrimaryTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  btnHeaderSmall: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  btnHeaderSmallTxt: { color: '#ef4444', fontSize: 12, fontWeight: '700' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 110 },

  // Device Hero Card
  deviceCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1.5,
    elevation: 3,
    shadowColor: T.pink.primary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
  },
  deviceCardConnected: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  deviceCardDisconnected: { borderColor: '#fce7f3' },
  deviceIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceCardTitle: { fontSize: 17, fontWeight: '900', color: T.text.primary },
  deviceCardSub: { fontSize: 12, color: T.text.muted, marginTop: 2, fontWeight: '500' },
  btnConnectHero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.pink.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 6,
  },
  btnConnectHeroTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  connectedBadgeTxt: { color: '#16a34a', fontSize: 11, fontWeight: '800' },
  deviceInfoRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    justifyContent: 'space-around',
  },
  infoPill: { alignItems: 'center' },
  infoPillLbl: { fontSize: 9, fontWeight: '800', color: '#9ca3af', letterSpacing: 0.5 },
  infoPillVal: { fontSize: 12, fontWeight: '800', color: T.text.primary, marginTop: 2 },

  // Section Header
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 6,
  },

  // Vitals Grid
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  vitalCard: {
    width: (width - 52) / 2,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fce7f3',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  vitalIconBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  vitalIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  statusBadgeTxt: { fontSize: 9, fontWeight: '800' },
  vitalLabel: { fontSize: 10, fontWeight: '800', color: '#9ca3af', letterSpacing: 0.4 },
  vitalValue: { fontSize: 26, fontWeight: '900', color: T.text.primary },
  vitalUnit: { fontSize: 13, fontWeight: '700', color: T.text.muted, marginLeft: 3 },
  vitalFootnote: { fontSize: 10, fontWeight: '700', marginTop: 6 },
  gyroCoord: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  gyroVal: { fontWeight: '900', color: T.text.primary },
  actuatorDot: { width: 7, height: 7, borderRadius: 3.5 },
  actuatorTxt: { fontSize: 12, fontWeight: '700', color: T.text.primary },
  pulseRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fca5a5',
  },

  // Controls Row
  controlsRow: { flexDirection: 'column', gap: 10, marginBottom: 22 },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#f3f4f6',
    gap: 12,
  },
  controlBtnActiveHeat: { borderColor: '#fb923c', backgroundColor: '#fff7ed' },
  controlBtnActiveMotor: { borderColor: '#f472b6', backgroundColor: '#fdf2f8' },
  controlBtnIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  controlBtnTitle: { fontSize: 15, fontWeight: '800', color: T.text.primary },
  controlBtnSub: { fontSize: 12, color: T.text.muted, marginTop: 1 },
  switchPill: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  switchPillTxt: { fontSize: 11, fontWeight: '800', color: '#4b5563' },

  // Trend Graphs
  graphCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fce7f3',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  graphHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  graphDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  graphLabel: { flex: 1, fontSize: 13, fontWeight: '800', color: T.text.primary },
  graphCurrent: { fontSize: 15, fontWeight: '900' },

  // Raw Inspector
  rawCard: {
    backgroundColor: '#0f172a',
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
  },
  rawHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  rawDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  rawTitle: { flex: 1, fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.6 },
  rawCount: { fontSize: 11, fontWeight: '700', color: '#22c55e' },
  rawJson: { fontFamily: 'monospace', fontSize: 12, color: '#6ee7b7', lineHeight: 18 },

  // Bottom Link
  bottomLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fce7f3',
    gap: 12,
    marginBottom: 10,
  },
  bottomLinkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fdf2f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomLinkTitle: { fontSize: 14, fontWeight: '800', color: T.text.primary },
  bottomLinkSub: { fontSize: 11, color: T.text.muted, marginTop: 1 },
});
