/**
 * session.tsx  –  Nari App Session Tab
 *
 * Two views:
 *   1. Prepare Session  – pain assessment + therapy config → START SESSION
 *   2. Active Session   – real-time timer + heating therapy + vibration + EMG
 *
 * After ending, saves a SessionRecord via sessionService and returns to prepare view.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import Svg, { Path, Circle, Polyline, Line } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useBluetooth, CONNECTION_STATUS } from '../../context/BluetoothContext';
import { T, palette } from '../../constants/theme';
import sessionService from '../../services/sessionService';

const { width } = Dimensions.get('window');

// ─── Design Constants ─────────────────────────────────────────────────────────
const PURPLE = '#E84EA1';       // Nari signature pink
const PURPLE_LIGHT = '#FCE7F3'; // Pink-100 soft blush
const PURPLE_MID = '#F472B6';   // Pink-400
const SCREEN_BG = '#FFF5FA';    // Soft pink screen background
const CARD_BG = '#FFFFFF';

// ─── Pain locations ───────────────────────────────────────────────────────────
const PAIN_LOCATIONS = ['Lower abdomen', 'Lower back', 'Pelvic area', 'Other'];

// ─── Symptom chips ────────────────────────────────────────────────────────────
const SYMPTOMS = [
  { key: 'cramping', label: 'Cramping' },
  { key: 'fatigue', label: 'Fatigue' },
  { key: 'bloating', label: 'Bloating' },
  { key: 'nausea', label: 'Nausea' },
  { key: 'headache', label: 'Headache' },
];

// ─── Vibration modes ──────────────────────────────────────────────────────────
const VIB_MODES = ['Continuous', 'Pulse', 'Wave', 'Relax'];

// ─── Arc math helpers ─────────────────────────────────────────────────────────
const ARC_R = 90;
const ARC_CX = 110;
const ARC_CY = 110;
const ARC_STROKE = 14;

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polarToXY(cx, cy, r, startDeg);
  const e = polarToXY(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
}

// ─── Custom Slider ────────────────────────────────────────────────────────────
function CustomSlider({
  value,
  min,
  max,
  onChange,
  trackColor = PURPLE,
  disabled = false,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  trackColor?: string;
  disabled?: boolean;
}) {
  const trackWidth = width - 72;
  const pct = (value - min) / (max - min);
  const thumbX = useRef(new Animated.Value(pct * trackWidth)).current;
  const trackRef = useRef<View>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (e) => {
        trackRef.current?.measure((_fx, _fy, _w, _h, px) => {
          const rel = e.nativeEvent.pageX - px;
          const clamped = Math.max(0, Math.min(trackWidth, rel));
          thumbX.setValue(clamped);
          onChange(min + (clamped / trackWidth) * (max - min));
        });
      },
      onPanResponderMove: (e) => {
        trackRef.current?.measure((_fx, _fy, _w, _h, px) => {
          const rel = e.nativeEvent.pageX - px;
          const clamped = Math.max(0, Math.min(trackWidth, rel));
          thumbX.setValue(clamped);
          onChange(min + (clamped / trackWidth) * (max - min));
        });
      },
    })
  ).current;

  // Sync when value changes externally
  useEffect(() => {
    const newX = ((value - min) / (max - min)) * trackWidth;
    thumbX.setValue(newX);
  }, [value, min, max, trackWidth]);

  return (
    <View
      ref={trackRef}
      style={{ height: 40, justifyContent: 'center', width: trackWidth }}
      {...panResponder.panHandlers}
    >
      {/* Track background */}
      <View style={{ height: 6, borderRadius: 3, backgroundColor: '#E5E7EB', width: trackWidth }}>
        {/* Filled portion */}
        <Animated.View
          style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: trackColor,
            width: thumbX.interpolate({ inputRange: [0, trackWidth], outputRange: ['0%', '100%'] }),
          }}
        />
      </View>
      {/* Thumb */}
      <Animated.View
        style={{
          position: 'absolute',
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: '#fff',
          borderWidth: 3,
          borderColor: trackColor,
          elevation: 4,
          shadowColor: trackColor,
          shadowOpacity: 0.3,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          transform: [{ translateX: thumbX.interpolate({ inputRange: [0, trackWidth], outputRange: [-11, trackWidth - 11] }) }],
        }}
      />
    </View>
  );
}

