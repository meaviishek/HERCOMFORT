/**
 * session.tsx  –  Nari App Session & AI Bio-Intelligence Telemetry Console
 *
 * Professional Medical & AI Bio-Feedback System (LITE / Clean Clinical Theme):
 *   1. Dedicated Therapy Console:
 *      - Prepare screen: Pre-session pain assessment, anatomical location, symptoms, target duration
 *      - Direct access: Session history is centralized in the dedicated History tab
 *   2. Active Live Session (5 AI-Engineered Panels - LITE UI):
 *      - Panel 1: Vibration & Neuro-Actuation (PWM speed slider 0-100%, discrete levels, 4 pulse modes)
 *      - Panel 2: Precision PID Thermal Regulation (Digital circular dial, delta-T, presets 38/40/42 C)
 *      - Panel 3: Tri-Axial IMU Dynamics (All-in-one XYZ oscilloscope graph, magnitude |a|, posture classification)
 *      - Panel 4: DS18B20 Clinical Temperature Monitor (Live belt temp, session avg/peak, trend curve, thermal safety)
 *      - Panel 5: BioAmp Neural EMG Muscle Tone (Bio-potential waveform, contraction classification words, live EMG RMS)
 *   3. Continuous Batching:
 *      - Readings batched every 8s with timestamps to Node.js / MongoDB (no threshold stored)
 *   4. Exact Duration:
 *      - Preset default 10-15 min; if user ends early at 5 min, exact 5 min duration is stored
 *   5. Pure Professional UI:
 *      - Lite clean clinical palette. No emojis used anywhere. Clean vector icons and medical typography.
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
import sessionService from '../../services/sessionService';
import ApiService from '../../services/ApiService';

const { width } = Dimensions.get('window');

// ─── Professional LITE Color Tokens ──────────────────────────────────────────
const THEME = {
  bg: '#F8FAFC',           // Clean crisp light background (slate-50)
  cardBg: '#FFFFFF',       // Pure white clinical card
  cardBorder: '#E2E8F0',   // Subtle precision slate-200 border
  accentPink: '#E84EA1',   // Nari signature magenta / pink
  accentBlue: '#0284C7',   // Bio-telemetry cyan/sky
  accentGreen: '#059669',  // Clinical emerald safe
  accentAmber: '#D97706',  // Watchdog warning amber
  accentPurple: '#7C3AED', // BioAmp neural purple
  textPrimary: '#0F172A',  // Slate-900 high-contrast primary text
  textSecondary: '#475569',// Slate-600 technical secondary text
  textMuted: '#94A3B8',    // Slate-400 subdued metadata
  gridLine: '#E2E8F0',     // Precision grid lines
  canvasBg: '#F1F5F9',     // Graph canvas background (slate-100)
};

// Colors for Tri-Axial Gyro XYZ
const GYRO_X_COLOR = '#0284C7'; // Blue
const GYRO_Y_COLOR = '#059669'; // Green
const GYRO_Z_COLOR = '#D97706'; // Amber

// ─── Protocol Presets ────────────────────────────────────────────────────────
const PAIN_LOCATIONS = ['Lower Abdomen', 'Lower Back', 'Pelvic Floor', 'Suprapubic'];
const CLINICAL_SYMPTOMS = [
  { key: 'cramping', label: 'Cramping' },
  { key: 'fatigue', label: 'Fatigue' },
  { key: 'bloating', label: 'Bloating' },
  { key: 'nausea', label: 'Nausea' },
  { key: 'headache', label: 'Cephalea' },
];
const VIB_MODES = ['Continuous', 'Pulse Burst', 'Harmonic Wave', 'Deep Relax'];
const DURATION_PRESETS = [10, 15, 20, 30]; // Minutes

// ─── Mathematical & Algorithmic Features ─────────────────────────────────────

/**
 * Root Mean Square (RMS) of EMG signal:
 * RMS = sqrt( (1/N) * sum( (x_i - mean)^2 ) )
 */
function calculateEmgRms(points: number[]): number {
  if (!points || points.length === 0) return 0;
  const mean = points.reduce((acc, v) => acc + v, 0) / points.length;
  const sumSquares = points.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0);
  return parseFloat(Math.sqrt(sumSquares / points.length).toFixed(2));
}

/**
 * Classify uterine contraction state using EMG RMS and raw deviation.
 */
function classifyContraction(rms: number, currentRaw: number): {
  text: 'HIGH CONTRACTION' | 'MODERATE CONTRACTION' | 'LOW CONTRACTION' | 'RELAXED BASELINE';
  color: string;
  bg: string;
  borderColor: string;
  iconName: 'alert-circle-outline' | 'information-outline' | 'shield-check-outline' | 'check-circle-outline';
} {
  const deviation = Math.abs(currentRaw - 1700);
  if (deviation > 180 || rms > 45) {
    return {
      text: 'HIGH CONTRACTION',
      color: '#DC2626',
      bg: '#FEE2E2',
      borderColor: '#FECACA',
      iconName: 'alert-circle-outline',
    };
  } else if (deviation > 90 || rms > 25) {
    return {
      text: 'MODERATE CONTRACTION',
      color: '#D97706',
      bg: '#FEF3C7',
      borderColor: '#FDE68A',
      iconName: 'information-outline',
    };
  } else if (deviation > 30 || rms > 10) {
    return {
      text: 'LOW CONTRACTION',
      color: '#0284C7',
      bg: '#E0F2FE',
      borderColor: '#BAE6FD',
      iconName: 'shield-check-outline',
    };
  }
  return {
    text: 'RELAXED BASELINE',
    color: '#059669',
    bg: '#D1FAE5',
    borderColor: '#A7F3D0',
    iconName: 'check-circle-outline',
  };
}

/**
 * Calculate IMU movement statistics and magnitude |a|.
 */
