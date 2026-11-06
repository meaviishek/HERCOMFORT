/**
 * session.tsx  -  Nari App  Her Comfort BLE Session Dashboard
 *
 * Firmware JSON (ESP32-C6):
 *   {"temperature":35.75,"position":"UPRIGHT","bodyAngle":1.0,
 *    "motorMode":"OFF","motorSpeed":100,"heater":"OFF",
 *    "heaterSetpoint":40.0,"emg":6}
 *
 * BLE write commands (raw UTF-8 string to characteristic 9001):
 *   MOTOR:ON | MOTOR:OFF
 *   MODE:CONTINUOUS | MODE:PULSE | MODE:HARMONIC
 *   SPEED:0 - SPEED:100
 *   HEATER:ON | HEATER:OFF
 *   SETPOINT:36 - SETPOINT:40
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import Svg, { Line, Path, Polyline, Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { CONNECTION_STATUS, useBluetooth } from '../../context/BluetoothContext';
import sessionService from '../../services/sessionService';
import ApiService from '../../services/ApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HERO_IMG = require('../../assets/images/comfort-hero.png');

const { width } = Dimensions.get('window');

// Theme
const T = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  pink: '#E84EA1',
  blue: '#0284C7',
  green: '#059669',
  amber: '#D97706',
  purple: '#7C3AED',
  red: '#DC2626',
  text: '#0F172A',
  sub: '#475569',
  muted: '#94A3B8',
  canvas: '#F1F5F9',
};

const LINE_TEMP   = '#DC2626';
const LINE_ANGLE  = '#0284C7';
const LINE_SPEED  = '#E84EA1';
const LINE_EMG    = '#7C3AED';
const LINE_HEATER = '#D97706';

function fmtTimer(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// EMG classification using firmware thresholds
function classifyEMG(emg: number): {
  label: string; color: string; bg: string;
  icon: 'check-circle-outline' | 'shield-check-outline' | 'alert-outline' | 'alert-circle-outline';
  desc: string;
} {
  if (emg >= 80) return { label: 'EXTREME CONTRACTION', color: '#9B1C1C', bg: '#FEE2E2', icon: 'alert-circle-outline', desc: 'Immediate attention recommended' };
  if (emg >= 50) return { label: 'HIGH TIGHTNESS', color: T.red, bg: '#FEF2F2', icon: 'alert-outline', desc: 'Significant muscle tension detected' };
  if (emg >= 35) return { label: 'SLIGHTLY TIGHT', color: T.amber, bg: '#FEF9EC', icon: 'shield-check-outline', desc: 'Mild muscle activation detected' };
  if (emg >= 20) return { label: 'RELAXED', color: T.green, bg: '#ECFDF5', icon: 'check-circle-outline', desc: 'Comfortable resting state' };
  return { label: 'MUSCLE FREE', color: T.blue, bg: '#EFF6FF', icon: 'check-circle-outline', desc: 'Baseline - muscle at rest' };
}

function getPositionConfig(pos: string | undefined): {
  icon: string; color: string; bg: string; label: string; sub: string;
} {
  switch ((pos || 'UNKNOWN').toUpperCase()) {
    case 'UPRIGHT':  return { icon: 'human',              color: T.green,  bg: '#ECFDF5', label: 'UPRIGHT',      sub: 'Standing / Sitting straight' };
    case 'WALKING':  return { icon: 'walk',               color: T.blue,   bg: '#EFF6FF', label: 'WALKING',      sub: 'Kinematic activity detected' };
    case 'LYING':    return { icon: 'sleep',              color: T.purple, bg: '#F5F3FF', label: 'LYING DOWN',   sub: 'Horizontal rest position' };
    default:         return { icon: 'help-circle-outline',color: T.muted,  bg: T.canvas,  label: 'UNKNOWN',      sub: 'Calibrating sensor...' };
  }
}

// Precision slider
function PrecisionSlider({
  value, min, max, onChange, disabled = false, color = T.pink,
}: {
  value: number; min: number; max: number;
  onChange: (v: number) => void; disabled?: boolean; color?: string;
}) {
  const trackW = width - 80;
  const thumbX = useRef(new Animated.Value(((value - min) / (max - min)) * trackW)).current;
  const trackRef = useRef<View>(null);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (e) => {
        trackRef.current?.measure((_fx, _fy, _w, _h, px) => {
          const rel = Math.max(0, Math.min(trackW, e.nativeEvent.pageX - px));
          thumbX.setValue(rel); onChange(min + (rel / trackW) * (max - min));
        });
      },
      onPanResponderMove: (e) => {
        trackRef.current?.measure((_fx, _fy, _w, _h, px) => {
          const rel = Math.max(0, Math.min(trackW, e.nativeEvent.pageX - px));
          thumbX.setValue(rel); onChange(min + (rel / trackW) * (max - min));
        });
      },
    })
  ).current;
  useEffect(() => { thumbX.setValue(((value - min) / (max - min)) * trackW); }, [value, min, max, trackW]);
  return (
    <View ref={trackRef} style={{ height: 38, justifyContent: 'center', width: trackW }} {...pan.panHandlers}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: '#E2E8F0', width: trackW }}>
        <Animated.View style={{
          height: 6, borderRadius: 3, backgroundColor: disabled ? '#CBD5E1' : color,
          width: thumbX.interpolate({ inputRange: [0, trackW], outputRange: ['0%', '100%'] }),
        }} />
      </View>
      <Animated.View style={{
        position: 'absolute', width: 22, height: 22, borderRadius: 11,
        backgroundColor: '#FFF', borderWidth: 3, borderColor: disabled ? '#CBD5E1' : color,
        elevation: 4, shadowColor: color, shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
        transform: [{ translateX: thumbX.interpolate({ inputRange: [0, trackW], outputRange: [-11, trackW - 11] }) }],
      }} />
    </View>
  );
}

function getPainScoreBadge(val: number): { label: string; bg: string; text: string } {
  if (val === 0) return { label: 'No Pain (0/10)', bg: '#ECFDF5', text: '#059669' };
  if (val <= 3) return { label: `Mild (${val}/10)`, bg: '#ECFDF5', text: '#059669' };
  if (val <= 6) return { label: `Moderate (${val}/10)`, bg: '#FEF3C7', text: '#D97706' };
  return { label: `Severe (${val}/10)`, bg: '#FEE2E2', text: '#DC2626' };
}

// Pain scale matching design
function PainScale({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
        {Array.from({ length: 11 }, (_, i) => {
          const sel = i === value;
          return (
            <TouchableOpacity key={i} onPress={() => onChange(i)} hitSlop={{ top: 8, bottom: 8, left: 3, right: 3 }}>
              <View
                style={{
                  width: Math.floor((width - 76) / 11),
                  height: 34,
                  borderRadius: 8,
                  backgroundColor: sel ? T.pink : '#FDF2F8',
                  borderWidth: sel ? 1.5 : 0,
                  borderColor: T.pink,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: sel ? '900' : '700', color: sel ? '#FFF' : '#E84EA1' }}>
                  {i}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: T.sub }}>No Pain</Text>
        <Text style={{ fontSize: 11, fontWeight: '600', color: T.sub }}>Moderate</Text>
        <Text style={{ fontSize: 11, fontWeight: '600', color: T.sub }}>Severe</Text>
      </View>
    </View>
  );
}

// Unified Telemetry Graph - 5 series on one canvas
type GraphPoint = { temp: number; bodyAngle: number; motorSpeed: number; emg: number; heater: number };

function TelemetryGraph({ data }: { data: GraphPoint[] }) {
  const gH = 190;
  const gW = width - 48;
  const pts = data.slice(-60);
  const n = Math.max(pts.length - 1, 1);

  const ranges = {
    temp:       { min: 34, max: 42 },
    bodyAngle:  { min: 0,  max: 90 },
    motorSpeed: { min: 0,  max: 100 },
    emg:        { min: 0,  max: 100 },
    heater:     { min: 0,  max: 1 },
  };

  const toY = (norm: number) => Math.max(8, Math.min(gH - 8, gH - 8 - norm * (gH - 24)));
  const norm = (v: number, key: keyof typeof ranges) => {
    const { min, max } = ranges[key];
    return Math.max(0, Math.min(1, (v - min) / (max - min)));
  };
  const polyline = (key: keyof typeof ranges) =>
    pts.map((p, i) => `${((i / n) * gW).toFixed(1)},${toY(norm((p as any)[key], key)).toFixed(1)}`).join(' ');

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map(f => toY(f).toFixed(1));

  const legend = [
    { label: 'Temp(C)',  color: LINE_TEMP   },
    { label: 'Angle()', color: LINE_ANGLE  },
    { label: 'Motor%',  color: LINE_SPEED  },
    { label: 'EMG',     color: LINE_EMG    },
    { label: 'Heater',  color: LINE_HEATER },
  ];

  const last = pts.length > 0 ? pts[pts.length - 1] : null;

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {legend.map(l => (
          <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 10, height: 4, borderRadius: 2, backgroundColor: l.color }} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: T.sub }}>{l.label}</Text>
          </View>
        ))}
      </View>
      <View style={{ height: gH, width: gW, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: T.border, overflow: 'hidden' }}>
        <Svg width={gW} height={gH}>
          {gridYs.map((y, i) => (
            <Line key={i} x1="0" y1={y} x2={String(gW)} y2={y}
              stroke={i === 2 ? '#CBD5E1' : '#E2E8F0'} strokeWidth={i === 2 ? 1.2 : 0.8} strokeDasharray="4 4" />
          ))}
          {pts.length > 1 && (
            <>
              <Polyline points={polyline('temp')}       fill="none" stroke={LINE_TEMP}   strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <Polyline points={polyline('bodyAngle')}  fill="none" stroke={LINE_ANGLE}  strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <Polyline points={polyline('motorSpeed')} fill="none" stroke={LINE_SPEED}  strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <Polyline points={polyline('emg')}        fill="none" stroke={LINE_EMG}    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <Polyline points={polyline('heater')}     fill="none" stroke={LINE_HEATER} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 4" />
            </>
          )}
          {last && (
            <>
              <Circle cx={String(gW - 4)} cy={toY(norm(last.temp, 'temp')).toFixed(1)}           r="4" fill={LINE_TEMP}   />
              <Circle cx={String(gW - 4)} cy={toY(norm(last.bodyAngle, 'bodyAngle')).toFixed(1)} r="4" fill={LINE_ANGLE}  />
              <Circle cx={String(gW - 4)} cy={toY(norm(last.motorSpeed, 'motorSpeed')).toFixed(1)} r="4" fill={LINE_SPEED}  />
              <Circle cx={String(gW - 4)} cy={toY(norm(last.emg, 'emg')).toFixed(1)}             r="4" fill={LINE_EMG}    />
            </>
          )}
        </Svg>
      </View>
      {last && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 }}>
          {[
            { l: 'TEMP',  v: `${last.temp.toFixed(1)}C`,    c: LINE_TEMP   },
            { l: 'ANGLE', v: `${last.bodyAngle.toFixed(0)}`, c: LINE_ANGLE  },
            { l: 'MOTOR', v: `${last.motorSpeed}%`,          c: LINE_SPEED  },
            { l: 'EMG',   v: String(last.emg),               c: LINE_EMG    },
            { l: 'HEAT',  v: last.heater ? 'ON' : 'OFF',     c: LINE_HEATER },
          ].map(({ l, v, c }) => (
            <View key={l} style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: T.muted }}>{l}</Text>
              <Text style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: '900', color: c, marginTop: 1 }}>{v}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// End Session Modal (Fix 2 + Phase 2 Pilot Feedback)
export interface SessionEndData {
  painAfter: number;
  painPostConfirmed: boolean;
  painPost15?: number | null;
  comfortScore?: number;
  adverseEvent?: boolean;
  adverseCategory?: string;
  adverseSeverity?: string;
  earlyTerminationReason?: string;
}

function EndSessionModal({
  visible, onEnd, onCancel, painBefore, elapsedSecs, isPilot = false,
}: {
  visible: boolean;
  onEnd: (data: SessionEndData) => void;
  onCancel: () => void;
  painBefore: number;
  elapsedSecs: number;
  isPilot?: boolean;
}) {
  const [painAfter, setPainAfter] = useState<number | null>(null);
  const [painPost15, setPainPost15] = useState<number | null>(null);
  const [comfortScore, setComfortScore] = useState<number>(4);
  const [hasAdverse, setHasAdverse] = useState<boolean>(false);
  const [adverseCategory, setAdverseCategory] = useState<string>('NONE');
  const [adverseSeverity, setAdverseSeverity] = useState<string>('NONE');
  const [earlyReason, setEarlyReason] = useState<string>('NONE');
  const [showExtended, setShowExtended] = useState<boolean>(isPilot);

  const confirmed = painAfter !== null;
  const mins = Math.max(1, Math.round(elapsedSecs / 60));

  const handleSave = () => {
    if (!confirmed) return;
    onEnd({
      painAfter: painAfter!,
      painPostConfirmed: true,
      painPost15: painPost15,
      comfortScore,
      adverseEvent: hasAdverse,
      adverseCategory: hasAdverse ? adverseCategory : 'NONE',
      adverseSeverity: hasAdverse ? adverseSeverity : 'NONE',
      earlyTerminationReason: earlyReason,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' }}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: T.text, letterSpacing: -0.3 }}>
                {isPilot ? '🔬 PILOT SESSION COMPLETION' : 'END RELIEF SESSION'}
              </Text>
              <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: '700', color: T.blue }}>
                  {mins} MIN ({fmtTimer(elapsedSecs)})
                </Text>
              </View>
            </View>

            {/* Instruction banner */}
            <Text style={{ color: confirmed ? T.green : T.amber, fontSize: 12, fontWeight: '700', marginBottom: 10 }}>
              {confirmed ? `✓ Immediate pain recorded: ${painAfter}/10` : '⚠ Tap your current pain level below to enable Save.'}
            </Text>

            {/* Pain Comparison Bar */}
            <View style={{ flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, marginBottom: 14 }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 22, fontFamily: 'monospace', fontWeight: '900', color: T.red }}>{painBefore}/10</Text>
                <Text style={{ fontSize: 9.5, fontWeight: '700', color: T.muted, marginTop: 2 }}>INITIAL PAIN</Text>
              </View>
              <Feather name="arrow-right" size={18} color={T.sub} style={{ alignSelf: 'center' }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 22, fontFamily: 'monospace', fontWeight: '900', color: confirmed ? T.green : T.muted }}>
                  {confirmed ? `${painAfter}/10` : '—'}
                </Text>
                <Text style={{ fontSize: 9.5, fontWeight: '700', color: T.muted, marginTop: 2 }}>POST PAIN (T=0)</Text>
              </View>
            </View>

            <PainScale value={painAfter ?? -1} onChange={setPainAfter} />

            {/* Comfort Score Selector */}
            <View style={{ marginTop: 14, padding: 12, backgroundColor: '#FAF5FF', borderRadius: 14, borderWidth: 1, borderColor: '#F3E8FF' }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: T.purple, marginBottom: 6 }}>THERAPY COMFORT RATING</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setComfortScore(star)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: comfortScore === star ? T.purple : '#FFF',
                      borderWidth: 1,
                      borderColor: comfortScore === star ? T.purple : '#E9D5FF',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: comfortScore === star ? '#FFF' : T.purple }}>
                      {star}★
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Pilot / Extended Safety Section */}
            <View style={{ marginTop: 12, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <TouchableOpacity
                onPress={() => setShowExtended(!showExtended)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialCommunityIcons name="shield-alert-outline" size={16} color={hasAdverse ? T.red : T.sub} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: hasAdverse ? T.red : T.text }}>
                    {isPilot ? 'Pilot Safety & Adverse Events (Required)' : 'Safety & Reaction Reporting'}
                  </Text>
                </View>
                <Feather name={showExtended ? 'chevron-up' : 'chevron-down'} size={16} color={T.sub} />
              </TouchableOpacity>

              {showExtended && (
                <View style={{ marginTop: 10, gap: 10 }}>
                  {/* Adverse Event Toggle */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 11.5, color: T.sub, fontWeight: '600' }}>Any adverse reaction or discomfort?</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => { setHasAdverse(false); setAdverseCategory('NONE'); setAdverseSeverity('NONE'); }}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 8,
                          backgroundColor: !hasAdverse ? T.green : '#E2E8F0',
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: !hasAdverse ? '#FFF' : T.sub }}>No</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => { setHasAdverse(true); if (adverseCategory === 'NONE') setAdverseCategory('MILD_ERYTHEMA'); if (adverseSeverity === 'NONE') setAdverseSeverity('MILD'); }}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 8,
                          backgroundColor: hasAdverse ? T.red : '#E2E8F0',
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: hasAdverse ? '#FFF' : T.sub }}>Yes</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {hasAdverse && (
                    <View style={{ backgroundColor: '#FEF2F2', padding: 10, borderRadius: 10, gap: 8 }}>
                      <Text style={{ fontSize: 10.5, fontWeight: '800', color: T.red }}>ADVERSE EVENT CATEGORY</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {['MILD_ERYTHEMA', 'SKIN_BURNING', 'NUMBNESS', 'NAUSEA', 'DIZZINESS', 'OTHER'].map((cat) => (
                          <TouchableOpacity
                            key={cat}
                            onPress={() => setAdverseCategory(cat)}
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 6,
                              backgroundColor: adverseCategory === cat ? T.red : '#FFF',
                              borderWidth: 1,
                              borderColor: '#FCA5A5',
                            }}
                          >
                            <Text style={{ fontSize: 9.5, fontWeight: '700', color: adverseCategory === cat ? '#FFF' : T.red }}>
                              {cat.replace('_', ' ')}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={{ fontSize: 10.5, fontWeight: '800', color: T.red, marginTop: 4 }}>SEVERITY</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {['MILD', 'MODERATE', 'SEVERE'].map((sev) => (
                          <TouchableOpacity
                            key={sev}
                            onPress={() => setAdverseSeverity(sev)}
                            style={{
                              flex: 1,
                              paddingVertical: 6,
                              borderRadius: 6,
                              backgroundColor: adverseSeverity === sev ? T.red : '#FFF',
                              borderWidth: 1,
                              borderColor: '#FCA5A5',
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '800', color: adverseSeverity === sev ? '#FFF' : T.red }}>
                              {sev}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {adverseSeverity === 'MODERATE' || adverseSeverity === 'SEVERE' ? (
                        <Text style={{ fontSize: 10, color: '#991B1B', fontWeight: '600' }}>
                          ⚠️ Moderate or severe events will be flagged and temporarily suspend further sessions until supervisor review.
                        </Text>
                      ) : null}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 18, marginBottom: 12 }}>
              <TouchableOpacity onPress={onCancel} style={{ flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: T.border, padding: 14, alignItems: 'center' }}>
                <Text style={{ fontWeight: '700', color: T.sub, fontSize: 13 }}>RESUME</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={!confirmed}
                style={{ flex: 1, borderRadius: 14, backgroundColor: confirmed ? T.pink : '#CBD5E1', padding: 14, alignItems: 'center' }}
              >
                <Text style={{ fontWeight: '800', color: '#FFF', fontSize: 13 }}>SAVE SESSION</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Constants
const PAIN_LOCS = [
  { id: 'Lower Abdomen', label: 'Lower Abdomen', icon: 'human-female' },
  { id: 'Lower Back',    label: 'Lower Back',    icon: 'human-handsdown' },
  { id: 'Pelvic Floor',  label: 'Pelvic Floor',  icon: 'shield-cross-outline' },
  { id: 'Suprapubic',    label: 'Suprapubic',    icon: 'cup-outline' },
];

const SYMPTOMS_CFG = [
  { key: 'Cramping', label: 'Cramping', icon: 'lightning-bolt-outline' },
  { key: 'Fatigue',  label: 'Fatigue',  icon: 'battery-alert-variant-outline' },
  { key: 'Bloating', label: 'Bloating', icon: 'stomach' },
  { key: 'Nausea',   label: 'Nausea',   icon: 'emoticon-sick-outline' },
  { key: 'Cephalea', label: 'Cephalea', icon: 'head-snowflake-outline' },
];
const DURATION_PRESETS = [10, 15, 20, 30];

type MotorMode = 'OFF' | 'CONTINUOUS' | 'PULSE' | 'HARMONIC';
const MOTOR_MODES: { id: MotorMode; label: string; icon: string; color: string }[] = [
  { id: 'CONTINUOUS', label: 'Continuous', icon: 'sine-wave', color: T.blue   },
  { id: 'PULSE',      label: 'Pulse',      icon: 'pulse',     color: T.pink   },
  { id: 'HARMONIC',   label: 'Harmonic',   icon: 'waveform',  color: T.purple },
  { id: 'OFF',        label: 'Off',        icon: 'power-off', color: T.muted  },
];

// Main screen
export default function SessionScreen() {
  const router = useRouter();
  const { connectedDevice, connectionStatus, liveData, sendCommand, startDemo } = useBluetooth();
  const isConnected = connectionStatus === CONNECTION_STATUS.CONNECTED;

  const [painLevel,      setPainLevel]      = useState(5);
  const [location,       setLocation]       = useState('Lower Abdomen');
  const [symptoms,       setSymptoms]       = useState<string[]>(['Cramping']);
  const [presetDuration, setPresetDuration] = useState(15);
  const [sessionActive,  setSessionActive]  = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [showEndModal,   setShowEndModal]   = useState(false);
  const [motorEnabled,   setMotorEnabled]   = useState(false);
  const [motorMode,      setMotorMode]      = useState<MotorMode>('CONTINUOUS');
  const [motorSpeed,     setMotorSpeed]     = useState(100);
  const [heaterEnabled,  setHeaterEnabled]  = useState(false);
  const [heaterSetpoint, setHeaterSetpoint] = useState(40.0);
  const [graphData,      setGraphData]      = useState<GraphPoint[]>([]);

  // ── AI Prescription State ──────────────────────────────────────────────────
  type AIPrescription = {
    presetId: string; presetName: string; targetTemp: number;
    vibrationMode: string; vibrationSpeed: number;
    durationMin: number; description: string;
  };
  const [aiPrescription,     setAiPrescription]     = useState<AIPrescription | null>(null);
  const [ruleBasedRx,        setRuleBasedRx]        = useState<AIPrescription | null>(null);
  const [aiLoading,          setAiLoading]          = useState(false);
  const [aiLogId,            setAiLogId]            = useState<string | null>(null);
  const [aiApplied,          setAiApplied]          = useState(false);
  const [aiAudit,            setAiAudit]            = useState<any>(null);

  // ── Pilot Feasibility Study State ──────────────────────────────────────────
  type PilotStatus = {
    enrolled: boolean;
    participantId?: string;
    studyStatus?: 'ACTIVE' | 'SUSPENDED' | 'WITHDRAWN' | 'COMPLETED';
    nextSessionOrder?: number;
    nextArm?: string;
    suspendedReason?: any;
    completedSessions?: number;
    trialArmSequence?: string[];
  };
  const [pilotStatus,       setPilotStatus]       = useState<PilotStatus | null>(null);
  const [isPilotMode,       setIsPilotMode]       = useState(false);
  const [tMinus5Pain,       setTMinus5Pain]       = useState<number | null>(null);
  const [tMinus5Time,       setTMinus5Time]       = useState<string | null>(null);
  const [showEnrollModal,   setShowEnrollModal]   = useState(false);
  const [pilotAge,          setPilotAge]          = useState('24');
  const [pilotScreenPreg,   setPilotScreenPreg]   = useState(true);
  const [pilotScreenPace,   setPilotScreenPace]   = useState(true);
  const [pilotScreenSkin,   setPilotScreenSkin]   = useState(true);
  const [pilotConsent,      setPilotConsent]      = useState(true);
  const [pilotSubmitting,   setPilotSubmitting]   = useState(false);

  const fetchPilotStatus = useCallback(async () => {
    try {
      const res = await ApiService.get('/pilot/me');
      if (res && res.enrolled) {
        setPilotStatus(res);
        setIsPilotMode(true);
      }
    } catch {
      // Non-blocking: standard session mode remains active
    }
  }, []);

  useEffect(() => {
    fetchPilotStatus();
  }, [fetchPilotStatus]);

  const handleRecordTMinus5 = useCallback(() => {
    setTMinus5Pain(painLevel);
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setTMinus5Time(nowStr);
    Alert.alert(
      'T-5 min Baseline Logged',
      `Pre-session baseline of ${painLevel}/10 recorded at ${nowStr}.\n\nPlease rest quietly for 5 minutes before initiating session.`
    );
  }, [painLevel]);

  const handlePilotEnroll = useCallback(async () => {
    if (!pilotConsent) {
      Alert.alert('Consent Required', 'You must review and accept the pilot protocol.');
      return;
    }
    const ageNum = parseInt(pilotAge, 10);
    if (isNaN(ageNum) || ageNum < 18 || ageNum > 45) {
      Alert.alert('Inclusion Criteria', 'Age must be between 18 and 45.');
      return;
    }
    if (!pilotScreenPreg || !pilotScreenPace || !pilotScreenSkin) {
      Alert.alert('Exclusion Criteria', 'Safety screening items must be confirmed negative.');
      return;
    }
    setPilotSubmitting(true);
    try {
      const res = await ApiService.post('/pilot/enroll', {
        consentVersion: '1.0.0',
        age: ageNum,
        screeningPregnancyNegative: pilotScreenPreg,
        screeningNoPacemaker: pilotScreenPace,
        screeningNoSkinCondition: pilotScreenSkin,
        baselinePainSeverityTypical: painLevel,
      });
      if (res && res.enrolled) {
        setPilotStatus(res);
        setIsPilotMode(true);
        setShowEnrollModal(false);
        Alert.alert(
          'Enrolled in Pilot Study',
          `Assigned De-Identified ID: ${res.participantId}\nSession 1 of 3 ready to commence.`
        );
      } else {
        Alert.alert('Enrollment Notice', res.message || 'Could not complete enrollment.');
      }
    } catch (err: any) {
      Alert.alert('Enrollment Error', err?.response?.data?.message || 'Pilot enrollment failed.');
    } finally {
      setPilotSubmitting(false);
    }
  }, [pilotConsent, pilotAge, pilotScreenPreg, pilotScreenPace, pilotScreenSkin, painLevel]);

  const timerRef           = useRef<ReturnType<typeof setInterval> | null>(null);
  const batchTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentSessionId   = useRef(`sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const sessionStartTime   = useRef('');
  const liveDataRef        = useRef(liveData);
  const tempBuffer         = useRef<number[]>([]);
  const emgBuffer          = useRef<number[]>([]);
  const batchBuffer        = useRef<any[]>([]);
  const goodPostureFrames  = useRef(0);
  const totalPostureFrames = useRef(0);
  const lastLoggedEspTs    = useRef<number | null>(null);
  const lastPacketRef      = useRef<any>(null);

  useEffect(() => { liveDataRef.current = liveData; }, [liveData]);

  // Live values from firmware
  const currentTemp     = Number(liveData?.temperature ?? liveData?.temp ?? 36.5);
  const currentEMG      = Number(liveData?.emg ?? 0);
  const currentPosition = String(liveData?.position ?? 'UNKNOWN');
  const currentAngle    = Number(liveData?.bodyAngle ?? 0);
  const fwMotorMode     = String(liveData?.motorMode ?? 'OFF');
  const fwMotorSpeed    = Number(liveData?.motorSpeed ?? 0);
  const fwHeater        = Boolean(liveData?.heater);
  const fwHeaterSetpt   = Number(liveData?.heaterSetpoint ?? 40.0);
  const emgClass        = classifyEMG(currentEMG);
  const posConfig       = getPositionConfig(currentPosition);

  // Send raw BLE string command
  const sendRaw = useCallback((cmd: string) => {
    (sendCommand as any)({ _raw: cmd }).catch(() => {});
  }, [sendCommand]);

  // Motor controls
  const handleMotorToggle = useCallback((on: boolean) => {
    setMotorEnabled(on);
    sendRaw(on ? 'MOTOR:ON' : 'MOTOR:OFF');
  }, [sendRaw]);

  const handleMotorMode = useCallback((mode: MotorMode) => {
    if (mode === 'OFF') { handleMotorToggle(false); return; }
    setMotorMode(mode);
    if (!motorEnabled) { setMotorEnabled(true); sendRaw('MOTOR:ON'); }
    sendRaw(`MODE:${mode}`);
  }, [motorEnabled, sendRaw, handleMotorToggle]);

  const handleSpeedChange = useCallback((v: number) => {
    const rounded = Math.round(v);
    setMotorSpeed(rounded);
    sendRaw(`SPEED:${rounded}`);
  }, [sendRaw]);

  // Heater controls
  const handleHeaterToggle = useCallback((on: boolean) => {
    setHeaterEnabled(on);
    sendRaw(on ? 'HEATER:ON' : 'HEATER:OFF');
  }, [sendRaw]);

  const handleSetpointChange = useCallback((delta: number) => {
    setHeaterSetpoint(prev => {
      const next = parseFloat(Math.max(36, Math.min(40, prev + delta)).toFixed(1));
      sendRaw(`SETPOINT:${next}`);
      return next;
    });
  }, [sendRaw]);

  // Packet-driven telemetry accumulator (Deduplication + Schema alignment + Windowing)
  useEffect(() => {
    if (!sessionActive || !liveData) return;
    const d = liveData;
    const espTs = d.espTimestamp != null ? Number(d.espTimestamp) : null;
    if (espTs !== null && lastLoggedEspTs.current === espTs) {
      return; // Deduplicate: already recorded this physical hardware packet
    }
    if (espTs !== null) lastLoggedEspTs.current = espTs;
    if (lastPacketRef.current === d) return;
    lastPacketRef.current = d;

    const t     = Number(d.temperature ?? d.temp ?? 36.5);
    const angle = Number(d.bodyAngle ?? 0);
    const mSpd  = Number(d.motorSpeed ?? 0);
    const emg   = Number(d.emg ?? 0);
    const heat  = Boolean(d.heater) ? 1 : 0;
    const now   = Date.now();
    const elapsedSec = sessionStartTime.current
      ? Math.max(0, Math.round((now - new Date(sessionStartTime.current).getTime()) / 1000))
      : 0;

    let windowType = 'active_early';
    if (elapsedSec < 60) windowType = 'pre_washout';
    else if (elapsedSec > 900) windowType = 'post_window';
    else if (elapsedSec >= 420) windowType = 'active_late';

    if (batchBuffer.current.length < 1500) {
      batchBuffer.current.push({
        deviceId: connectedDevice?.name || 'HER-COMFORT',
        sessionId: currentSessionId.current,
        temp: t,
        bodyAngle: angle,
        motorSpeed: mSpd,
        emg,
        emgEnvelope: d.emgEnvelope ?? emg,
        heater: heat,
        motorState: d.motorMode || (mSpd > 0 ? 'PULSE' : 'OFF'),
        heaterState: heat ? 'ON' : 'OFF',
        espTimestamp: espTs ?? now,
        position: d.position ?? 'UNKNOWN',
        motorMode: d.motorMode ?? 'OFF',
        heaterSetpoint: d.heaterSetpoint ?? 40,
        timestamp: now,
        windowType,
        elapsedSec,
        isUserModification: userModifiedRef.current,
      });
    }
    tempBuffer.current = [...tempBuffer.current.slice(-149), t];
    emgBuffer.current  = [...emgBuffer.current.slice(-149), emg];
    totalPostureFrames.current += 1;
    if ((d.position ?? 'UNKNOWN') === 'UPRIGHT') goodPostureFrames.current += 1;
    setGraphData(prev => [...prev, { temp: t, bodyAngle: angle, motorSpeed: mSpd, emg, heater: heat }].slice(-60));
  }, [sessionActive, liveData, connectedDevice]);

  // Session timer — Fix 6: auto-stop at target duration; hard cap at 60 min
  const HARD_MAX_SECONDS = 60 * 60; // 60 minutes, safety ceiling
  useEffect(() => {
    if (!sessionActive) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setSessionSeconds(s => {
        const next = s + 1;
        const targetSecs = presetDuration * 60;

        if (next >= HARD_MAX_SECONDS) {
          // Hard ceiling: force-stop hardware and open end modal
          clearInterval(timerRef.current!);
          sendRaw('MOTOR:OFF');
          sendRaw('HEATER:OFF');
          setMotorEnabled(false);
          setHeaterEnabled(false);
          setSessionActive(false);
          setShowEndModal(true);
          console.warn('[session] Hard max session time (60 min) reached — auto-stopped.');
        } else if (next >= targetSecs && next % targetSecs === 0) {
          // Preset duration reached: stop hardware, open end modal
          sendRaw('MOTOR:OFF');
          sendRaw('HEATER:OFF');
          setMotorEnabled(false);
          setHeaterEnabled(false);
          setSessionActive(false);
          setShowEndModal(true);
        }

        return next;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionActive, presetDuration, sendRaw]);


  // Batch upload with retention on network failure
  useEffect(() => {
    if (sessionActive) {
      batchTimerRef.current = setInterval(async () => {
        if (batchBuffer.current.length > 0) {
          const toSend = [...batchBuffer.current];
          const ok = await ApiService.postBatchReadings(toSend);
          if (ok) {
            batchBuffer.current = batchBuffer.current.slice(toSend.length);
          } else {
            console.warn('[Session] Telemetry batch upload failed; retaining buffered readings.');
            if (batchBuffer.current.length > 1500) {
              batchBuffer.current = batchBuffer.current.slice(-1500);
            }
          }
        }
      }, 8000);
    } else { if (batchTimerRef.current) clearInterval(batchTimerRef.current); }
    return () => { if (batchTimerRef.current) clearInterval(batchTimerRef.current); };
  }, [sessionActive]);

  // ── AI Prescription Fetch ────────────────────────────────────────────────
  const fetchAIPrescription = useCallback(async (pain: number) => {
    setAiLoading(true);
    setAiPrescription(null);
    setAiApplied(false);
    try {
      const result = await ApiService.post('/therapy/prescribe', {
        // Fix 4: link prescribe log to the current session
        sessionId: currentSessionId.current || null,
        context: {
          painPre: pain,
          emg: currentEMG || undefined,           // undefined → backend null (no fake default)
          posture: currentPosition || 'UNKNOWN',
          // Fix 3a: no hardcoded defaults — let backend null-default optional fields
          stress: symptoms.includes('Fatigue') ? 7 : undefined,
          fatigue: symptoms.includes('Fatigue') ? 8 : undefined,
          tookMedication: false,
          skinTempIn: (currentTemp >= 30 && currentTemp <= 45) ? currentTemp : undefined,
        },
        contraindications: {},
      });
      if (result.success) {
        setAiPrescription(result.aiPrescription);
        setRuleBasedRx(result.ruleBasedPrescription);
        setAiLogId(result.logId);
        setAiAudit(result.audit);
      }
    } catch {
      // Silent fail — user can still start manually
    } finally {
      setAiLoading(false);
    }
  }, [currentEMG, currentPosition, currentTemp, symptoms]);

  // Re-fetch AI prescription whenever pain level changes
  useEffect(() => {
    const timer = setTimeout(() => fetchAIPrescription(painLevel), 600);
    return () => clearTimeout(timer);
  }, [painLevel, fetchAIPrescription]);

  // Fix 3: track whether user manually changed settings after AI was applied
  const userModifiedRef = useRef(false);

  // Apply AI prescription to all session controls
  const applyAIPrescription = useCallback(() => {
    if (!aiPrescription) return;
    const mode = aiPrescription.vibrationMode as MotorMode;
    setMotorMode(mode);
    setMotorSpeed(aiPrescription.vibrationSpeed);
    setHeaterSetpoint(aiPrescription.targetTemp);
    setPresetDuration(aiPrescription.durationMin);
    setMotorEnabled(true);
    setHeaterEnabled(true);
    setAiApplied(true);
    userModifiedRef.current = false;    // reset override flag on fresh apply
  }, [aiPrescription]);


  // Post-session feedback (Fix 2: includes painPostConfirmed flag)
  const submitAIFeedback = useCallback(async (
    painAfter: number,
    durationSecs: number,
    painPostConfirmed: boolean,
    source: string,
  ) => {
    if (!aiLogId) return;
    try {
      await ApiService.post('/therapy/feedback', {
        logId: aiLogId,
        sessionId: currentSessionId.current,
        painPost: painAfter,
        actualDurationSeconds: durationSecs,
        completionStatus: 'COMPLETED',
        settingSource: source,
        painPostConfirmed,          // Fix 2: true = user explicitly tapped a value
      });
    } catch {
      // Non-blocking
    }
  }, [aiLogId]);


  const handleStart = useCallback(async () => {
    if (!isConnected) {
      Alert.alert(
        'Device Offline',
        'Connect your physical Her Comfort belt via Bluetooth, or start with the built-in device simulator for local testing.',
        [
          {
            text: '⚡ Start with Simulator',
            onPress: () => {
              startDemo();
              setTimeout(() => {
                const activeSessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                currentSessionId.current = activeSessionId;
                sessionStartTime.current = new Date().toISOString();
                setSessionSeconds(0);
                tempBuffer.current = [];
                emgBuffer.current = [];
                batchBuffer.current = [];
                goodPostureFrames.current = 0;
                totalPostureFrames.current = 0;
                setGraphData([]);
                setSessionActive(true);
                sessionService.startSession({
                  sessionId: activeSessionId,
                  location,
                  painBefore: painLevel,
                  symptoms,
                  targetDurationMin: presetDuration,
                  deviceId: 'HER-COMFORT-SIMULATOR',
                  targetTemp: heaterSetpoint,
                  vibIntensity: motorSpeed,
                  vibMode: motorMode,
                }).catch((err) => console.warn('[Session] startSession DB notice:', err));
              }, 300);
            },
          },
          { text: 'Pair Bluetooth', onPress: () => router.push('/ble-device' as any) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    const activeSessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    currentSessionId.current = activeSessionId;
    const startIso = new Date().toISOString();
    sessionStartTime.current = startIso;

    // Pilot Trial Mode Branch
    if (isPilotMode && pilotStatus?.enrolled) {
      if (pilotStatus.studyStatus === 'SUSPENDED') {
        Alert.alert(
          'Pilot Study Suspended',
          'Sessions are currently blocked pending study supervisor review of an adverse event. Contact the study team.'
        );
        return;
      }
      if (pilotStatus.studyStatus === 'COMPLETED') {
        Alert.alert('Study Complete', 'You have completed all 3 pilot sessions. Thank you for participating!');
        return;
      }
      if (tMinus5Pain === null) {
        Alert.alert(
          'Dual Baseline Required',
          'Protocol requires recording a pre-session pain baseline (T-5 min) before starting to control for pain volatility.\n\nTap below to log your T-5 baseline now.',
          [
            { text: 'Log T-5 min Baseline', onPress: handleRecordTMinus5 },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      try {
        const pilotStartRes = await ApiService.post('/pilot/session/start', {
          sessionId: activeSessionId,
          context: {
            painPre: painLevel,
            painPre_tMinus5: tMinus5Pain,
            painPre_t0: painLevel,
            skinTempIn: (currentTemp >= 30 && currentTemp <= 45) ? currentTemp : undefined,
          },
          contraindications: {
            pregnancy: false,
            pacemaker: false,
            skinCondition: false,
          },
        });

        if (pilotStartRes?.success) {
          setAiLogId(pilotStartRes.logId);
          const allocatedArm = pilotStartRes.arm;
          const assignedMode = allocatedArm.vibrationMode as MotorMode;
          setMotorMode(assignedMode);
          setMotorSpeed(allocatedArm.vibrationSpeed);
          setHeaterSetpoint(allocatedArm.targetTemp);
          setPresetDuration(allocatedArm.durationMin);
          setMotorEnabled(assignedMode !== 'OFF');
          setHeaterEnabled(true);

          sendRaw(`SETPOINT:${allocatedArm.targetTemp}`);
          if (assignedMode !== 'OFF') {
            sendRaw(`MODE:${assignedMode}`);
            sendRaw(`SPEED:${allocatedArm.vibrationSpeed}`);
            sendRaw('MOTOR:ON');
          } else {
            sendRaw('MOTOR:OFF');
          }
          sendRaw('HEATER:ON');
        } else {
          Alert.alert('Pilot Start Failed', pilotStartRes?.message || 'Server rejected pilot session start.');
          return;
        }
      } catch (err: any) {
        Alert.alert('Trial Error', err?.response?.data?.message || 'Could not start pilot trial session.');
        return;
      }
    } else {
      // Standard Session Start
      sessionService.startSession({
        sessionId: activeSessionId,
        location,
        painBefore: painLevel,
        symptoms,
        targetDurationMin: presetDuration,
        deviceId: connectedDevice?.name || 'HER-COMFORT',
        targetTemp: heaterSetpoint,
        vibIntensity: motorSpeed,
        vibMode: motorMode,
      }).catch((err) => console.warn('[Session] startSession DB notice:', err));
    }

    setSessionSeconds(0);
    tempBuffer.current = [];
    emgBuffer.current = [];
    batchBuffer.current = [];
    goodPostureFrames.current = 0;
    totalPostureFrames.current = 0;
    setGraphData([]);
    setSessionActive(true);
  }, [
    isConnected,
    isPilotMode,
    pilotStatus,
    tMinus5Pain,
    handleRecordTMinus5,
    currentTemp,
    router,
    startDemo,
    location,
    painLevel,
    symptoms,
    presetDuration,
    connectedDevice,
    heaterSetpoint,
    motorSpeed,
    motorMode,
    sendRaw,
  ]);

  // Fix 3: Wrap manual control handlers to set userModified flag
  const handleMotorModeWithTracking = useCallback((mode: MotorMode) => {
    if (aiApplied || isPilotMode) userModifiedRef.current = true;
    handleMotorMode(mode);
  }, [aiApplied, isPilotMode, handleMotorMode]);

  const handleSpeedChangeWithTracking = useCallback((v: number) => {
    if (aiApplied || isPilotMode) userModifiedRef.current = true;
    handleSpeedChange(v);
  }, [aiApplied, isPilotMode, handleSpeedChange]);

  const handleSetpointChangeWithTracking = useCallback((delta: number) => {
    if (aiApplied || isPilotMode) userModifiedRef.current = true;
    handleSetpointChange(delta);
  }, [aiApplied, isPilotMode, handleSetpointChange]);

  // Fix 2+3 + Phase 2 Pilot Feedback
  const handleEnd = useCallback(async (data: SessionEndData) => {
    const {
      painAfter,
      painPostConfirmed,
      painPost15 = null,
      comfortScore = 4,
      adverseEvent = false,
      adverseCategory = 'NONE',
      adverseSeverity = 'NONE',
      earlyTerminationReason = 'NONE',
    } = data;

    const wasHeaterEnabled = heaterEnabled;
    const wasMotorEnabled  = motorEnabled;
    setShowEndModal(false); setSessionActive(false);
    sendRaw('MOTOR:OFF'); sendRaw('HEATER:OFF');
    setMotorEnabled(false); setHeaterEnabled(false);

    // Reliable Telemetry Flush: retain in AsyncStorage on network failure
    if (batchBuffer.current.length > 0) {
      const rem = [...batchBuffer.current];
      const ok = await ApiService.postBatchReadings(rem);
      if (ok) {
        batchBuffer.current = [];
      } else {
        try {
          const offlineKey = `@offline_batch_${currentSessionId.current}`;
          await AsyncStorage.setItem(offlineKey, JSON.stringify(rem));
          console.warn('[Session] Saved unsent batch readings to offline storage:', offlineKey);
        } catch (e) {
          console.warn('[Session] Failed to persist offline telemetry:', e);
        }
      }
    }

    const dSecs = sessionSeconds;
    const allTemp = tempBuffer.current.length ? tempBuffer.current : [currentTemp];
    const avgTemp = parseFloat((allTemp.reduce((a, b) => a + b, 0) / allTemp.length).toFixed(1));
    const maxTemp = parseFloat(Math.max(...allTemp).toFixed(1));
    const allEmg  = emgBuffer.current.length ? emgBuffer.current : [currentEMG];
    const emgRms  = parseFloat(Math.sqrt(allEmg.reduce((s, v) => s + v * v, 0) / allEmg.length).toFixed(1));

    // Setting source computation
    const effectiveSource = isPilotMode
      ? 'trial_allocator'
      : !aiApplied
        ? 'user_manual'
        : userModifiedRef.current
          ? 'user_modified'
          : 'ml_recommendation';

    const sourceLabel = effectiveSource === 'trial_allocator'
      ? 'Pilot Randomized Trial'
      : effectiveSource === 'ml_recommendation'
        ? 'AI Prescription'
        : effectiveSource === 'user_modified'
          ? 'User Modified'
          : 'User Manual';

    const notes = `Protocol: ${sourceLabel}. ${motorMode} at ${motorSpeed}%. Setpoint ${heaterSetpoint}C. Pain ${painLevel} -> ${painAfter}. Comfort: ${comfortScore}/5.`;

    const avgBodyAngle = totalPostureFrames.current > 0
      ? parseFloat((goodPostureFrames.current / totalPostureFrames.current * 90).toFixed(1))
      : 0;
    const postureRatio = totalPostureFrames.current > 0
      ? goodPostureFrames.current / totalPostureFrames.current
      : 0;
    const primaryPosition = postureRatio > 0.6 ? 'UPRIGHT' : postureRatio > 0.2 ? 'WALKING' : 'LYING';

    try {
      await sessionService.saveSession({
        id: currentSessionId.current,
        date: sessionStartTime.current || new Date().toISOString(),
        durationSeconds: dSecs,
        durationMin: Math.max(1, Math.round(dSecs / 60)),
        targetDurationMin: presetDuration,
        status: 'COMPLETED',
        location,
        painBefore: painLevel,
        painAfter,
        avgTemp,
        maxTemp,
        targetTemp: heaterSetpoint,
        vibIntensity: motorSpeed,
        vibMode: motorMode,
        heaterEnabled: wasHeaterEnabled,
        motorEnabled: wasMotorEnabled,
        symptoms,
        emgPoints: allEmg.slice(-30),
        emgRms,
        avgBodyAngle,
        primaryPosition,
        imuStats: { avgMovement: 0, maxMovement: 0 },
        contractionLevel: emgClass.label,
        settingSource: effectiveSource,
        notes,
        deviceId: connectedDevice?.name || 'HER-COMFORT',
      });

      // Submit feedback to backend
      if (aiLogId) {
        await ApiService.post('/therapy/feedback', {
          logId: aiLogId,
          sessionId: currentSessionId.current,
          painPost: painAfter,
          painPost_15min: painPost15,
          painPostConfirmed_15min: painPost15 !== null,
          actualDurationSeconds: dSecs,
          completionStatus: 'COMPLETED',
          settingSource: effectiveSource,
          painPostConfirmed,
          comfortScore,
          adverseEvent,
          adverseCategory,
          adverseSeverity,
          earlyTermination: dSecs < (presetDuration * 60) - 30,
          earlyTerminationReason,
        });

        if (isPilotMode) {
          fetchPilotStatus();
          if (adverseSeverity === 'MODERATE' || adverseSeverity === 'SEVERE') {
            Alert.alert(
              '⚠️ Study Safety Review Triggered',
              'Because a moderate or severe adverse event was reported, further study sessions have been suspended in accordance with the pilot safety protocol. The study supervisor has been notified.'
            );
          }
        }
      }

      Alert.alert(
        'Session Completed & Synced',
        isPilotMode
          ? `Pilot session ${pilotStatus?.nextSessionOrder ?? 1} of 3 recorded. Thank you for your contribution!`
          : 'Your therapy session has been logged and synced to the database.',
        [
          { text: 'View History', onPress: () => router.push('/(tabs)/history' as any) },
          { text: 'Done', style: 'default' },
        ]
      );
    } catch {
      Alert.alert('Save Failed', 'Session could not be saved to local storage.');
    }

    setSessionSeconds(0);
    tempBuffer.current = [];
    emgBuffer.current = [];
    goodPostureFrames.current = 0;
    totalPostureFrames.current = 0;
    setGraphData([]);
    setTMinus5Pain(null);
    setTMinus5Time(null);
    currentSessionId.current = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  }, [
    sessionSeconds,
    currentTemp,
    currentEMG,
    motorMode,
    motorSpeed,
    heaterSetpoint,
    heaterEnabled,
    motorEnabled,
    painLevel,
    location,
    symptoms,
    presetDuration,
    emgClass,
    sendRaw,
    router,
    connectedDevice,
    isPilotMode,
    pilotStatus,
    aiLogId,
    fetchPilotStatus,
  ]);

  const toggleSymptom = useCallback((key: string) => {
    setSymptoms(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }, []);

  // ── ACTIVE SESSION DASHBOARD ──────────────────────────────────────────────
  if (sessionActive) {
    const progressPct = Math.min(100, (sessionSeconds / (presetDuration * 60)) * 100);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
        {/* Timer Header */}
        <View style={s.activeHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.green }} />
              <Text style={{ fontSize: 10, fontWeight: '800', color: T.pink, letterSpacing: 1.1 }}>SESSION ACTIVE</Text>
            </View>
            <Text style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: '700', color: T.sub }}>TARGET {presetDuration} MIN</Text>
          </View>
          <Text style={{ fontSize: 44, fontFamily: 'monospace', fontWeight: '900', color: T.text, letterSpacing: -1, marginTop: 2 }}>{fmtTimer(sessionSeconds)}</Text>
          <View style={{ width: '100%', height: 5, backgroundColor: '#E2E8F0', borderRadius: 2.5, marginTop: 4, overflow: 'hidden' }}>
            <View style={{ width: `${progressPct}%`, height: '100%', backgroundColor: T.pink, borderRadius: 2.5 }} />
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

          {/* 1. TELEMETRY GRAPH */}
          <View style={[s.card, { marginBottom: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <View style={[s.iconBox, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                <MaterialCommunityIcons name="chart-multiline" size={18} color={T.blue} />
              </View>
              <View>
                <Text style={s.cardTitle}>LIVE TELEMETRY GRAPH</Text>
                <Text style={s.cardSub}>Temp · Angle · Motor · EMG · Heater</Text>
              </View>
            </View>
            {graphData.length >= 2 ? (
              <TelemetryGraph data={graphData} />
            ) : (
              <View style={{ height: 120, alignItems: 'center', justifyContent: 'center', backgroundColor: T.canvas, borderRadius: 12 }}>
                <MaterialCommunityIcons name="chart-timeline-variant" size={32} color={T.muted} />
                <Text style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>Collecting data...</Text>
              </View>
            )}
          </View>

          {/* 2. POSITION CARD */}
          <View style={[s.card, { marginBottom: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View style={[s.iconBox, { backgroundColor: posConfig.bg, borderColor: posConfig.color + '40' }]}>
                <MaterialCommunityIcons name={posConfig.icon as any} size={18} color={posConfig.color} />
              </View>
              <Text style={s.cardTitle}>BODY POSITION</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ width: 80, height: 80, borderRadius: 20, backgroundColor: posConfig.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: posConfig.color + '40' }}>
                <MaterialCommunityIcons name={posConfig.icon as any} size={44} color={posConfig.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 22, fontWeight: '900', color: posConfig.color, letterSpacing: 0.5 }}>{posConfig.label}</Text>
                <Text style={{ fontSize: 12, color: T.sub, marginTop: 3 }}>{posConfig.sub}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: posConfig.color }} />
                  <Text style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: '700', color: T.sub }}>Body angle: {currentAngle.toFixed(1)}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 3. EMG MUSCLE TONE */}
          <View style={[s.card, { marginBottom: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[s.iconBox, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}>
                  <MaterialCommunityIcons name="sine-wave" size={18} color={T.purple} />
                </View>
                <Text style={s.cardTitle}>EMG MUSCLE TONE</Text>
              </View>
              <Text style={{ fontSize: 28, fontFamily: 'monospace', fontWeight: '900', color: emgClass.color }}>{currentEMG}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: emgClass.bg, borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <MaterialCommunityIcons name={emgClass.icon} size={20} color={emgClass.color} />
              <View>
                <Text style={{ fontSize: 14, fontWeight: '900', color: emgClass.color }}>{emgClass.label}</Text>
                <Text style={{ fontSize: 10, color: emgClass.color, opacity: 0.75, marginTop: 1 }}>{emgClass.desc}</Text>
              </View>
            </View>
            {/* EMG range bar */}
            <View>
              <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
                <View style={{ flex: 20, backgroundColor: '#BFDBFE' }} />
                <View style={{ flex: 15, backgroundColor: '#86EFAC' }} />
                <View style={{ flex: 15, backgroundColor: '#FDE68A' }} />
                <View style={{ flex: 30, backgroundColor: '#FCA5A5' }} />
                <View style={{ flex: 20, backgroundColor: '#9B1C1C' }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {['0', '20', '35', '50', '80', '100+'].map(v => (
                  <Text key={v} style={{ fontSize: 8, color: T.muted }}>{v}</Text>
                ))}
              </View>
              <View style={{
                position: 'absolute', top: -2,
                left: `${Math.min(93, (currentEMG / 100) * 100)}%`,
                alignItems: 'center',
              }}>
                <View style={{ width: 2, height: 14, backgroundColor: T.text, borderRadius: 1 }} />
              </View>
            </View>
          </View>

          {/* 4. MOTOR CONTROL */}
          <View style={[s.card, { marginBottom: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[s.iconBox, { backgroundColor: '#FCE7F3', borderColor: '#FBCFE8' }]}>
                  <MaterialCommunityIcons name="vibrate" size={18} color={T.pink} />
                </View>
                <View>
                  <Text style={s.cardTitle}>MOTOR CONTROL</Text>
                  <Text style={s.cardSub}>FW: {fwMotorMode} · {fwMotorSpeed}%</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => handleMotorToggle(!motorEnabled)}
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: motorEnabled ? T.pink : '#F1F5F9', borderWidth: 1.5, borderColor: motorEnabled ? T.pink : T.border }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: motorEnabled ? '#FFF' : T.sub }}>{motorEnabled ? 'ON' : 'OFF'}</Text>
              </TouchableOpacity>
            </View>
            {/* Mode buttons */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {MOTOR_MODES.map(m => {
                const isActive = motorEnabled ? (motorMode === m.id && m.id !== 'OFF') : m.id === 'OFF';
                return (
                  <TouchableOpacity key={m.id} onPress={() => handleMotorModeWithTracking(m.id)} style={[s.modeBtn, isActive && { backgroundColor: m.color, borderColor: m.color }]}>
                    <MaterialCommunityIcons name={m.icon as any} size={15} color={isActive ? '#FFF' : T.sub} />
                    <Text style={[s.modeBtnText, isActive && { color: '#FFF', fontWeight: '800' }]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* Speed slider */}
            <View style={{ opacity: motorEnabled ? 1 : 0.45 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: T.sub }}>SPEED</Text>
                <Text style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: '900', color: T.pink }}>{motorSpeed}%</Text>
              </View>
              <PrecisionSlider value={motorSpeed} min={0} max={100} onChange={handleSpeedChangeWithTracking} disabled={!motorEnabled} color={T.pink} />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                {[{ l: 'Low 30%', v: 30 }, { l: 'Med 65%', v: 65 }, { l: 'High 95%', v: 95 }].map(p => (
                  <TouchableOpacity key={p.v} disabled={!motorEnabled} onPress={() => handleSpeedChangeWithTracking(p.v)}
                    style={[s.quickChip, Math.abs(motorSpeed - p.v) < 15 && motorEnabled && s.quickChipActive]}>
                    <Text style={[s.quickChipText, Math.abs(motorSpeed - p.v) < 15 && motorEnabled && { color: T.pink, fontWeight: '800' }]}>{p.l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* 5. HEATER CONTROL */}
          <View style={[s.card, { marginBottom: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[s.iconBox, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
                  <MaterialCommunityIcons name="thermometer-lines" size={18} color={T.amber} />
                </View>
                <View>
                  <Text style={s.cardTitle}>HEATER CONTROL</Text>
                  <Text style={s.cardSub}>FW: {fwHeater ? 'ON' : 'OFF'} · Set {fwHeaterSetpt.toFixed(1)}C</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => handleHeaterToggle(!heaterEnabled)}
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: heaterEnabled ? T.amber : '#F1F5F9', borderWidth: 1.5, borderColor: heaterEnabled ? T.amber : T.border }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: heaterEnabled ? '#FFF' : T.sub }}>{heaterEnabled ? 'ON' : 'OFF'}</Text>
              </TouchableOpacity>
            </View>
            {/* Stats row */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <View style={[s.statCell, { flex: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: T.red }}>CURRENT</Text>
                <Text style={{ fontSize: 20, fontFamily: 'monospace', fontWeight: '900', color: T.red, marginTop: 2 }}>{currentTemp.toFixed(1)}C</Text>
              </View>
              <View style={[s.statCell, { flex: 1, borderColor: '#FED7AA', backgroundColor: '#FFF7ED' }]}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: T.amber }}>SETPOINT</Text>
                <Text style={{ fontSize: 20, fontFamily: 'monospace', fontWeight: '900', color: T.amber, marginTop: 2 }}>{heaterSetpoint.toFixed(1)}C</Text>
              </View>
              <View style={[s.statCell, { flex: 1 }]}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: T.sub }}>HEATER</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: fwHeater ? T.green : '#CBD5E1' }} />
                  <Text style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: '800', color: fwHeater ? T.green : T.muted }}>{fwHeater ? 'ON' : 'OFF'}</Text>
                </View>
              </View>
            </View>
            {/* Setpoint stepper */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: T.canvas, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, opacity: heaterEnabled ? 1 : 0.45 }}>
              <TouchableOpacity disabled={!heaterEnabled} onPress={() => handleSetpointChangeWithTracking(-0.5)} style={s.stepperBtn}>
                <Feather name="minus" size={18} color={T.text} />
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 15, fontFamily: 'monospace', fontWeight: '800', color: T.text }}>{heaterSetpoint.toFixed(1)}C SETPOINT</Text>
                <Text style={{ fontSize: 10, color: T.muted }}>Range: 36.0C - 40.0C</Text>
              </View>
              <TouchableOpacity disabled={!heaterEnabled} onPress={() => handleSetpointChangeWithTracking(0.5)} style={s.stepperBtn}>
                <Feather name="plus" size={18} color={T.text} />
              </TouchableOpacity>
            </View>
            {/* Quick presets */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              {[{ l: '36C', v: 36 }, { l: '38C', v: 38 }, { l: '40C', v: 40 }].map(p => (
                <TouchableOpacity key={p.v} disabled={!heaterEnabled} onPress={() => { handleSetpointChangeWithTracking(p.v - heaterSetpoint); sendRaw(`SETPOINT:${p.v}`); }}
                  style={[s.quickChip, heaterSetpoint === p.v && heaterEnabled && { backgroundColor: '#FFF7ED', borderColor: T.amber }]}>
                  <Text style={[s.quickChipText, heaterSetpoint === p.v && heaterEnabled && { color: T.amber, fontWeight: '800' }]}>{p.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* END SESSION */}
          <TouchableOpacity onPress={() => setShowEndModal(true)} style={s.endBtn} activeOpacity={0.85}>
            <Feather name="stop-circle" size={18} color="#FFF" />
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14, letterSpacing: 1, marginLeft: 8 }}>END SESSION & SAVE</Text>
          </TouchableOpacity>
        </ScrollView>

        <EndSessionModal visible={showEndModal} onEnd={handleEnd} onCancel={() => setShowEndModal(false)} painBefore={painLevel} elapsedSecs={sessionSeconds} />
      </SafeAreaView>
    );
  }

  // ── PREPARE SCREEN ────────────────────────────────────────────────────────
  const painBadge = getPainScoreBadge(painLevel);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBFBFC' }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Brand Bar */}
        <View style={s.topBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={s.brandIconWrap}>
              <MaterialCommunityIcons name="flower" size={22} color={T.pink} />
            </View>
            <View>
              <Text style={s.brandTitle}>HerComfort</Text>
              <Text style={s.brandSub}>Care Within You</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/reminders' as any)}
            style={s.bellBtn}
            activeOpacity={0.8}
            accessibilityLabel="Notifications"
          >
            <Feather name="bell" size={17} color={T.pink} />
          </TouchableOpacity>
        </View>

        {/* Hero Banner with User's Asset */}
        <View style={s.heroBanner}>
          <View style={s.heroTextContainer}>
            <Text style={s.heroTitleDark}>Your Comfort</Text>
            <Text style={s.heroTitlePink}>Comes First</Text>
            <Text style={s.heroSubtitle}>Personalized relief. A calmer, healthier you.</Text>
          </View>
          <View style={s.heroImageWrap}>
            <Image source={HERO_IMG} style={s.heroImage} resizeMode="contain" />
          </View>
        </View>

        {/* Device Connection Card */}
        <View style={s.deviceCard}>
          <View style={[s.deviceIconCircle, isConnected && { backgroundColor: T.green }]}>
            <Feather name="bluetooth" size={18} color="#FFF" />
          </View>
          <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
            <Text style={s.deviceTitle}>{isConnected ? 'HerComfort Connected' : 'No device connected'}</Text>
            <Text style={s.deviceSub} numberOfLines={1}>
              {isConnected
                ? `${connectedDevice?.name ?? 'BLE'} · ${currentTemp.toFixed(1)}°C · ${currentPosition}`
                : 'Pair belt or use simulator to test'}
            </Text>
          </View>
          {!isConnected ? (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                onPress={startDemo}
                style={[s.connectBtn, { backgroundColor: '#FDF2F8', borderColor: '#FCE7F3', borderWidth: 1 }]}
                activeOpacity={0.8}
              >
                <Text style={[s.connectBtnText, { color: T.pink, fontWeight: '800' }]}>Simulate</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/ble-device' as any)}
                style={s.connectBtn}
                activeOpacity={0.8}
              >
                <Text style={s.connectBtnText}>Connect</Text>
                <Feather name="chevron-right" size={13} color="#FFF" style={{ marginLeft: 2 }} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/ble-device' as any)}
              style={[s.connectBtn, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1 }]}
              activeOpacity={0.8}
            >
              <Text style={[s.connectBtnText, { color: T.green }]}>Connected</Text>
              <Feather name="chevron-right" size={13} color={T.green} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          )}
        </View>

        {/* Pilot Feasibility Study Card */}
        {isPilotMode && pilotStatus?.enrolled ? (
          <View style={{
            backgroundColor: '#F8FAFC',
            borderRadius: 18,
            borderWidth: 1.5,
            borderColor: pilotStatus.studyStatus === 'SUSPENDED' ? '#FCA5A5' : '#BFDBFE',
            padding: 16,
            marginTop: 12,
            marginBottom: 6,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="flask-outline" size={18} color={pilotStatus.studyStatus === 'SUSPENDED' ? T.red : T.blue} />
                <Text style={{ fontSize: 11, fontWeight: '800', color: pilotStatus.studyStatus === 'SUSPENDED' ? T.red : T.blue, letterSpacing: 0.6 }}>
                  PILOT FEASIBILITY STUDY
                </Text>
              </View>
              <View style={{
                backgroundColor: pilotStatus.studyStatus === 'SUSPENDED' ? '#FEF2F2' : '#EFF6FF',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: pilotStatus.studyStatus === 'SUSPENDED' ? '#FCA5A5' : '#BFDBFE'
              }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: pilotStatus.studyStatus === 'SUSPENDED' ? T.red : T.blue }}>
                  {pilotStatus.studyStatus}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <View style={{ flex: 1, backgroundColor: '#FFF', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: T.muted }}>PARTICIPANT</Text>
                <Text style={{ fontSize: 15, fontFamily: 'monospace', fontWeight: '900', color: T.text, marginTop: 1 }}>
                  {pilotStatus.participantId}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#FFF', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: T.muted }}>SESSION ORDER</Text>
                <Text style={{ fontSize: 15, fontFamily: 'monospace', fontWeight: '900', color: T.text, marginTop: 1 }}>
                  {pilotStatus.nextSessionOrder} of 3
                </Text>
              </View>
            </View>

            {pilotStatus.studyStatus === 'SUSPENDED' ? (
              <View style={{ backgroundColor: '#FEF2F2', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#FCA5A5' }}>
                <Text style={{ fontSize: 11, color: '#991B1B', fontWeight: '700' }}>
                  🚫 Study sessions are suspended for safety review. Please report to the study supervisor.
                </Text>
              </View>
            ) : pilotStatus.studyStatus === 'COMPLETED' ? (
              <View style={{ backgroundColor: '#ECFDF5', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#A7F3D0' }}>
                <Text style={{ fontSize: 11, color: '#065F46', fontWeight: '700' }}>
                  🎉 All 3 crossover sessions completed! Data has been linked to the trial database.
                </Text>
              </View>
            ) : (
              <View style={{ backgroundColor: '#FFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: T.text }}>
                    PRE-SESSION DUAL BASELINE (T-5 min)
                  </Text>
                  {tMinus5Pain !== null && (
                    <Text style={{ fontSize: 10, fontWeight: '700', color: T.green }}>
                      ✓ Logged {tMinus5Time}
                    </Text>
                  )}
                </View>
                <Text style={{ fontSize: 10, color: T.sub, lineHeight: 14 }}>
                  Protocol requires measuring pain at T-5 min and at session start (T-0) to control for spontaneous pain volatility.
                </Text>
                <TouchableOpacity
                  onPress={handleRecordTMinus5}
                  style={{
                    backgroundColor: tMinus5Pain !== null ? '#ECFDF5' : '#EFF6FF',
                    borderRadius: 10,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: tMinus5Pain !== null ? '#A7F3D0' : '#BFDBFE',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: tMinus5Pain !== null ? T.green : T.blue }}>
                    {tMinus5Pain !== null ? `T-5 Baseline: ${tMinus5Pain}/10 (Tap to Update)` : `Record Current Pain (${painLevel}/10) as T-5 Baseline`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setShowEnrollModal(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#EFF6FF',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#BFDBFE',
              padding: 12,
              marginTop: 12,
              marginBottom: 4,
            }}
            activeOpacity={0.85}
          >
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="flask-outline" size={18} color={T.blue} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#1E3A8A' }}>Pilot Feasibility Study</Text>
              <Text style={{ fontSize: 10.5, color: '#3B82F6', marginTop: 1 }}>Join the 3-session crossover trial to help evaluate relief presets.</Text>
            </View>
            <Feather name="chevron-right" size={16} color={T.blue} />
          </TouchableOpacity>
        )}

        {/* Screen Title */}
        <View style={{ marginTop: 18, marginBottom: 14 }}>
          <Text style={s.screenHeading}>Prepare Your Relief Session</Text>
          <Text style={s.screenSubheading}>Set your preferences for a safe and personalized therapy experience.</Text>
        </View>

        {/* 1. Pain Assessment Card */}
        <View style={s.sectionCard}>
          <View style={s.sectionHeader}>
            <View style={s.iconBadgePink}>
              <MaterialCommunityIcons name="poll" size={20} color={T.pink} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.sectionStepTitle}>Pain Assessment</Text>
              <Text style={s.sectionStepSub}>How are you feeling right now?</Text>
            </View>
            <View style={[s.scoreBadge, { backgroundColor: painBadge.bg }]}>
              <Text style={[s.scoreBadgeText, { color: painBadge.text }]}>{painBadge.label}</Text>
              <Feather name="info" size={12} color={painBadge.text} style={{ marginLeft: 4 }} />
            </View>
          </View>
          <PainScale value={painLevel} onChange={setPainLevel} />
        </View>

        {/* Side-by-Side Two Columns: Primary Area of Discomfort & Associated Symptoms */}
        <View style={s.twoColumnRow}>
          {/* Left Column: Primary Area of Discomfort */}
          <View style={s.columnCard}>
            <View style={s.columnCardHeader}>
              <View style={s.columnIconBadge}>
                <Ionicons name="location-sharp" size={14} color={T.pink} />
              </View>
              <View style={{ flex: 1, marginLeft: 7 }}>
                <Text style={s.columnTitle} numberOfLines={1}>Primary Area of Discomfort</Text>
                <Text style={s.columnSubtitle} numberOfLines={1}>Where do you feel the most discomfort?</Text>
              </View>
            </View>

            <View style={s.areaGrid}>
              {PAIN_LOCS.map((loc) => {
                const active = location === loc.id;
                return (
                  <TouchableOpacity
                    key={loc.id}
                    onPress={() => setLocation(loc.id)}
                    style={[s.areaTile, active && s.areaTileActive]}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons
                      name={loc.icon as any}
                      size={20}
                      color={active ? T.pink : '#64748B'}
                    />
                    <Text style={[s.areaTileText, active && s.areaTileTextActive]} numberOfLines={2}>
                      {loc.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Right Column: Associated Symptoms */}
          <View style={s.columnCard}>
            <View style={s.columnCardHeader}>
              <View style={s.columnIconBadge}>
                <MaterialCommunityIcons name="heart-pulse" size={15} color={T.pink} />
              </View>
              <View style={{ flex: 1, marginLeft: 7 }}>
                <Text style={s.columnTitle} numberOfLines={1}>Associated Symptoms</Text>
                <Text style={s.columnSubtitle} numberOfLines={1}>Select all that apply.</Text>
              </View>
            </View>

            <View style={s.symptomsList}>
              {SYMPTOMS_CFG.map((sym) => {
                const active = symptoms.includes(sym.key);
                return (
                  <TouchableOpacity
                    key={sym.key}
                    onPress={() => toggleSymptom(sym.key)}
                    style={[s.symptomRow, active && s.symptomRowActive]}
                    activeOpacity={0.75}
                  >
                    {active ? (
                      <View style={s.symptomCheckActive}>
                        <Feather name="check" size={11} color="#FFF" />
                      </View>
                    ) : (
                      <View style={s.symptomCheckInactive} />
                    )}
                    <Text style={[s.symptomText, active && s.symptomTextActive]} numberOfLines={1}>
                      {sym.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* 4. Session Target Duration Card */}
        <View style={s.sectionCard}>
          <View style={s.durationHeader}>
            <View style={s.iconBadgePink}>
              <Feather name="clock" size={18} color={T.pink} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.sectionStepTitle}>Session Target Duration</Text>
              <Text style={s.sectionStepSub}>Default preset is 10–15 min. You can end anytime.</Text>
            </View>
          </View>
          <View style={s.durationChipsRow}>
            {DURATION_PRESETS.map((dur) => {
              const active = presetDuration === dur;
              return (
                <TouchableOpacity
                  key={dur}
                  onPress={() => setPresetDuration(dur)}
                  style={[s.durationChipPill, active && s.durationChipPillActive]}
                  activeOpacity={0.75}
                >
                  <Text style={[s.durationChipPillText, active && s.durationChipPillTextActive]}>
                    {dur} MIN
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* AI Prescription Card */}
        {(aiLoading || aiPrescription) && (
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: '#FBCFE8',
            padding: 18,
            marginBottom: 14,
            shadowColor: '#E84EA1',
            shadowOpacity: 0.08,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
          }}>
            {/* Card Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#FDF2F8', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FCE7F3' }}>
                <MaterialCommunityIcons name="brain" size={20} color={T.pink} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '900', color: '#0F172A', letterSpacing: 0.2 }}>AI Therapy Prescription</Text>
                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                  {aiAudit?.modelVersion ?? 'preset-scorer-v1.0'} · {aiAudit?.inferenceLatencyMs ?? '—'}ms
                </Text>
              </View>
              {aiApplied && (
                <View style={{ backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: '#A7F3D0' }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#059669' }}>APPLIED</Text>
                </View>
              )}
            </View>

            {aiLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <ActivityIndicator color={T.pink} size="small" />
                <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 8 }}>Generating prescription...</Text>
              </View>
            ) : aiPrescription ? (
              <>
                {/* Side-by-side comparison: AI vs Rule-based */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  {/* AI Column */}
                  <View style={{ flex: 1, backgroundColor: '#FFF0F8', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#FCE7F3' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                      <MaterialCommunityIcons name="brain" size={13} color={T.pink} />
                      <Text style={{ fontSize: 10, fontWeight: '800', color: T.pink, letterSpacing: 0.5 }}>AI MODEL</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#0F172A' }}>{aiPrescription.presetName}</Text>
                    <Text style={{ fontSize: 10, color: '#64748B', marginTop: 2, lineHeight: 14 }}>{aiPrescription.description}</Text>
                    <View style={{ marginTop: 10, gap: 4 }}>
                      {[
                        { icon: 'thermometer', label: `${aiPrescription.targetTemp}°C`, color: '#DC2626' },
                        { icon: 'vibrate',     label: `${aiPrescription.vibrationMode} · ${aiPrescription.vibrationSpeed}%`, color: T.pink },
                        { icon: 'clock-outline', label: `${aiPrescription.durationMin} min`, color: T.purple },
                      ].map(item => (
                        <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <MaterialCommunityIcons name={item.icon as any} size={12} color={item.color} />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155' }}>{item.label}</Text>
                        </View>
                      ))}
                    </View>
                    {aiAudit?.predictedDeltaPain && (
                      <View style={{ marginTop: 8, backgroundColor: '#FDF2F8', borderRadius: 8, padding: 6, alignItems: 'center' }}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#9D174D' }}>PREDICTED RELIEF</Text>
                        <Text style={{ fontSize: 15, fontFamily: 'monospace', fontWeight: '900', color: T.pink }}>-{aiAudit.predictedDeltaPain.toFixed(1)} pts</Text>
                      </View>
                    )}
                  </View>

                  {/* Rule-Based Column */}
                  {ruleBasedRx && (
                    <View style={{ flex: 1, backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                        <MaterialCommunityIcons name="cog-outline" size={13} color='#64748B' />
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 }}>RULE-BASED</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: '#0F172A' }}>{ruleBasedRx.presetName}</Text>
                      <Text style={{ fontSize: 10, color: '#64748B', marginTop: 2, lineHeight: 14 }}>{ruleBasedRx.description}</Text>
                      <View style={{ marginTop: 10, gap: 4 }}>
                        {[
                          { icon: 'thermometer', label: `${ruleBasedRx.targetTemp}°C`, color: '#94A3B8' },
                          { icon: 'vibrate',     label: `${ruleBasedRx.vibrationMode} · ${ruleBasedRx.vibrationSpeed}%`, color: '#94A3B8' },
                          { icon: 'clock-outline', label: `${ruleBasedRx.durationMin} min`, color: '#94A3B8' },
                        ].map(item => (
                          <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <MaterialCommunityIcons name={item.icon as any} size={12} color={item.color} />
                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748B' }}>{item.label}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                {/* Disclaimer */}
                <View style={{ backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 12 }}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={14} color='#D97706' />
                  <Text style={{ fontSize: 10, color: '#92400E', flex: 1, lineHeight: 14 }}>
                    Engineering prototype — synthetic cold-start prior. Not clinically validated. Consult a healthcare provider for medical advice.
                  </Text>
                </View>

                {/* Apply Button */}
                {!aiApplied ? (
                  <TouchableOpacity
                    onPress={applyAIPrescription}
                    style={{ backgroundColor: T.pink, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons name="check-circle" size={18} color="#FFF" />
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>Apply AI Prescription</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ backgroundColor: '#ECFDF5', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="check-circle" size={18} color='#059669' />
                    <Text style={{ color: '#059669', fontWeight: '800', fontSize: 13 }}>AI settings applied — ready to start</Text>
                  </View>
                )}
              </>
            ) : null}
          </View>
        )}

        {/* Start Session CTA Button */}
        <TouchableOpacity
          onPress={handleStart}
          style={s.startSessionPill}
          activeOpacity={0.88}
        >
          <View style={s.startSessionCenter}>
            <MaterialCommunityIcons name="play" size={22} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={s.startSessionText}>Start Session</Text>
          </View>
          <Feather name="chevron-right" size={19} color="#FFF" style={s.startSessionChevron} />
        </TouchableOpacity>

        {/* Footer Tagline */}
        <View style={s.footerTagline}>
          <MaterialCommunityIcons name="flower" size={16} color={T.pink} />
          <Text style={s.footerTaglineText}>Small steps. A more comfortable you.</Text>
        </View>
      </ScrollView>

      {/* Pilot Enrollment Modal */}
      <Modal visible={showEnrollModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, maxHeight: '90%' }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ fontSize: 17, fontWeight: '900', color: T.text }}>
                  🔬 PILOT STUDY ENROLLMENT
                </Text>
                <TouchableOpacity onPress={() => setShowEnrollModal(false)}>
                  <Feather name="x" size={20} color={T.sub} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 11, color: T.sub, marginBottom: 14, lineHeight: 16 }}>
                HerComfort Feasibility Study Protocol v1.0.0. De-identified 3-session crossover evaluating Heat Only, Heat+Pulse, and Heat+Harmonic.
              </Text>

              {/* Age Selection */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: T.text, marginBottom: 6 }}>
                  PARTICIPANT AGE (Inclusion: 18-45)
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {['20', '25', '30', '35', '40'].map((a) => (
                    <TouchableOpacity
                      key={a}
                      onPress={() => setPilotAge(a)}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor: pilotAge === a ? T.pink : '#F1F5F9',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: pilotAge === a ? '#FFF' : T.sub }}>{a}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Exclusion Checklist */}
              <Text style={{ fontSize: 11, fontWeight: '800', color: T.text, marginBottom: 6 }}>
                SAFETY SCREENING (Must All Be Verified)
              </Text>
              <View style={{ gap: 8, marginBottom: 14 }}>
                {[
                  { label: 'Pregnancy negative (Exclusion criterion)', val: pilotScreenPreg, set: setPilotScreenPreg },
                  { label: 'No cardiac pacemaker or active implant', val: pilotScreenPace, set: setPilotScreenPace },
                  { label: 'No broken skin or lesions at belt site', val: pilotScreenSkin, set: setPilotScreenSkin },
                  { label: 'I consent to voluntary study protocol v1.0.0', val: pilotConsent, set: setPilotConsent },
                ].map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => item.set(!item.val)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      padding: 10,
                      backgroundColor: item.val ? '#ECFDF5' : '#FEF2F2',
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: item.val ? '#A7F3D0' : '#FECACA',
                    }}
                  >
                    <MaterialCommunityIcons
                      name={item.val ? 'checkbox-marked-circle' : 'close-circle'}
                      size={18}
                      color={item.val ? T.green : T.red}
                    />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: item.val ? '#065F46' : '#991B1B', flex: 1 }}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={handlePilotEnroll}
                disabled={pilotSubmitting || !pilotConsent || !pilotScreenPreg || !pilotScreenPace || !pilotScreenSkin}
                style={{
                  backgroundColor: (!pilotConsent || !pilotScreenPreg || !pilotScreenPace || !pilotScreenSkin) ? '#CBD5E1' : T.pink,
                  borderRadius: 14,
                  padding: 14,
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                {pilotSubmitting ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>Accept Consent & Complete Enrollment</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const columnCardWidth = (width - 32 - 10) / 2;
const areaTileWidth = (columnCardWidth - 20 - 6) / 2;

const s = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, marginBottom: 8 },
  brandIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FDF2F8', alignItems: 'center', justifyContent: 'center' },
  brandTitle: { fontSize: 19, fontWeight: '900', color: '#0F172A', letterSpacing: -0.4 },
  brandSub: { fontSize: 11, fontWeight: '600', color: '#64748B', marginTop: -2 },
  bellBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FDF2F8', alignItems: 'center', justifyContent: 'center' },

  // Hero Banner
  heroBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFF0F5',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#FCE7F3',
    height: 146,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 12,
    position: 'relative',
  },
  heroTextContainer: {
    flex: 1.15,
    paddingLeft: 18,
    paddingVertical: 18,
    justifyContent: 'center',
    zIndex: 2,
  },
  heroTitleDark: { fontSize: 22, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
  heroTitlePink: { fontSize: 22, fontWeight: '900', color: T.pink, letterSpacing: -0.5, marginTop: 1 },
  heroSubtitle: { fontSize: 11.5, color: '#64748B', marginTop: 6, lineHeight: 16, maxWidth: 170 },
  heroImageWrap: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 155,
    height: 155,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 1,
  },
  heroImage: { width: 155, height: 155 },

  // Device Connection Card
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  deviceIconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: T.pink, alignItems: 'center', justifyContent: 'center' },
  deviceTitle: { fontSize: 13.5, fontWeight: '800', color: '#0F172A' },
  deviceSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.pink,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  connectBtnText: { color: '#FFF', fontSize: 12, fontWeight: '800' },

  // Screen Title
  screenHeading: { fontSize: 23, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
  screenSubheading: { fontSize: 12, color: '#64748B', marginTop: 3, lineHeight: 17 },

  // Cards
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconBadgePink: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FDF2F8', alignItems: 'center', justifyContent: 'center' },
  sectionStepTitle: { fontSize: 14.5, fontWeight: '800', color: '#0F172A' },
  sectionStepSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
  scoreBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  scoreBadgeText: { fontSize: 11.5, fontWeight: '800' },

  // Side by side columns
  twoColumnRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  columnCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  columnCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  columnIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FDF2F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnTitle: { fontSize: 11.5, fontWeight: '800', color: '#0F172A' },
  columnSubtitle: { fontSize: 8.5, color: '#94A3B8', marginTop: 1 },

  // Left column 2x2 grid
  areaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  areaTile: {
    width: areaTileWidth,
    height: 64,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  areaTileActive: {
    borderColor: T.pink,
    backgroundColor: '#FDF2F8',
  },
  areaTileText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
    marginTop: 4,
  },
  areaTileTextActive: {
    color: T.pink,
    fontWeight: '800',
  },

  // Right column symptoms vertical list
  symptomsList: {
    gap: 5,
  },
  symptomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
    height: 32,
  },
  symptomRowActive: {
    borderColor: '#FCE7F3',
    backgroundColor: '#FDF2F8',
  },
  symptomCheckActive: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: T.pink,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  symptomCheckInactive: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    marginRight: 6,
  },
  symptomText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
  },
  symptomTextActive: {
    color: T.pink,
    fontWeight: '800',
  },

  // Duration
  durationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  durationChipsRow: { flexDirection: 'row', gap: 8 },
  durationChipPill: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  durationChipPillActive: {
    backgroundColor: T.pink,
    borderColor: T.pink,
    elevation: 3,
    shadowColor: T.pink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  durationChipPillText: { fontSize: 12, fontWeight: '800', color: '#475569' },
  durationChipPillTextActive: { color: '#FFFFFF', fontWeight: '900' },

  // Start Session Button
  startSessionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.pink,
    borderRadius: 27,
    height: 54,
    marginTop: 8,
    paddingHorizontal: 20,
    shadowColor: T.pink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    position: 'relative',
  },
  startSessionCenter: { flexDirection: 'row', alignItems: 'center' },
  startSessionText: { color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 },
  startSessionChevron: { position: 'absolute', right: 20 },

  // Footer Tagline
  footerTagline: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 8,
  },
  footerTaglineText: { fontSize: 11, fontWeight: '600', color: '#94A3B8', marginTop: 4 },

  // Dashboard styles
  card: { backgroundColor: T.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: T.border, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  iconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  cardTitle: { fontSize: 12, fontWeight: '900', color: T.text, letterSpacing: 0.5 },
  cardSub: { fontSize: 10, color: T.sub, marginTop: 1 },
  activeHeader: { alignItems: 'center', paddingTop: 8, paddingBottom: 10, paddingHorizontal: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: T.border },
  modeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: T.border },
  modeBtnText: { fontSize: 11, fontWeight: '700', color: T.sub },
  quickChip: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: T.border, alignItems: 'center' },
  quickChipActive: { backgroundColor: '#FCE7F3', borderColor: T.pink },
  quickChipText: { fontSize: 10, fontWeight: '700', color: T.sub },
  stepperBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  statCell: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: T.border, backgroundColor: '#F8FAFC', alignItems: 'center' },
  endBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: T.red, borderRadius: 14, paddingVertical: 16, marginTop: 6, shadowColor: T.red, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
});