// ─── Pain Level Slider ────────────────────────────────────────────────────────
function PainSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const trackWidth = width - 72;
  const dotCount = 11;
  const dots = Array.from({ length: dotCount }, (_, i) => i);

  return (
    <View>
      {/* Dot track */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        {dots.map((i) => (
          <TouchableOpacity key={i} onPress={() => onChange(i)}>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: i <= value ? (value >= 7 ? '#EC4899' : PURPLE) : '#E5E7EB',
                borderWidth: i === value ? 3 : 0,
                borderColor: '#fff',
                elevation: i === value ? 4 : 0,
              }}
            />
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 11, color: T.text.muted }}>0 (No pain)</Text>
        <Text style={{ fontSize: 11, color: T.text.muted }}>5</Text>
        <Text style={{ fontSize: 11, color: T.text.muted }}>10 (Worst)</Text>
      </View>
    </View>
  );
}

// ─── EMG Waveform Graph ───────────────────────────────────────────────────────
function EmgWaveform({ points, color = PURPLE, height = 80 }: { points: number[]; color?: string; height?: number }) {
  const graphW = width - 96;
  const pts = points.slice(-40);
  if (pts.length < 2) {
    return <View style={{ height, backgroundColor: PURPLE_LIGHT, borderRadius: 12 }} />;
  }
  const minV = Math.min(...pts);
  const maxV = Math.max(...pts);
  const range = maxV - minV || 1;
  const toY = (v: number) => height - 8 - ((v - minV) / range) * (height - 16);
  const pathD = pts
    .map((v, i) => {
      const x = ((i / (pts.length - 1)) * graphW).toFixed(1);
      const y = toY(v).toFixed(1);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <View style={{ height, backgroundColor: PURPLE_LIGHT, borderRadius: 12, overflow: 'hidden', padding: 4 }}>
      <Svg width={graphW} height={height - 8}>
        <Path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

// ─── Live Telemetry Waveform Graph ──────────────────────────────────────────
function LiveWaveGraph({
  data,
  color,
  label,
  unit,
  yMin,
  yMax,
  height = 80,
}: {
  data: number[];
  color: string;
  label: string;
  unit: string;
  yMin: number;
  yMax: number;
  height?: number;
}) {
  const graphW = width - 96;
  const pts = data.slice(-40);
  const range = yMax - yMin || 1;
  const toY = (v: number) =>
    Math.max(4, Math.min(height - 4, height - ((v - yMin) / range) * height));

  const points = pts
    .map((v, i) => `${((i / Math.max(pts.length - 1, 1)) * graphW).toFixed(1)},${toY(v).toFixed(1)}`)
    .join(' ');

  const currentVal = pts.length > 0 ? pts[pts.length - 1] : 0;

  return (
    <View style={styles.telemetryGraphBox}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: T.text.secondary }}>{label}</Text>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '900', color }}>
          {currentVal.toFixed(1)} {unit}
        </Text>
      </View>
      <View style={{ height, width: graphW, overflow: 'hidden' }}>
        <Svg width={graphW} height={height}>
          {yMin < 0 && (
            <Line
              x1="0"
              y1={toY(0).toFixed(1)}
              x2={String(graphW)}
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

// ─── Circular Temperature Ring ────────────────────────────────────────────────
function TempRing({
  current,
  target,
  minTemp = 35,
  maxTemp = 43,
}: {
  current: number;
  target: number;
  minTemp?: number;
  maxTemp?: number;
}) {
  const bgArcPath = describeArc(ARC_CX, ARC_CY, ARC_R, -140, 140);
  const pct = Math.max(0, Math.min(1, (current - minTemp) / (maxTemp - minTemp)));
  const fillDeg = -140 + pct * 280;
  const fillArcPath = fillDeg > -140 ? describeArc(ARC_CX, ARC_CY, ARC_R, -140, fillDeg) : '';
  const status = current >= target - 1 ? 'At Target' : current < target - 3 ? 'Warming' : 'Heating';
  const statusColor = current >= target - 1 ? '#10B981' : '#EC4899';

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={220} height={220}>
        {/* Background arc */}
        <Path
          d={bgArcPath}
          fill="none"
          stroke="#E9D5FF"
          strokeWidth={ARC_STROKE}
          strokeLinecap="round"
        />
        {/* Fill arc */}
        {fillArcPath ? (
          <Path
            d={fillArcPath}
            fill="none"
            stroke={PURPLE}
            strokeWidth={ARC_STROKE}
            strokeLinecap="round"
          />
        ) : null}
        {/* Center dot */}
        <Circle cx={ARC_CX} cy={ARC_CY} r={4} fill={PURPLE} />
      </Svg>
      {/* Center text overlay */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 34, fontWeight: '800', color: '#EC4899', letterSpacing: -1 }}>
          {current.toFixed(1)}°C
        </Text>
        <Text style={{ fontSize: 13, color: T.text.secondary, marginTop: 2 }}>
          Target {target}°C
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF0F9', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 }}>
          <Ionicons name="flame" size={13} color="#EC4899" />
          <Text style={{ fontSize: 12, color: '#EC4899', fontWeight: '600', marginLeft: 4 }}>{status}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [value]);
  const bg = anim.interpolate({ inputRange: [0, 1], outputRange: ['#E5E7EB', PURPLE] });
  const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });
  return (
    <TouchableOpacity onPress={() => onChange(!value)} activeOpacity={0.8}>
      <Animated.View style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: bg, justifyContent: 'center' }}>
        <Animated.View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, transform: [{ translateX: tx }] }} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Session Timer formatter ──────────────────────────────────────────────────