function calculateImuStats(imuPoints: { gx: number; gy: number; gz: number }[]): {
  avgMovement: number;
  maxMovement: number;
  postureText: string;
} {
  if (!imuPoints || imuPoints.length === 0) {
    return { avgMovement: 0, maxMovement: 0, postureText: 'Static Rest' };
  }
  const mags = imuPoints.map((p) => Math.sqrt(p.gx * p.gx + p.gy * p.gy + p.gz * p.gz));
  const avg = mags.reduce((a, b) => a + b, 0) / mags.length;
  const max = Math.max(...mags);
  const postureText = avg > 1.35 ? 'Kinematic Activity' : avg > 1.08 ? 'Postural Shift' : 'Static Rest';
  return {
    avgMovement: parseFloat(avg.toFixed(2)),
    maxMovement: parseFloat(max.toFixed(2)),
    postureText,
  };
}

// ─── Arc Geometry ─────────────────────────────────────────────────────────────
const ARC_R = 86;
const ARC_CX = 110;
const ARC_CY = 110;
const ARC_STROKE = 12;

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

// ─── Precision Slider (Lite Theme) ────────────────────────────────────────────
function PrecisionSlider({
  value,
  min,
  max,
  onChange,
  disabled = false,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
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

  useEffect(() => {
    const newX = ((value - min) / (max - min)) * trackWidth;
    thumbX.setValue(newX);
  }, [value, min, max, trackWidth]);

  return (
    <View
      ref={trackRef}
      style={{ height: 38, justifyContent: 'center', width: trackWidth }}
      {...panResponder.panHandlers}
    >
      <View style={{ height: 6, borderRadius: 3, backgroundColor: '#E2E8F0', width: trackWidth }}>
        <Animated.View
          style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: THEME.accentPink,
            width: thumbX.interpolate({ inputRange: [0, trackWidth], outputRange: ['0%', '100%'] }),
          }}
        />
      </View>
      <Animated.View
        style={{
          position: 'absolute',
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: '#FFFFFF',
          borderWidth: 3,
          borderColor: THEME.accentPink,
          elevation: 4,
          shadowColor: THEME.accentPink,
          shadowOpacity: 0.3,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          transform: [
            {
              translateX: thumbX.interpolate({
                inputRange: [0, trackWidth],
                outputRange: [-11, trackWidth - 11],
              }),
            },
          ],
        }}
      />
    </View>
  );
}

// ─── Clinical Pain Scale (Lite Theme) ─────────────────────────────────────────
function ClinicalPainScale({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const steps = Array.from({ length: 11 }, (_, i) => i);
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        {steps.map((i) => {
          const isSelected = i === value;
          const isPassed = i <= value;
          const color = value >= 7 ? '#DC2626' : value >= 4 ? '#D97706' : '#059669';
          return (
            <TouchableOpacity
              key={i}
              onPress={() => onChange(i)}
              hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  backgroundColor: isPassed ? color : '#F1F5F9',
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? THEME.textPrimary : '#CBD5E1',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '800',
                    color: isPassed ? '#FFFFFF' : THEME.textMuted,
                  }}
                >
                  {i}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: THEME.textMuted }}>0 (NONE)</Text>
        <Text style={{ fontSize: 10, fontWeight: '700', color: THEME.textMuted }}>5 (MODERATE)</Text>
        <Text style={{ fontSize: 10, fontWeight: '700', color: THEME.textMuted }}>10 (SEVERE)</Text>
      </View>
    </View>
  );
}

// ─── Professional Toggle (Lite Theme) ─────────────────────────────────────────
function PrecisionToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <TouchableOpacity
      onPress={() => onChange(!value)}
      activeOpacity={0.8}
      style={{
        width: 46,
        height: 26,
        borderRadius: 13,
        backgroundColor: value ? '#FCE7F3' : '#E2E8F0',
        borderWidth: 1.5,
        borderColor: value ? THEME.accentPink : '#CBD5E1',
        justifyContent: 'center',
        paddingHorizontal: 3,
      }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: value ? THEME.accentPink : '#94A3B8',
          alignSelf: value ? 'flex-end' : 'flex-start',
        }}
      />
    </TouchableOpacity>
  );
}