function fmtTimer(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── End Session Modal ────────────────────────────────────────────────────────
function EndSessionModal({
  visible,
  onEnd,
  onCancel,
  painBefore,
}: {
  visible: boolean;
  onEnd: (painAfter: number) => void;
  onCancel: () => void;
  painBefore: number;
}) {
  const [painAfter, setPainAfter] = useState(painBefore);
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: T.text.primary, marginBottom: 4 }}>End Session</Text>
          <Text style={{ color: T.text.secondary, marginBottom: 20 }}>How is your pain level now?</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: PURPLE_LIGHT, borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: '#EC4899' }}>{painBefore}/10</Text>
              <Text style={{ fontSize: 12, color: T.text.muted, marginTop: 2 }}>Pain Before</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={PURPLE} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: '#10B981' }}>{painAfter}/10</Text>
              <Text style={{ fontSize: 12, color: T.text.muted, marginTop: 2 }}>Pain After</Text>
            </View>
          </View>

          <PainSlider value={painAfter} onChange={setPainAfter} />

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
            <TouchableOpacity
              onPress={onCancel}
              style={{ flex: 1, borderRadius: 16, borderWidth: 1.5, borderColor: '#E5E7EB', padding: 16, alignItems: 'center' }}
            >
              <Text style={{ fontWeight: '700', color: T.text.secondary }}>Continue Session</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onEnd(painAfter)}
              style={{ flex: 1, borderRadius: 16, backgroundColor: PURPLE, padding: 16, alignItems: 'center' }}
            >
              <Text style={{ fontWeight: '700', color: '#fff' }}>Save & End</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SessionScreen() {
  const router = useRouter();
  const { connectedDevice, connectionStatus, liveData, history, sendCommand, isDemo } = useBluetooth();
  const isConnected = connectionStatus === CONNECTION_STATUS.CONNECTED;

  // ── Prepare state ──────────────────────────────────────────────────────────
  const [painLevel, setPainLevel] = useState(5);
  const [location, setLocation] = useState('Lower abdomen');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [therapyMode, setTherapyMode] = useState<'manual' | 'smart'>('manual');

  // ── Session state ──────────────────────────────────────────────────────────
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartTime = useRef<number>(0);
  const emgBuffer = useRef<number[]>([]);

  // ── Therapy controls ───────────────────────────────────────────────────────
  const [heatEnabled, setHeatEnabled] = useState(true);
  const [targetTemp, setTargetTemp] = useState(40);
  const [vibEnabled, setVibEnabled] = useState(true);
  const [vibIntensity, setVibIntensity] = useState(70);
  const [vibMode, setVibMode] = useState('Pulse');

  // ── End session modal ──────────────────────────────────────────────────────
  const [showEndModal, setShowEndModal] = useState(false);

  // Live sensor values
  const currentTemp = Number(liveData?.temp ?? liveData?.temperature ?? 36.6);
  const rawAnalog = Number(liveData?.raw_analog ?? 1700);

  // Capture EMG data during session
  useEffect(() => {
    if (sessionActive && liveData) {
      emgBuffer.current = [...emgBuffer.current.slice(-60), rawAnalog];
    }
  }, [liveData, sessionActive]);

  // Timer
  useEffect(() => {
    if (sessionActive) {
      sessionStartTime.current = Date.now() - sessionSeconds * 1000;
      timerRef.current = setInterval(() => {
        setSessionSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionActive]);

  // ── Toggle symptoms ────────────────────────────────────────────────────────
  const toggleSymptom = useCallback((key: string) => {
    setSymptoms((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  // ── Start session ──────────────────────────────────────────────────────────
  const handleStartSession = useCallback(async () => {
    if (!isConnected) {
      Alert.alert('No Device', 'Please connect your Her Comfort device first.', [
        { text: 'Go to Devices', onPress: () => router.push('/ble-device' as any) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    setSessionSeconds(0);
    emgBuffer.current = [];
    setSessionActive(true);
    try {
      await sendCommand({ heater: heatEnabled, motor: vibEnabled, target_temp: targetTemp });
    } catch (_) {}
  }, [isConnected, heatEnabled, vibEnabled, targetTemp, sendCommand, router]);

  // ── End session ────────────────────────────────────────────────────────────
  const handleEndSession = useCallback(async (painAfter: number) => {
    setShowEndModal(false);
    setSessionActive(false);
    try {
      await sendCommand({ heater: false, motor: false });
    } catch (_) {}

    const durationMin = Math.max(1, Math.round(sessionSeconds / 60));
    const emgSnap = emgBuffer.current.slice(-30);

    const tempHistory = history.map((h) => Number(h.temp ?? h.temperature ?? 36.6));
    const avgTemp = tempHistory.length
      ? parseFloat((tempHistory.reduce((a, b) => a + b, 0) / tempHistory.length).toFixed(1))
      : currentTemp;
    const maxTemp = tempHistory.length ? parseFloat(Math.max(...tempHistory).toFixed(1)) : currentTemp;

    const notes = `Target ${targetTemp}°C heat with ${vibMode.toLowerCase()} vibration at ${vibIntensity}%. ${
      painAfter < painLevel ? `Pain reduced from ${painLevel} to ${painAfter}.` : 'Session completed.'
    }`;

    await sessionService.saveSession({
      date: new Date().toISOString(),
      durationMin,
      location,
      painBefore: painLevel,
      painAfter,
      avgTemp,
      maxTemp,
      targetTemp,
      vibIntensity,
      vibMode,
      symptoms,
      emgPoints: emgSnap,
      notes,
    });

    setSessionSeconds(0);
    emgBuffer.current = [];
  }, [sessionSeconds, history, currentTemp, targetTemp, vibMode, vibIntensity, painLevel, location, symptoms, sendCommand]);

  // ── Temp target adjust ──────────────────────────────────────────────────────
  const adjustTarget = useCallback((delta: number) => {
    setTargetTemp((t) => {
      const next = Math.max(36, Math.min(43, t + delta));
      if (sessionActive) sendCommand({ target_temp: next }).catch(() => {});
      return next;
    });
  }, [sessionActive, sendCommand]);

  // ── Heat/Vib toggles during session ───────────────────────────────────────
  const handleHeatToggle = useCallback(async (val: boolean) => {
    setHeatEnabled(val);
    if (sessionActive) await sendCommand({ heater: val }).catch(() => {});
  }, [sessionActive, sendCommand]);

  const handleVibToggle = useCallback(async (val: boolean) => {
    setVibEnabled(val);
    if (sessionActive) await sendCommand({ motor: val }).catch(() => {});
  }, [sessionActive, sendCommand]);

  // ── Active Session View (Live Sensor Dashboard) ───────────────────────────
  if (sessionActive) {
    const tempHistory = history.map((h) => Number(h.temp ?? h.temperature ?? 36.5));
    const emgPoints = emgBuffer.current.length > 2 ? emgBuffer.current : history.map((h) => Number(h.raw_analog ?? 1700));

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: SCREEN_BG }}>
        {/* Header */}
        <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
            <Text style={{ fontSize: 11, fontWeight: '800', color: PURPLE, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              LIVE THERAPY DASHBOARD
            </Text>
          </View>
          <Text style={{ fontSize: 42, fontWeight: '900', color: T.text.primary, letterSpacing: -2, marginTop: 2 }}>
            {fmtTimer(sessionSeconds)}
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {/* ── 1. Live Telemetry Quick Metric Cards ── */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            {/* Temp Card */}
            <View style={styles.metricCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <MaterialCommunityIcons name="thermometer" size={20} color="#EF4444" />
                <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#EF4444' }}>DS18B20</Text>
                </View>
              </View>
              <Text style={{ fontSize: 10, fontWeight: '700', color: T.text.muted, textTransform: 'uppercase' }}>Temperature</Text>
              <Text style={{ fontSize: 22, fontWeight: '900', color: T.text.primary, marginTop: 2 }}>
                {currentTemp.toFixed(1)}°C
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: currentTemp <= 43 ? '#10B981' : '#EF4444', marginTop: 2 }}>
                {currentTemp <= 43 ? 'Thermal Safe' : 'Overheating'}
              </Text>
            </View>

            {/* EMG Muscle Tone Card */}
            <View style={styles.metricCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <MaterialCommunityIcons name="sine-wave" size={20} color={PURPLE} />
                <View style={{ backgroundColor: PURPLE_LIGHT, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: PURPLE }}>EMG</Text>
                </View>
              </View>
              <Text style={{ fontSize: 10, fontWeight: '700', color: T.text.muted, textTransform: 'uppercase' }}>Pelvic Tone</Text>
              <Text style={{ fontSize: 22, fontWeight: '900', color: T.text.primary, marginTop: 2 }}>
                {rawAnalog}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: rawAnalog > 1800 ? '#EF4444' : rawAnalog > 1650 ? '#F59E0B' : '#10B981', marginTop: 2 }}>
                {rawAnalog > 1800 ? 'High Cramp' : rawAnalog > 1650 ? 'Moderate' : 'Relaxed'}
              </Text>
            </View>

            {/* Motor Actuator Card */}
            <View style={styles.metricCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <MaterialCommunityIcons name="vibrate" size={20} color={vibEnabled ? PURPLE : '#9CA3AF'} />
                <View style={{ backgroundColor: vibEnabled ? PURPLE_LIGHT : '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: vibEnabled ? PURPLE : '#6B7280' }}>
                    {vibEnabled ? 'ACTIVE' : 'IDLE'}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 10, fontWeight: '700', color: T.text.muted, textTransform: 'uppercase' }}>Motor / Vib</Text>
              <Text style={{ fontSize: 22, fontWeight: '900', color: T.text.primary, marginTop: 2 }}>
                {vibEnabled ? `${Math.round(vibIntensity)}%` : 'OFF'}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: T.text.secondary, marginTop: 2 }}>
                {vibMode}
              </Text>
            </View>
          </View>

          {/* ── 2. Heating Therapy Card ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: '#FFF0F9', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="flame" size={18} color="#EC4899" />
                </View>
                <Text style={styles.cardTitle}>HEATING THERAPY</Text>
              </View>
              <Toggle value={heatEnabled} onChange={handleHeatToggle} />
            </View>

            {/* Circular arc */}
            <TempRing current={currentTemp} target={targetTemp} />

            {/* Target adjuster */}
            <View style={styles.tempAdjuster}>
              <TouchableOpacity onPress={() => adjustTarget(-0.5)} style={styles.adjBtn}>
                <Ionicons name="remove" size={22} color={PURPLE} />
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: T.text.primary }}>{targetTemp.toFixed(1)}°C Target</Text>
                <Text style={{ fontSize: 11, color: T.text.muted }}>Safe max 43°C</Text>
              </View>
              <TouchableOpacity onPress={() => adjustTarget(0.5)} style={styles.adjBtn}>
                <Ionicons name="add" size={22} color={PURPLE} />
              </TouchableOpacity>
            </View>

            {/* Live Temperature Wave Trend */}
            <View style={{ marginTop: 12 }}>
              <LiveWaveGraph
                data={tempHistory.length > 0 ? tempHistory : [36.5, 36.6, 36.8, currentTemp]}
                color="#EF4444"
                label="DS18B20 Live Temperature Trend"
                unit="°C"
                yMin={35.0}
                yMax={43.0}
                height={70}
              />
            </View>
          </View>

          {/* ── 3. Soothing Motor & Vibration Card ── */}
          <View style={[styles.card, { marginTop: 12 }]}>
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: PURPLE_LIGHT, alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name="sine-wave" size={18} color={PURPLE} />
                </View>
                <Text style={styles.cardTitle}>MOTOR & VIBRATION ACTUATOR</Text>
              </View>
              <Toggle value={vibEnabled} onChange={handleVibToggle} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 10, marginBottom: 8 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: PURPLE }}>
                {Math.round(vibIntensity)}% Intensity
              </Text>
              <View style={{ backgroundColor: vibEnabled ? '#D1FAE5' : '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: vibEnabled ? '#065F46' : '#6B7280' }}>
                  {vibEnabled ? '⚡ MOTOR RUNNING' : 'MOTOR PAUSED'}
                </Text>
              </View>
            </View>

            <CustomSlider
              value={vibIntensity}
              min={0}
              max={100}
              onChange={(v) => setVibIntensity(Math.round(v))}
              trackColor={PURPLE}
            />

            {/* Mode chips */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {VIB_MODES.map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setVibMode(m)}
                  style={{
                    paddingHorizontal: 18,
                    paddingVertical: 9,
                    borderRadius: 20,
                    backgroundColor: vibMode === m ? PURPLE : '#fff',
                    borderWidth: 1.5,
                    borderColor: vibMode === m ? PURPLE : '#E5E7EB',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: vibMode === m ? '#fff' : T.text.secondary }}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── 4. Live EMG Muscle Relaxation Card ── */}
          <View style={[styles.card, { marginTop: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: T.text.muted, letterSpacing: 1, textTransform: 'uppercase' }}>
                  Live Muscle Relaxation (EMG)
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: PURPLE, marginTop: 2 }}>
                  Uterine & Pelvic Tone: {
                    emgPoints.length < 5 ? 'Measuring...' :
                    rawAnalog > 1800 ? 'High' : rawAnalog > 1650 ? 'Moderate' : 'Relaxed'
                  }
                </Text>
              </View>
              <View style={{ backgroundColor: PURPLE_LIGHT, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: PURPLE }}>LIVE</Text>
              </View>
            </View>
            <EmgWaveform points={emgPoints} color={PURPLE} height={90} />
          </View>

          {/* ── End Session Button ── */}
          <TouchableOpacity
            onPress={() => setShowEndModal(true)}
            style={styles.endBtn}
            activeOpacity={0.85}
          >
            <Ionicons name="stop-circle" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.5, marginLeft: 8 }}>
              END SESSION
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <EndSessionModal
          visible={showEndModal}
          onEnd={handleEndSession}
          onCancel={() => setShowEndModal(false)}
          painBefore={painLevel}
        />
      </SafeAreaView>
    );
  }

  // ── Prepare Session View ───────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: SCREEN_BG }}>
      {/* Connection banner */}
      {!isConnected && (
        <TouchableOpacity
          onPress={() => router.push('/ble-device' as any)}
          style={styles.connectBanner}
        >
          <Feather name="bluetooth" size={16} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', marginLeft: 8, flex: 1 }}>
            No device connected. Tap to connect your Her Comfort band.
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#fff" />
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Page header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <View>
            <Text style={{ fontSize: 24, fontWeight: '900', color: T.text.primary }}>Prepare Relief</Text>
            <Text style={{ fontSize: 14, color: T.text.secondary }}>Session</Text>
          </View>
          {isConnected && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#065F46' }}>
                {connectedDevice?.name ?? 'Connected'}
              </Text>
            </View>
          )}
        </View>

        {/* ── How are you feeling ── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>HOW ARE YOU FEELING?</Text>

          {/* Pain level */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: T.text.primary }}>Current Pain Level</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons
                name={painLevel >= 8 ? 'warning' : painLevel >= 5 ? 'alert-circle' : 'checkmark-circle'}
                size={16}
                color={painLevel >= 8 ? '#EF4444' : painLevel >= 5 ? '#F59E0B' : '#10B981'}
              />
              <Text style={{ fontWeight: '800', color: painLevel >= 8 ? '#EF4444' : painLevel >= 5 ? '#F59E0B' : '#10B981' }}>
                {painLevel >= 8 ? 'Severe' : painLevel >= 5 ? 'Moderate' : 'Mild'} {painLevel}/10
              </Text>
            </View>
          </View>
          <PainSlider value={painLevel} onChange={setPainLevel} />

          {/* Location */}
          <Text style={[styles.subLabel, { marginTop: 20 }]}>Primary Pain Location</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {PAIN_LOCATIONS.map((loc) => (
              <TouchableOpacity
                key={loc}
                onPress={() => setLocation(loc)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: 20,
                  backgroundColor: location === loc ? PURPLE_LIGHT : '#fff',
                  borderWidth: 1.5,
                  borderColor: location === loc ? PURPLE : '#E5E7EB',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: location === loc ? PURPLE : T.text.secondary }}>
                  {loc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Symptoms */}
          <Text style={[styles.subLabel, { marginTop: 20 }]}>Associated Symptoms</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {SYMPTOMS.map(({ key, label }) => {
              const sel = symptoms.includes(key);
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => toggleSymptom(key)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    borderRadius: 20,
                    backgroundColor: sel ? '#FCE7F3' : '#fff',
                    borderWidth: 1.5,
                    borderColor: sel ? '#EC4899' : '#E5E7EB',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: sel ? '#EC4899' : T.text.secondary }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Therapy Mode ── */}
        <View style={[styles.card, { marginTop: 12 }]}>
          <Text style={styles.sectionLabel}>SELECT THERAPY MODE</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity
              onPress={() => setTherapyMode('manual')}
              style={{
                flex: 1,
                padding: 16,
                borderRadius: 16,
                backgroundColor: therapyMode === 'manual' ? PURPLE_LIGHT : '#F9FAFB',
                borderWidth: 1.5,
                borderColor: therapyMode === 'manual' ? PURPLE : '#E5E7EB',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '800', color: therapyMode === 'manual' ? PURPLE : T.text.secondary }}>
                Manual Mode
              </Text>
              <Text style={{ fontSize: 11, color: T.text.muted, marginTop: 4 }}>
                Direct thermal & vibration controls
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {}}
              style={{
                flex: 1,
                padding: 16,
                borderRadius: 16,
                backgroundColor: '#F9FAFB',
                borderWidth: 1.5,
                borderColor: '#E5E7EB',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: T.text.secondary }}>Smart Mode</Text>
                <View style={{ backgroundColor: '#E5E7EB', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: T.text.muted }}>SOON</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, color: T.text.muted, marginTop: 4 }}>Auto EMG adaptive loop</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Start Button ── */}
        <TouchableOpacity
          onPress={handleStartSession}
          style={[styles.startBtn, !isConnected && { opacity: 0.6 }]}
          activeOpacity={0.85}
        >
          <Ionicons name="flash" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 1.5, marginLeft: 8 }}>
            START SESSION
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 18,
    shadowColor: '#E84EA1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: T.text.secondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: T.text.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  subLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: T.text.primary,
  },
  tempAdjuster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 4,
  },
  adjBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PURPLE_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PURPLE,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PURPLE,
    borderRadius: 20,
    paddingVertical: 18,
    marginTop: 20,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 20,
    paddingVertical: 18,
    marginTop: 20,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  telemetryGraphBox: {
    backgroundColor: '#FFF5FA',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FCE7F3',
    marginBottom: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FCE7F3',
    elevation: 2,
    shadowColor: '#E84EA1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
});