// ─── Format Time ──────────────────────────────────────────────────────────────
function fmtTimer(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Panel 3: Tri-Axial IMU All-in-One XYZ Oscilloscope Graph (Lite UI) ───────
function GyroCombinedGraph({
  data,
  height = 110,
}: {
  data: { gx: number; gy: number; gz: number }[];
  height?: number;
}) {
  const graphW = width - 72;
  const pts = data.slice(-35);
  const cur = pts.length > 0 ? pts[pts.length - 1] : { gx: 0, gy: 0, gz: 1 };
  const mag = Math.sqrt(cur.gx * cur.gx + cur.gy * cur.gy + cur.gz * cur.gz);

  const yMin = -2.5;
  const yMax = 2.5;
  const range = yMax - yMin || 1;
  const toY = (v: number) =>
    Math.max(4, Math.min(height - 4, height - ((v - yMin) / range) * height));

  const xPoints = pts
    .map((p, i) => `${((i / Math.max(pts.length - 1, 1)) * graphW).toFixed(1)},${toY(p.gx).toFixed(1)}`)
    .join(' ');
  const yPoints = pts
    .map((p, i) => `${((i / Math.max(pts.length - 1, 1)) * graphW).toFixed(1)},${toY(p.gy).toFixed(1)}`)
    .join(' ');
  const zPoints = pts
    .map((p, i) => `${((i / Math.max(pts.length - 1, 1)) * graphW).toFixed(1)},${toY(p.gz).toFixed(1)}`)
    .join(' ');

  const zeroY = toY(0);

  return (
    <View style={styles.oscilloscopeContainer}>
      {/* Precision Legend & Metrics */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: GYRO_X_COLOR }} />
            <Text style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: '800', color: GYRO_X_COLOR }}>
              X:{cur.gx >= 0 ? `+${cur.gx.toFixed(2)}` : cur.gx.toFixed(2)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: GYRO_Y_COLOR }} />
            <Text style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: '800', color: GYRO_Y_COLOR }}>
              Y:{cur.gy >= 0 ? `+${cur.gy.toFixed(2)}` : cur.gy.toFixed(2)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: GYRO_Z_COLOR }} />
            <Text style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: '800', color: GYRO_Z_COLOR }}>
              Z:{cur.gz >= 0 ? `+${cur.gz.toFixed(2)}` : cur.gz.toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={{ backgroundColor: '#F3E8FF', borderWidth: 1, borderColor: '#DDD6FE', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
          <Text style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: '800', color: THEME.accentPurple }}>
            |a| {mag.toFixed(2)}g
          </Text>
        </View>
      </View>

      {/* SVG Canvas with 3 PolyLines & Grid */}
      <View style={{ height, width: graphW, overflow: 'hidden', backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
        <Svg width={graphW} height={height}>
          {/* Oscilloscope Grid Lines */}
          <Line x1="0" y1={toY(1.0).toFixed(1)} x2={String(graphW)} y2={toY(1.0).toFixed(1)} stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3 3" />
          <Line x1="0" y1={zeroY.toFixed(1)} x2={String(graphW)} y2={zeroY.toFixed(1)} stroke="#94A3B8" strokeWidth="1.2" strokeDasharray="4 3" />
          <Line x1="0" y1={toY(-1.0).toFixed(1)} x2={String(graphW)} y2={toY(-1.0).toFixed(1)} stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3 3" />

          {pts.length > 1 && (
            <>
              <Polyline points={xPoints} fill="none" stroke={GYRO_X_COLOR} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
              <Polyline points={yPoints} fill="none" stroke={GYRO_Y_COLOR} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
              <Polyline points={zPoints} fill="none" stroke={GYRO_Z_COLOR} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
            </>
          )}
        </Svg>
      </View>
    </View>
  );
}

// ─── Panel 4: Temperature Telemetry Curve (Lite UI) ───────────────────────────
function TempTrendGraph({ data, height = 70 }: { data: number[]; height?: number }) {
  const graphW = width - 72;
  const pts = data.slice(-35);
  const yMin = 34.0;
  const yMax = 44.0;
  const range = yMax - yMin || 1;
  const toY = (v: number) =>
    Math.max(4, Math.min(height - 4, height - ((v - yMin) / range) * height));

  const points = pts
    .map((v, i) => `${((i / Math.max(pts.length - 1, 1)) * graphW).toFixed(1)},${toY(v).toFixed(1)}`)
    .join(' ');

  return (
    <View style={{ height, width: graphW, overflow: 'hidden', backgroundColor: '#FFF5FA', borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: '#FCE7F3' }}>
      <Svg width={graphW} height={height}>
        <Line x1="0" y1={toY(40).toFixed(1)} x2={String(graphW)} y2={toY(40).toFixed(1)} stroke="#F472B6" strokeWidth="1" strokeDasharray="4 3" />
        {pts.length > 1 && (
          <Polyline points={points} fill="none" stroke="#E11D48" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        )}
      </Svg>
    </View>
  );
}

// ─── Panel 5: BioAmp Waveform Oscilloscope (Lite UI) ───────────────────────────
function BioAmpWaveform({ points, height = 80 }: { points: number[]; height?: number }) {
  const graphW = width - 72;
  const pts = points.slice(-40);
  if (pts.length < 2) {
    return <View style={{ height, backgroundColor: '#FAF5FF', borderRadius: 8, borderWidth: 1, borderColor: '#F3E8FF' }} />;
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
    <View style={{ height, backgroundColor: '#FAF5FF', borderRadius: 8, overflow: 'hidden', padding: 4, marginTop: 8, borderWidth: 1, borderColor: '#E9D5FF' }}>
      <Svg width={graphW} height={height - 8}>
        <Path d={pathD} fill="none" stroke={THEME.accentPurple} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

// ─── Circular Thermal Gauge Ring (Lite UI) ────────────────────────────────────
function ClinicalTempRing({
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

  const delta = current - target;
  const status =
    Math.abs(delta) <= 0.4 ? 'AT TARGET' : current < target ? 'HEATING UP' : 'COOLING';
  const statusColor = Math.abs(delta) <= 0.4 ? THEME.accentGreen : THEME.accentPink;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={220} height={220}>
        <Path d={bgArcPath} fill="none" stroke="#F1F5F9" strokeWidth={ARC_STROKE} strokeLinecap="round" />
        {fillArcPath ? (
          <Path d={fillArcPath} fill="none" stroke={THEME.accentPink} strokeWidth={ARC_STROKE} strokeLinecap="round" />
        ) : null}
        <Circle cx={ARC_CX} cy={ARC_CY} r={4} fill={THEME.accentPink} />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 38, fontFamily: 'monospace', fontWeight: '900', color: THEME.textPrimary, letterSpacing: -1 }}>
          {current.toFixed(1)}°C
        </Text>
        <Text style={{ fontSize: 12, fontFamily: 'monospace', color: THEME.textSecondary, marginTop: 1 }}>
          TARGET: {target.toFixed(1)}°C
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FCE7F3', borderWidth: 1, borderColor: '#FBCFE8', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor, marginRight: 5 }} />
          <Text style={{ fontSize: 10, fontWeight: '800', color: statusColor, letterSpacing: 0.8 }}>
            {status} ({delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}°C)
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── End Session Evaluation Modal (Lite UI) ───────────────────────────────────
function EndSessionModal({
  visible,
  onEnd,
  onCancel,
  painBefore,
  elapsedSecs,
}: {
  visible: boolean;
  onEnd: (painAfter: number) => void;
  onCancel: () => void;
  painBefore: number;
  elapsedSecs: number;
}) {
  const [painAfter, setPainAfter] = useState(painBefore);
  const minutes = Math.max(1, Math.round(elapsedSecs / 60));

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderColor: THEME.cardBorder }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: THEME.textPrimary, letterSpacing: 0.5 }}>
              TERMINATE RELIEF SESSION
            </Text>
            <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
              <Text style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: '700', color: THEME.accentBlue }}>
                {minutes} MIN ({fmtTimer(elapsedSecs)})
              </Text>
            </View>
          </View>

          <Text style={{ color: THEME.textSecondary, fontSize: 12, marginBottom: 16 }}>
            Record post-session pain level. Telemetry features will be analyzed and persisted to your health history.
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: '#E2E8F0' }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontFamily: 'monospace', fontWeight: '900', color: '#DC2626' }}>
                {painBefore}/10
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: THEME.textMuted, marginTop: 2 }}>INITIAL PAIN</Text>
            </View>
            <Feather name="arrow-right" size={18} color={THEME.textSecondary} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontFamily: 'monospace', fontWeight: '900', color: THEME.accentGreen }}>
                {painAfter}/10
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: THEME.textMuted, marginTop: 2 }}>CURRENT PAIN</Text>
            </View>
          </View>

          <ClinicalPainScale value={painAfter} onChange={setPainAfter} />

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
            <TouchableOpacity
              onPress={onCancel}
              style={{ flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', padding: 14, alignItems: 'center' }}
            >
              <Text style={{ fontWeight: '700', color: THEME.textSecondary, fontSize: 13 }}>RESUME SESSION</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onEnd(painAfter)}
              style={{ flex: 1, borderRadius: 14, backgroundColor: THEME.accentPink, padding: 14, alignItems: 'center' }}
            >
              <Text style={{ fontWeight: '800', color: '#FFFFFF', fontSize: 13, letterSpacing: 0.5 }}>SAVE & PERSIST</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}



// ═════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN COMPONENT (LITE THEME)
// ═════════════════════════════════════════════════════════════════════════════
export default function SessionScreen() {
  const router = useRouter();
  const { connectedDevice, connectionStatus, liveData, sendCommand } = useBluetooth();
  const isConnected = connectionStatus === CONNECTION_STATUS.CONNECTED;

  // ── Prepare State ──────────────────────────────────────────────────────────
  const [painLevel, setPainLevel] = useState(5);
  const [location, setLocation] = useState('Lower Abdomen');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [presetDuration, setPresetDuration] = useState(15);

  // ── Active Session State ───────────────────────────────────────────────────
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const batchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentSessionId = useRef<string>('');

  // Buffers for features & batching
  const emgBuffer = useRef<number[]>([]);
  const gyroBuffer = useRef<{ gx: number; gy: number; gz: number }[]>([]);
  const tempBuffer = useRef<number[]>([]);
  const batchReadingsBuffer = useRef<any[]>([]);

  // ── Panel 1: Vibration Controls ────────────────────────────────────────────
  const [vibEnabled, setVibEnabled] = useState(true);
  const [vibIntensity, setVibIntensity] = useState(70);
  const [vibMode, setVibMode] = useState('Pulse Burst');

  // ── Panel 2: Heating Controls ──────────────────────────────────────────────
  const [heatEnabled, setHeatEnabled] = useState(true);
  const [targetTemp, setTargetTemp] = useState(40.0);

  // ── End session modal ──────────────────────────────────────────────────────
  const [showEndModal, setShowEndModal] = useState(false);

  // Live readings from hardware or belt telemetry
  const currentTemp = Number(liveData?.temp ?? liveData?.temperature ?? 37.0);
  const rawAnalog = Number(liveData?.raw_analog ?? 1700);
  const currentGx = Number(liveData?.gx ?? 0);
  const currentGy = Number(liveData?.gy ?? 0);
  const currentGz = Number(liveData?.gz ?? 1);

  // Real-time computed EMG RMS & Contraction Classification
  const currentEmgRms = calculateEmgRms(
    emgBuffer.current.length > 4 ? emgBuffer.current.slice(-30) : [rawAnalog]
  );
  const contraction = classifyContraction(currentEmgRms, rawAnalog);

  // Accumulate telemetry during active session
  useEffect(() => {
    if (sessionActive && liveData) {
      emgBuffer.current = [...emgBuffer.current.slice(-150), rawAnalog];
      gyroBuffer.current = [...gyroBuffer.current.slice(-150), { gx: currentGx, gy: currentGy, gz: currentGz }];
      tempBuffer.current = [...tempBuffer.current.slice(-150), currentTemp];

      // Batch item with timestamp (WITHOUT threshold)
      batchReadingsBuffer.current.push({
        deviceId: liveData.deviceId || connectedDevice?.name || 'HER-COMFORT',
        sessionId: currentSessionId.current,
        temp: currentTemp,
        gx: currentGx,
        gy: currentGy,
        gz: currentGz,
        raw_analog: rawAnalog,
        timestamp: Date.now(),
      });
    }
  }, [liveData, sessionActive, currentTemp, rawAnalog, currentGx, currentGy, currentGz, connectedDevice]);

  // Session timer
  useEffect(() => {
    if (sessionActive) {
      timerRef.current = setInterval(() => {
        setSessionSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionActive]);

  // Periodic batch sync every 8 seconds
  useEffect(() => {
    if (sessionActive) {
      batchTimerRef.current = setInterval(() => {
        if (batchReadingsBuffer.current.length > 0) {
          const toSend = [...batchReadingsBuffer.current];
          batchReadingsBuffer.current = [];
          ApiService.postBatchReadings(toSend).catch((err) => {
            console.warn('[Telemetry] Periodic batch notice:', err);
          });
        }
      }, 8000);
    } else {
      if (batchTimerRef.current) clearInterval(batchTimerRef.current);
    }
    return () => {
      if (batchTimerRef.current) clearInterval(batchTimerRef.current);
    };
  }, [sessionActive]);

  // ── Toggle Symptom ─────────────────────────────────────────────────────────
  const toggleSymptom = useCallback((key: string) => {
    setSymptoms((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  // ── Start Session ──────────────────────────────────────────────────────────
  const handleStartSession = useCallback(async () => {
    if (!isConnected) {
      Alert.alert('Device Offline', 'Please connect your Her Comfort belt to initiate telemetry.', [
        { text: 'Connect Belt', onPress: () => router.push('/ble-device' as any) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }

    currentSessionId.current = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setSessionSeconds(0);
    emgBuffer.current = [rawAnalog];
    gyroBuffer.current = [{ gx: currentGx, gy: currentGy, gz: currentGz }];
    tempBuffer.current = [currentTemp];
    batchReadingsBuffer.current = [];
    setSessionActive(true);

    try {
      await sendCommand({
        heater: heatEnabled,
        motor: vibEnabled,
        target_temp: targetTemp,
        vib_intensity: vibIntensity,
        vib_mode: vibMode,
      });
    } catch (_) {}
  }, [isConnected, rawAnalog, currentGx, currentGy, currentGz, currentTemp, heatEnabled, vibEnabled, targetTemp, vibIntensity, vibMode, sendCommand, router]);

  // ── End Session & Save ─────────────────────────────────────────────────────
  const handleEndSession = useCallback(
    async (painAfter: number) => {
      setShowEndModal(false);
      setSessionActive(false);

      try {
        await sendCommand({ heater: false, motor: false });
      } catch (_) {}

      // Flush remaining batch readings immediately
      if (batchReadingsBuffer.current.length > 0) {
        const remaining = [...batchReadingsBuffer.current];
        batchReadingsBuffer.current = [];
        ApiService.postBatchReadings(remaining).catch(() => {});
      }

      // Exact elapsed time in seconds and rounded minutes
      const durationSecs = sessionSeconds;
      const durationMin = Math.max(1, Math.round(durationSecs / 60));

      const allEmg = emgBuffer.current.length > 0 ? emgBuffer.current : [rawAnalog];
      const sessionEmgRms = calculateEmgRms(allEmg);

      const allTemp = tempBuffer.current.length > 0 ? tempBuffer.current : [currentTemp];
      const avgTemp = parseFloat((allTemp.reduce((a, b) => a + b, 0) / allTemp.length).toFixed(1));
      const maxTemp = parseFloat(Math.max(...allTemp).toFixed(1));

      const imuStats = calculateImuStats(
        gyroBuffer.current.length > 0 ? gyroBuffer.current : [{ gx: 0, gy: 0, gz: 1 }]
      );
      const finalContraction = classifyContraction(sessionEmgRms, rawAnalog).text;

      const notes = `Clinical session concluded. Target ${targetTemp}°C heat with ${vibMode} stimulation at ${vibIntensity}%. Pain ${
        painAfter < painLevel ? `reduced from ${painLevel} to ${painAfter}` : `recorded at ${painAfter}/10`
      }.`;

      try {
        await sessionService.saveSession({
          date: new Date().toISOString(),
          durationSeconds: durationSecs,
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
          emgPoints: allEmg.slice(-30),
          emgRms: sessionEmgRms,
          imuStats: { avgMovement: imuStats.avgMovement, maxMovement: imuStats.maxMovement },
          contractionLevel: finalContraction,
          notes,
        });
      } catch (err) {
        console.error('Failed to save session:', err);
      }

      setSessionSeconds(0);
      emgBuffer.current = [];
      gyroBuffer.current = [];
      tempBuffer.current = [];
    },
    [sessionSeconds, rawAnalog, currentTemp, targetTemp, vibMode, vibIntensity, painLevel, location, symptoms, sendCommand]
  );

  // ── Hardware Handlers ──────────────────────────────────────────────────────
  const adjustTarget = useCallback(
    (delta: number) => {
      setTargetTemp((t) => {
        const next = Math.max(36.0, Math.min(43.0, parseFloat((t + delta).toFixed(1))));
        if (sessionActive) sendCommand({ target_temp: next }).catch(() => {});
        return next;
      });
    },
    [sessionActive, sendCommand]
  );

  const handleHeatToggle = useCallback(
    async (val: boolean) => {
      setHeatEnabled(val);
      if (sessionActive) await sendCommand({ heater: val }).catch(() => {});
    },
    [sessionActive, sendCommand]
  );

  const handleVibToggle = useCallback(
    async (val: boolean) => {
      setVibEnabled(val);
      if (sessionActive) await sendCommand({ motor: val }).catch(() => {});
    },
    [sessionActive, sendCommand]
  );

  const handleVibIntensityChange = useCallback(
    (val: number) => {
      const rounded = Math.round(val);
      setVibIntensity(rounded);
      if (sessionActive) sendCommand({ vib_intensity: rounded }).catch(() => {});
    },
    [sessionActive, sendCommand]
  );

  const handleVibModeChange = useCallback(
    (mode: string) => {
      setVibMode(mode);
      if (sessionActive) sendCommand({ vib_mode: mode }).catch(() => {});
    },
    [sessionActive, sendCommand]
  );

  // ═════════════════════════════════════════════════════════════════════════════
  // ACTIVE SESSION VIEW: AI-POWERED CLINICAL BIO-INTELLIGENCE CONSOLE (LITE UI)
  // ═════════════════════════════════════════════════════════════════════════════
  if (sessionActive) {
    const tempPoints = tempBuffer.current.length > 2 ? tempBuffer.current : [36.5, 36.8, currentTemp];
    const gyroPoints =
      gyroBuffer.current.length > 2
        ? gyroBuffer.current
        : [{ gx: 0, gy: 0, gz: 1 }, { gx: currentGx, gy: currentGy, gz: currentGz }];
    const emgPoints = emgBuffer.current.length > 2 ? emgBuffer.current : [1700, rawAnalog];

    const sessionAvgTemp = (
      tempBuffer.current.reduce((a, b) => a + b, 0) / Math.max(tempBuffer.current.length, 1)
    ).toFixed(1);
    const sessionMaxTemp = Math.max(...(tempBuffer.current.length ? tempBuffer.current : [currentTemp])).toFixed(1);
    const progressPct = Math.min(100, (sessionSeconds / (presetDuration * 60)) * 100);
    const imuMetrics = calculateImuStats(gyroPoints);

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
        {/* Top Clinical AI Cockpit Bar (Lite) */}
        <View style={styles.activeHeaderBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.accentGreen }} />
              <Text style={{ fontSize: 11, fontWeight: '800', color: THEME.accentPink, letterSpacing: 1.2 }}>
                AI NEURAL BIO-FEEDBACK: ACTIVE
              </Text>
            </View>
            <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: '700', color: THEME.textSecondary }}>
                TARGET: {presetDuration} MIN
              </Text>
            </View>
          </View>

          {/* Large Monospace Clinical Timer */}
          <Text style={{ fontSize: 46, fontFamily: 'monospace', fontWeight: '900', color: THEME.textPrimary, letterSpacing: -1, marginTop: 2 }}>
            {fmtTimer(sessionSeconds)}
          </Text>

          {/* Precision Target Progress Bar */}
          <View style={{ width: '100%', height: 5, backgroundColor: '#E2E8F0', borderRadius: 2.5, marginTop: 4, overflow: 'hidden' }}>
            <View style={{ width: `${progressPct}%`, height: '100%', backgroundColor: THEME.accentPink, borderRadius: 2.5 }} />
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

          {/* AI Neural Diagnostics Banner (Lite) */}
          <View style={styles.aiDiagnosticCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="chip" size={16} color={THEME.accentBlue} />
                <Text style={{ fontSize: 11, fontWeight: '800', color: THEME.accentBlue, letterSpacing: 0.8 }}>
                  NEURAL DIAGNOSTIC INFERENCE
                </Text>
              </View>
              <Text style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: '700', color: THEME.textMuted }}>
                LATENCY: 8ms
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: contraction.bg, borderWidth: 1, borderColor: contraction.borderColor, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, gap: 6 }}>
                <MaterialCommunityIcons name={contraction.iconName} size={15} color={contraction.color} />
                <Text style={{ fontSize: 11, fontWeight: '800', color: contraction.color, letterSpacing: 0.5 }}>
                  {contraction.text}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: '800', color: THEME.accentPurple }}>
                  RMS: {currentEmgRms} µV
                </Text>
                <Text style={{ fontSize: 10, color: THEME.textMuted }}>Pelvic Tone: {rawAnalog}</Text>
              </View>
            </View>
          </View>

          {/* ───────────────────────────────────────────────────────────────────
              PANEL 1: VIBRATION & NEURO-ACTUATION CONTROL
             ─────────────────────────────────────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.panelIconBox}>
                  <MaterialCommunityIcons name="waveform" size={18} color={THEME.accentPink} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>VIBRATION ACTUATOR CONTROL</Text>
                  <Text style={styles.cardSubtitle}>PWM Frequency & Intensity Duty</Text>
                </View>
              </View>
              <PrecisionToggle value={vibEnabled} onChange={handleVibToggle} />
            </View>

            {/* Intensity Readout */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={{ fontSize: 28, fontFamily: 'monospace', fontWeight: '900', color: THEME.accentPink }}>
                  {vibEnabled ? `${Math.round(vibIntensity)}%` : 'OFF'}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: THEME.textSecondary }}>
                  Speed {vibIntensity < 35 ? 'Low' : vibIntensity < 75 ? 'Medium' : 'High'}
                </Text>
              </View>
              <View style={{ backgroundColor: vibEnabled ? '#D1FAE5' : '#F1F5F9', borderWidth: 1, borderColor: vibEnabled ? '#A7F3D0' : '#E2E8F0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: '800', color: vibEnabled ? THEME.accentGreen : THEME.textMuted }}>
                  {vibEnabled ? `ACTIVE • ${vibMode.toUpperCase()}` : 'ACTUATOR IDLE'}
                </Text>
              </View>
            </View>

            {/* Continuous Slider Low to High */}
            <PrecisionSlider
              value={vibIntensity}
              min={0}
              max={100}
              onChange={handleVibIntensityChange}
              disabled={!vibEnabled}
            />

            {/* Discrete Speed Levels */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              {[
                { label: 'Low (30%)', val: 30 },
                { label: 'Med (65%)', val: 65 },
                { label: 'High (95%)', val: 95 },
              ].map((lvl) => (
                <TouchableOpacity
                  key={lvl.label}
                  disabled={!vibEnabled}
                  onPress={() => handleVibIntensityChange(lvl.val)}
                  style={[
                    styles.quickChip,
                    Math.abs(vibIntensity - lvl.val) < 15 && vibEnabled && styles.quickChipActive,
                    !vibEnabled && { opacity: 0.5 },
                  ]}
                >
                  <Text style={[styles.quickChipText, Math.abs(vibIntensity - lvl.val) < 15 && vibEnabled && styles.quickChipTextActive]}>
                    {lvl.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Modes */}
            <Text style={styles.subHeading}>NEURO-STIMULATION PATTERN</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {VIB_MODES.map((m) => {
                const active = vibMode === m;
                return (
                  <TouchableOpacity
                    key={m}
                    disabled={!vibEnabled}
                    onPress={() => handleVibModeChange(m)}
                    style={[styles.modeChip, active && styles.modeChipActive, !vibEnabled && { opacity: 0.5 }]}
                  >
                    <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ───────────────────────────────────────────────────────────────────
              PANEL 2: PRECISION PID HEATING CONTROL
             ─────────────────────────────────────────────────────────────────── */}
          <View style={[styles.card, { marginTop: 14 }]}>
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.panelIconBox, { backgroundColor: '#FFF1F2', borderColor: '#FFE4E6' }]}>
                  <MaterialCommunityIcons name="fire" size={18} color={THEME.accentPink} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>PID THERMAL REGULATION</Text>
                  <Text style={styles.cardSubtitle}>Dual Thermal Closed-Loop Control</Text>
                </View>
              </View>
              <PrecisionToggle value={heatEnabled} onChange={handleHeatToggle} />
            </View>

            {/* Circular Gauge */}
            <ClinicalTempRing current={currentTemp} target={targetTemp} />

            {/* Target Stepper */}
            <View style={styles.tempAdjusterBox}>
              <TouchableOpacity onPress={() => adjustTarget(-0.5)} style={styles.stepperBtn}>
                <Feather name="minus" size={18} color={THEME.textPrimary} />
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: '800', color: THEME.textPrimary }}>
                  {targetTemp.toFixed(1)}°C SETPOINT
                </Text>
                <Text style={{ fontSize: 10, color: THEME.textMuted }}>Safe Thermal Envelope: 36.0°C – 43.0°C</Text>
              </View>
              <TouchableOpacity onPress={() => adjustTarget(0.5)} style={styles.stepperBtn}>
                <Feather name="plus" size={18} color={THEME.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Presets */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              {[
                { label: '38.0°C Gentle', temp: 38 },
                { label: '40.0°C Therapeutic', temp: 40 },
                { label: '42.0°C Deep Relief', temp: 42 },
              ].map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  onPress={() => {
                    setTargetTemp(preset.temp);
                    if (sessionActive) sendCommand({ target_temp: preset.temp }).catch(() => {});
                  }}
                  style={[styles.quickChip, targetTemp === preset.temp && styles.quickChipActive]}
                >
                  <Text style={[styles.quickChipText, targetTemp === preset.temp && styles.quickChipTextActive]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ───────────────────────────────────────────────────────────────────
              PANEL 3: TRI-AXIAL IMU DYNAMICS (ALL-IN-ONE XYZ GRAPH)
             ─────────────────────────────────────────────────────────────────── */}
          <View style={[styles.card, { marginTop: 14 }]}>
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.panelIconBox, { backgroundColor: '#F0F9FF', borderColor: '#E0F2FE' }]}>
                  <MaterialCommunityIcons name="axis-arrow" size={18} color={THEME.accentBlue} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>TRI-AXIAL IMU DYNAMICS (ALL-IN-ONE XYZ)</Text>
                  <Text style={styles.cardSubtitle}>Vector Accelerometer Oscilloscope (MPU6050)</Text>
                </View>
              </View>
              <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: '700', color: THEME.accentBlue }}>MPU6050</Text>
              </View>
            </View>

            {/* All in one XYZ Combined Graph */}
            <GyroCombinedGraph data={gyroPoints} height={100} />

            {/* Statistics */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <View style={styles.telemetryStatCard}>
                <Text style={styles.telemetryStatLbl}>AVG MOTION</Text>
                <Text style={styles.telemetryStatVal}>{imuMetrics.avgMovement} g</Text>
              </View>
              <View style={styles.telemetryStatCard}>
                <Text style={styles.telemetryStatLbl}>PEAK DYNAMICS</Text>
                <Text style={styles.telemetryStatVal}>{imuMetrics.maxMovement} g</Text>
              </View>
              <View style={styles.telemetryStatCard}>
                <Text style={styles.telemetryStatLbl}>POSTURAL STATE</Text>
                <Text style={[styles.telemetryStatVal, { color: THEME.accentGreen, fontSize: 11 }]}>
                  {imuMetrics.postureText}
                </Text>
              </View>
            </View>
          </View>

          {/* ───────────────────────────────────────────────────────────────────
              PANEL 4: DS18B20 CLINICAL TEMPERATURE MONITOR
             ─────────────────────────────────────────────────────────────────── */}
          <View style={[styles.card, { marginTop: 14 }]}>
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.panelIconBox, { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' }]}>
                  <MaterialCommunityIcons name="thermometer-lines" size={18} color="#DC2626" />
                </View>
                <View>
                  <Text style={styles.cardTitle}>DS18B20 CLINICAL TEMPERATURE</Text>
                  <Text style={styles.cardSubtitle}>Belt Probe Sensor Telemetry</Text>
                </View>
              </View>
              <View style={{ backgroundColor: currentTemp <= 43 ? '#D1FAE5' : '#FEE2E2', borderWidth: 1, borderColor: currentTemp <= 43 ? '#A7F3D0' : '#FECACA', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: '800', color: currentTemp <= 43 ? THEME.accentGreen : '#DC2626' }}>
                  {currentTemp <= 43 ? 'THERMAL NORMAL' : 'OVERHEAT ALERT'}
                </Text>
              </View>
            </View>

            {/* Readouts */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 10 }}>
              <View>
                <Text style={{ fontSize: 34, fontFamily: 'monospace', fontWeight: '900', color: '#DC2626', letterSpacing: -1 }}>
                  {currentTemp.toFixed(1)}°C
                </Text>
                <Text style={{ fontSize: 10, color: THEME.textMuted, marginTop: 1 }}>PROBE READING</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 14 }}>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: '800', color: THEME.textPrimary }}>
                    {sessionAvgTemp}°C
                  </Text>
                  <Text style={{ fontSize: 10, color: THEME.textMuted }}>SESSION AVG</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: '800', color: '#E11D48' }}>
                    {sessionMaxTemp}°C
                  </Text>
                  <Text style={{ fontSize: 10, color: THEME.textMuted }}>PEAK REACHED</Text>
                </View>
              </View>
            </View>

            <Text style={styles.subHeading}>TEMPERATURE TREND TELEMETRY (°C)</Text>
            <TempTrendGraph data={tempPoints} height={65} />
          </View>

          {/* ───────────────────────────────────────────────────────────────────
              PANEL 5: BIOAMP MUSCLE ACTIVITY & RMS ANALYZER
             ─────────────────────────────────────────────────────────────────── */}
          <View style={[styles.card, { marginTop: 14 }]}>
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.panelIconBox, { backgroundColor: '#F3E8FF', borderColor: '#E9D5FF' }]}>
                  <MaterialCommunityIcons name="sine-wave" size={18} color={THEME.accentPurple} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>BIOAMP MUSCLE ACTIVITY (EMG)</Text>
                  <Text style={styles.cardSubtitle}>Pelvic & Uterine Tone Analysis</Text>
                </View>
              </View>
              <View style={{ backgroundColor: '#F3E8FF', borderWidth: 1, borderColor: '#DDD6FE', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: '700', color: THEME.accentPurple }}>AFE 10-BIT</Text>
              </View>
            </View>

            {/* Contraction Words Badge & Live EMG RMS */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: contraction.bg, borderWidth: 1, borderColor: contraction.borderColor, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, gap: 6 }}>
                <MaterialCommunityIcons name={contraction.iconName} size={15} color={contraction.color} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: contraction.color, letterSpacing: 0.5 }}>
                  {contraction.text}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <View style={{ backgroundColor: '#F3E8FF', borderWidth: 1, borderColor: '#DDD6FE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                  <Text style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: '800', color: THEME.accentPurple }}>
                    RMS: {currentEmgRms} µV
                  </Text>
                </View>
                <Text style={{ fontSize: 10, color: THEME.textMuted, marginTop: 2 }}>ADC RAW: {rawAnalog}</Text>
              </View>
            </View>

            {/* Waveform */}
            <BioAmpWaveform points={emgPoints} height={85} />
          </View>

          {/* Terminate Session Button */}
          <TouchableOpacity
            onPress={() => setShowEndModal(true)}
            style={styles.endBtn}
            activeOpacity={0.85}
          >
            <Feather name="stop-circle" size={18} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14, letterSpacing: 1, marginLeft: 8 }}>
              TERMINATE RELIEF SESSION
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <EndSessionModal
          visible={showEndModal}
          onEnd={handleEndSession}
          onCancel={() => setShowEndModal(false)}
          painBefore={painLevel}
          elapsedSecs={sessionSeconds}
        />
      </SafeAreaView>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PREPARE RELIEF SESSION SCREEN (LITE THEME)
  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      {/* Device Connection Bar */}
      {!isConnected ? (
        <TouchableOpacity
          onPress={() => router.push('/ble-device' as any)}
          style={styles.connectBanner}
        >
          <Feather name="bluetooth" size={15} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginLeft: 8, flex: 1 }}>
            No belt connected. Tap to pair Her Comfort device.
          </Text>
          <Feather name="chevron-right" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      ) : (
        <View style={styles.connectedDeviceBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: THEME.accentGreen }} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: THEME.accentGreen }}>
              HER COMFORT BELT ONLINE • {connectedDevice?.name ?? 'BLE LINKED'}
            </Text>
          </View>
          <Text style={{ fontSize: 10, fontFamily: 'monospace', color: THEME.textSecondary }}>
            DS18B20 • MPU6050
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ marginBottom: 14, marginTop: 4 }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: THEME.textPrimary, letterSpacing: -0.5 }}>
            Prepare Relief Session
          </Text>
          <Text style={{ fontSize: 12, color: THEME.textSecondary, marginTop: 2 }}>
            AI Closed-Loop Thermal & Neuro-Stimulation Protocol
          </Text>
        </View>

        {/* Pain Assessment */}
        <View style={styles.card}>
          <Text style={styles.sectionHeaderTitle}>PRE-SESSION PAIN ASSESSMENT</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: THEME.textPrimary }}>Current Pain Score</Text>
            <View style={{ backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
              <Text style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: '800', color: painLevel >= 7 ? '#DC2626' : painLevel >= 4 ? '#D97706' : THEME.accentGreen }}>
                {painLevel >= 7 ? 'SEVERE' : painLevel >= 4 ? 'MODERATE' : 'MILD'} ({painLevel}/10)
              </Text>
            </View>
          </View>

          <ClinicalPainScale value={painLevel} onChange={setPainLevel} />

          {/* Location */}
          <Text style={[styles.subHeading, { marginTop: 18 }]}>PRIMARY ANATOMICAL LOCATION</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {PAIN_LOCATIONS.map((loc) => {
              const sel = location === loc;
              return (
                <TouchableOpacity
                  key={loc}
                  onPress={() => setLocation(loc)}
                  style={[styles.chip, sel && styles.chipActive]}
                >
                  <Text style={[styles.chipText, sel && styles.chipTextActive]}>
                    {loc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Symptoms */}
          <Text style={[styles.subHeading, { marginTop: 18 }]}>ASSOCIATED CLINICAL SYMPTOMS</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {CLINICAL_SYMPTOMS.map(({ key, label }) => {
              const sel = symptoms.includes(key);
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => toggleSymptom(key)}
                  style={[styles.chip, sel && styles.chipActive]}
                >
                  <Text style={[styles.chipText, sel && styles.chipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Session Duration Selector */}
        <View style={[styles.card, { marginTop: 14 }]}>
          <Text style={styles.sectionHeaderTitle}>SESSION TARGET DURATION</Text>
          <Text style={{ fontSize: 11, color: THEME.textSecondary, marginTop: 2, marginBottom: 10 }}>
            Default preset is 10–15 min. You can end anytime and your exact duration will be saved to MongoDB.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {DURATION_PRESETS.map((dur) => {
              const active = presetDuration === dur;
              return (
                <TouchableOpacity
                  key={dur}
                  onPress={() => setPresetDuration(dur)}
                  style={[styles.durChip, active && styles.durChipActive]}
                >
                  <Text style={[styles.durChipText, active && styles.durChipTextActive]}>
                    {dur} MIN
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Start Session Button */}
        <TouchableOpacity
          onPress={handleStartSession}
          style={[styles.startBtn, !isConnected && { opacity: 0.6 }]}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="lightning-bolt" size={18} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 15, letterSpacing: 1.2, marginLeft: 8 }}>
            INITIATE RELIEF THERAPY
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Stylesheet (Lite UI) ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.cardBg,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  panelIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FCE7F3',
    borderWidth: 1,
    borderColor: '#FBCFE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: THEME.textPrimary,
    letterSpacing: 0.5,
  },
  cardSubtitle: {
    fontSize: 10,
    color: THEME.textSecondary,
    marginTop: 1,
  },
  subHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 14,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  connectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.accentPink,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  connectedDeviceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  activeHeaderBar: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  aiDiagnosticCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  oscilloscopeContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  telemetryStatCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  telemetryStatLbl: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.textSecondary,
  },
  telemetryStatVal: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '800',
    color: THEME.textPrimary,
    marginTop: 2,
  },
  tempAdjusterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  quickChipActive: {
    backgroundColor: '#FCE7F3',
    borderColor: THEME.accentPink,
  },
  quickChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  quickChipTextActive: {
    color: THEME.accentPink,
    fontWeight: '800',
  },
  modeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modeChipActive: {
    backgroundColor: THEME.accentPink,
    borderColor: THEME.accentPink,
  },
  modeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  modeChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#FCE7F3',
    borderColor: THEME.accentPink,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  chipTextActive: {
    color: THEME.accentPink,
    fontWeight: '800',
  },
  durChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  durChipActive: {
    backgroundColor: '#FCE7F3',
    borderColor: THEME.accentPink,
  },
  durChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.textSecondary,
  },
  durChipTextActive: {
    color: THEME.accentPink,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.accentPink,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 20,
    shadowColor: THEME.accentPink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 20,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },

});
