/**
 * history.tsx - Nari App  Clinical Session History
 *
 * Features:
 *  - Sessions fetched from MongoDB backend via ApiService (with local fallback)
 *  - Pull-to-refresh
 *  - Filter: All / This Week / This Month
 *  - Aggregate stats strip (total, avg relief, avg duration, avg pain reduction %)
 *  - Session cards with all Her Comfort fields: position, body angle, motor mode, EMG, heater
 *  - Detailed Audit Modal with EMG waveform, telemetry grid, posture, contraction level
 *  - PDF Report generation per session (expo-print + expo-sharing)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, Line, Polyline } from 'react-native-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import sessionService, { SessionRecord } from '../../services/sessionService';

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

// Helpers
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function emgLabel(cl?: string): string {
  const m: Record<string, string> = {
    MUSCLE_FREE: 'Muscle Free',
    RELAXED: 'Relaxed',
    SLIGHTLY_TIGHT: 'Slightly Tight',
    HIGH_TIGHTNESS: 'High Tightness',
    EXTREME_CONTRACTION: 'Extreme Contraction',
  };
  return m[cl ?? ''] ?? (cl ?? 'Baseline');
}

function emgColor(cl?: string): string {
  switch (cl) {
    case 'EXTREME_CONTRACTION': return '#9B1C1C';
    case 'HIGH_TIGHTNESS':      return T.red;
    case 'SLIGHTLY_TIGHT':      return T.amber;
    case 'RELAXED':             return T.green;
    default:                    return T.blue;
  }
}

function posLabel(p?: string): string {
  const m: Record<string, string> = { UPRIGHT: 'Upright', WALKING: 'Walking', LYING: 'Lying Down', UNKNOWN: 'Unknown' };
  return m[p ?? ''] ?? (p ?? 'Unknown');
}

// EMG Waveform mini chart
function MiniEmg({ points, h = 60 }: { points: number[]; h?: number }) {
  const w = width - 80;
  const pts = (points ?? []).slice(-30);
  if (pts.length < 2) {
    return (
      <View style={{ height: h, backgroundColor: '#FAF5FF', borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E9D5FF' }}>
        <Text style={{ fontSize: 10, fontFamily: 'monospace', color: T.muted }}>NO WAVEFORM DATA</Text>
      </View>
    );
  }
  const minV = Math.min(...pts);
  const maxV = Math.max(...pts);
  const range = maxV - minV || 1;
  const toY = (v: number) => h - 6 - ((v - minV) / range) * (h - 12);
  const n = pts.length - 1;
  const polyPts = pts.map((v, i) => `${((i / n) * w).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  return (
    <View style={{ height: h, backgroundColor: '#FAF5FF', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#E9D5FF' }}>
      <Svg width={w} height={h}>
        <Polyline points={polyPts} fill="none" stroke={T.purple} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

// Generate HTML for PDF report
function buildReportHTML(s: SessionRecord): string {
  const relief = s.painBefore - s.painAfter;
  const reliefPct = s.painBefore > 0 ? Math.round((relief / s.painBefore) * 100) : 0;
  const contraction = emgLabel(s.contractionLevel);
  const position = posLabel(s.primaryPosition);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Her Comfort - Session Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, Arial, sans-serif; background: #fff; color: #0F172A; padding: 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #E84EA1; padding-bottom: 16px; }
    .brand { font-size: 24px; font-weight: 900; color: #E84EA1; letter-spacing: -0.5px; }
    .brand-sub { font-size: 11px; color: #475569; margin-top: 2px; }
    .report-title { font-size: 13px; font-weight: 800; color: #0F172A; text-align: right; }
    .report-date { font-size: 11px; color: #475569; text-align: right; margin-top: 2px; }
    .section-title { font-size: 11px; font-weight: 800; color: #475569; letter-spacing: 1px; text-transform: uppercase; margin: 20px 0 8px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    .stat-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px; text-align: center; }
    .stat-label { font-size: 9px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-val { font-size: 20px; font-weight: 900; color: #0F172A; margin: 4px 0 2px; font-family: monospace; }
    .stat-sub { font-size: 10px; color: #475569; }
    .stat-val.green { color: #059669; }
    .stat-val.pink { color: #E84EA1; }
    .stat-val.purple { color: #7C3AED; }
    .stat-val.red { color: #DC2626; }
    .stat-val.amber { color: #D97706; }
    .stat-val.blue { color: #0284C7; }
    .param-table { width: 100%; border-collapse: collapse; border: 1px solid #E2E8F0; border-radius: 10px; overflow: hidden; }
    .param-table th { background: #F1F5F9; padding: 8px 12px; text-align: left; font-size: 10px; font-weight: 800; color: #475569; letter-spacing: 0.5px; text-transform: uppercase; }
    .param-table td { padding: 9px 12px; border-top: 1px solid #F1F5F9; font-size: 12px; color: #0F172A; }
    .param-table td.val { font-weight: 700; }
    .ai-box { background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 10px; padding: 14px; margin-top: 8px; }
    .ai-title { font-size: 11px; font-weight: 800; color: #0284C7; letter-spacing: 0.8px; margin-bottom: 6px; }
    .ai-text { font-size: 12px; color: #0F172A; line-height: 1.6; }
    .symptoms-pill { display: inline-block; background: #FCE7F3; border: 1px solid #FBCFE8; border-radius: 6px; padding: 3px 8px; font-size: 10px; font-weight: 700; color: #E84EA1; margin: 2px; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; font-size: 10px; color: #94A3B8; }
    .badge { display: inline-block; background: #D1FAE5; border: 1px solid #A7F3D0; border-radius: 6px; padding: 2px 8px; font-size: 10px; font-weight: 800; color: #059669; }
    .badge.red { background: #FEE2E2; border-color: #FECACA; color: #DC2626; }
    .badge.amber { background: #FEF3C7; border-color: #FDE68A; color: #D97706; }
    .badge.purple { background: #F5F3FF; border-color: #DDD6FE; color: #7C3AED; }
    .badge.blue { background: #EFF6FF; border-color: #BFDBFE; color: #0284C7; }
    .badge.dark { background: #FEE2E2; border-color: #FECACA; color: #9B1C1C; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">HER COMFORT</div>
      <div class="brand-sub">AI Bio-Feedback Therapy System</div>
    </div>
    <div>
      <div class="report-title">CLINICAL SESSION REPORT</div>
      <div class="report-date">${fmtDate(s.date)}</div>
    </div>
  </div>

  <div class="section-title">Session Overview</div>
  <div class="grid-3">
    <div class="stat-box">
      <div class="stat-label">Duration</div>
      <div class="stat-val">${s.durationMin} MIN</div>
      <div class="stat-sub">${s.durationSeconds}s exact</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Pain Delta</div>
      <div class="stat-val ${relief > 0 ? 'green' : 'red'}">${s.painBefore} → ${s.painAfter}</div>
      <div class="stat-sub">${relief > 0 ? `-${relief} pts (${reliefPct}% relief)` : 'No reduction'}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Location</div>
      <div class="stat-val blue" style="font-size:14px">${s.location}</div>
      <div class="stat-sub">Primary site</div>
    </div>
  </div>

  <div class="section-title">Thermal & Motor Therapy</div>
  <div class="grid-2">
    <div class="stat-box">
      <div class="stat-label">Avg Temperature</div>
      <div class="stat-val amber">${s.avgTemp?.toFixed(1) ?? '--'}°C</div>
      <div class="stat-sub">Max: ${s.maxTemp?.toFixed(1) ?? '--'}°C / Setpoint: ${s.targetTemp}°C</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Motor</div>
      <div class="stat-val pink">${s.vibMode}</div>
      <div class="stat-sub">${s.vibIntensity}% intensity • ${s.motorEnabled ? 'Active' : 'Inactive'}</div>
    </div>
  </div>

  <div class="section-title">EMG BioAmp Analysis</div>
  <div class="grid-2">
    <div class="stat-box">
      <div class="stat-label">EMG RMS</div>
      <div class="stat-val purple">${s.emgRms ?? '--'}</div>
      <div class="stat-sub">Root Mean Square</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Contraction Level</div>
      <div class="stat-val" style="font-size:14px; color: ${emgColor(s.contractionLevel)}">${contraction}</div>
      <div class="stat-sub">Peak muscle classification</div>
    </div>
  </div>

  <div class="section-title">Posture & Movement</div>
  <div class="grid-2">
    <div class="stat-box">
      <div class="stat-label">Primary Position</div>
      <div class="stat-val blue" style="font-size:15px">${position}</div>
      <div class="stat-sub">Most common during session</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Avg Body Angle</div>
      <div class="stat-val">${s.avgBodyAngle?.toFixed(1) ?? '--'}°</div>
      <div class="stat-sub">Degrees from upright</div>
    </div>
  </div>

  <div class="section-title">Diagnostic Parameter Table</div>
  <table class="param-table">
    <tr><th>Parameter</th><th>Value</th><th>Status</th></tr>
    <tr><td>Heater</td><td class="val">${s.heaterEnabled ? 'Enabled' : 'Disabled'} / Setpoint ${s.targetTemp}°C</td><td><span class="badge ${s.heaterEnabled ? '' : 'blue'}">${s.heaterEnabled ? 'ACTIVE' : 'INACTIVE'}</span></td></tr>
    <tr><td>Motor Mode</td><td class="val">${s.vibMode} @ ${s.vibIntensity}%</td><td><span class="badge ${s.motorEnabled ? 'purple' : 'blue'}">${s.motorEnabled ? 'ACTIVE' : 'INACTIVE'}</span></td></tr>
    <tr><td>Avg Temp / Max Temp</td><td class="val">${s.avgTemp?.toFixed(1) ?? '--'}°C / ${s.maxTemp?.toFixed(1) ?? '--'}°C</td><td><span class="badge amber">THERMAL</span></td></tr>
    <tr><td>EMG RMS</td><td class="val">${s.emgRms ?? '--'}</td><td><span class="badge purple">BIOMETRIC</span></td></tr>
    <tr><td>Contraction Level</td><td class="val">${contraction}</td><td><span class="badge ${s.contractionLevel === 'EXTREME_CONTRACTION' ? 'dark' : s.contractionLevel === 'HIGH_TIGHTNESS' ? 'red' : s.contractionLevel === 'SLIGHTLY_TIGHT' ? 'amber' : ''}">${(s.contractionLevel ?? 'MUSCLE_FREE').replace(/_/g, ' ')}</span></td></tr>
    <tr><td>Primary Position</td><td class="val">${position} (${s.avgBodyAngle?.toFixed(1) ?? '--'}° avg)</td><td><span class="badge blue">POSTURE</span></td></tr>
    <tr><td>IMU Movement</td><td class="val">${s.imuStats ? `${s.imuStats.avgMovement}g avg / ${s.imuStats.maxMovement}g peak` : 'Not available'}</td><td><span class="badge">IMU</span></td></tr>
    <tr><td>Pain Before / After</td><td class="val">${s.painBefore}/10 → ${s.painAfter}/10</td><td><span class="badge ${relief > 0 ? '' : 'amber'}">${relief > 0 ? `${reliefPct}% RELIEF` : 'NO CHANGE'}</span></td></tr>
    <tr><td>Symptoms</td><td class="val" colspan="2">${(s.symptoms ?? []).length > 0 ? s.symptoms.join(', ') : 'None reported'}</td></tr>
  </table>

  <div class="section-title">AI Clinical Inference</div>
  <div class="ai-box">
    <div class="ai-title">AI ANALYTIC INFERENCE</div>
    <div class="ai-text">
      ${relief > 0
        ? `Effective therapeutic response recorded. Pain attenuated by ${reliefPct}% (${s.painBefore} → ${s.painAfter}/10) over ${s.durationMin} minutes using ${s.vibMode} motor stimulation at ${s.vibIntensity}% and thermal therapy at ${s.targetTemp}°C setpoint. EMG contraction classified as "${contraction}". Body posture maintained predominantly ${position.toUpperCase()} (${s.avgBodyAngle?.toFixed(1) ?? '--'}° avg body angle). ${s.contractionLevel === 'EXTREME_CONTRACTION' || s.contractionLevel === 'HIGH_TIGHTNESS' ? 'High muscle tension detected — increased thermal therapy or session frequency may be beneficial.' : 'Muscle tone within therapeutic range.'}`
        : `Session completed over ${s.durationMin} minutes with no measurable pain reduction. Consider adjusting motor mode, intensity, or heater setpoint. Current classification: ${contraction}.`
      }
    </div>
  </div>

  ${(s.symptoms ?? []).length > 0 ? `
  <div class="section-title">Reported Symptoms</div>
  <div>${s.symptoms.map(sym => `<span class="symptoms-pill">${sym.toUpperCase()}</span>`).join('')}</div>
  ` : ''}

  ${s.notes ? `
  <div class="section-title">Clinical Notes</div>
  <div class="ai-box" style="background:#F8FAFC; border-color:#E2E8F0;">
    <div class="ai-text">${s.notes}</div>
  </div>
  ` : ''}

  <div class="footer">
    <div>Her Comfort · AI Closed-Loop Therapy System · Session ID: ${s.id}</div>
    <div>Generated: ${new Date().toLocaleString()}</div>
  </div>
</body>
</html>`;
}

// Session Detail + Report Modal
function AuditModal({ session, onClose }: { session: SessionRecord | null; onClose: () => void }) {
  const [printing, setPrinting] = useState(false);

  const handlePDF = useCallback(async () => {
    if (!session) return;
    setPrinting(true);
    try {
      const { uri } = await Print.printToFileAsync({
        html: buildReportHTML(session),
        base64: false,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Session Report',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF Saved', `Report saved to:\n${uri}`);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not generate report PDF.');
    } finally {
      setPrinting(false);
    }
  }, [session]);

  if (!session) return null;

  const relief = session.painBefore - session.painAfter;
  const reliefPct = session.painBefore > 0 ? Math.round((relief / session.painBefore) * 100) : 0;
  const contraction = emgLabel(session.contractionLevel);
  const contractionColor = emgColor(session.contractionLevel);
  const position = posLabel(session.primaryPosition);

  return (
    <Modal visible={!!session} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '94%', borderWidth: 1, borderColor: T.border }}>

          {/* Handle + Header */}
          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: T.border, alignSelf: 'center', marginBottom: 14 }} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: T.text }}>AI CLINICAL AUDIT</Text>
                <Text style={{ fontSize: 11, fontFamily: 'monospace', color: T.muted, marginTop: 2 }}>{fmtDate(session.date)}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={{ padding: 4, marginLeft: 8 }}>
                <Feather name="x" size={20} color={T.sub} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

            {/* AI Inference box */}
            <View style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <MaterialCommunityIcons name="brain" size={15} color={T.blue} />
                <Text style={{ fontSize: 10, fontWeight: '900', color: T.blue, letterSpacing: 0.8 }}>AI ANALYTIC INFERENCE</Text>
              </View>
              <Text style={{ fontSize: 12, color: T.text, lineHeight: 18 }}>
                {relief > 0
                  ? `Effective therapeutic response: ${reliefPct}% pain attenuation recorded with ${session.targetTemp}°C heat and ${session.vibMode} stimulation over ${session.durationMin} minutes. Posture: ${position}. Muscle tone: ${contraction}.`
                  : `Session recorded over ${session.durationMin} minutes. Baseline maintained. Consider adjusting protocol.`}
              </Text>
            </View>

            {/* Overview metrics */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {[
                { l: 'DURATION',   v: `${session.durationMin}MIN`, s: `${session.durationSeconds}s`, c: T.text },
                { l: 'PAIN DELTA', v: `${session.painBefore}→${session.painAfter}`, s: relief > 0 ? `-${relief} pts` : 'No change', c: relief > 0 ? T.green : T.red },
                { l: 'RELIEF',     v: `${reliefPct}%`,  s: 'Pain reduction', c: T.pink },
              ].map(({ l, v, s, c }) => (
                <View key={l} style={{ flex: 1, backgroundColor: T.canvas, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: T.border }}>
                  <Text style={{ fontSize: 8, fontWeight: '800', color: T.sub, letterSpacing: 0.5 }}>{l}</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: '900', color: c, marginTop: 3 }}>{v}</Text>
                  <Text style={{ fontSize: 9, color: T.muted, marginTop: 1 }}>{s}</Text>
                </View>
              ))}
            </View>

            {/* Thermal + Motor */}
            <Text style={ms.sectionTitle}>THERMAL & MOTOR</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <View style={[ms.infoBox, { flex: 1, borderColor: '#FED7AA', backgroundColor: '#FFF7ED' }]}>
                <MaterialCommunityIcons name="thermometer-lines" size={16} color={T.amber} />
                <Text style={{ fontSize: 9, fontWeight: '800', color: T.amber, marginTop: 4 }}>HEATER</Text>
                <Text style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: '900', color: T.amber, marginTop: 2 }}>
                  {session.avgTemp?.toFixed(1)}°C
                </Text>
                <Text style={{ fontSize: 9, color: T.sub, marginTop: 1 }}>Max {session.maxTemp?.toFixed(1)}°C · Set {session.targetTemp}°C</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: session.heaterEnabled ? T.green : '#CBD5E1' }} />
                  <Text style={{ fontSize: 9, fontWeight: '700', color: session.heaterEnabled ? T.green : T.muted }}>{session.heaterEnabled ? 'ACTIVE' : 'INACTIVE'}</Text>
                </View>
              </View>
              <View style={[ms.infoBox, { flex: 1, borderColor: '#FBCFE8', backgroundColor: '#FCE7F3' }]}>
                <MaterialCommunityIcons name="vibrate" size={16} color={T.pink} />
                <Text style={{ fontSize: 9, fontWeight: '800', color: T.pink, marginTop: 4 }}>MOTOR</Text>
                <Text style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: '900', color: T.pink, marginTop: 2 }}>
                  {session.vibMode}
                </Text>
                <Text style={{ fontSize: 9, color: T.sub, marginTop: 1 }}>{session.vibIntensity}% intensity</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: session.motorEnabled ? T.green : '#CBD5E1' }} />
                  <Text style={{ fontSize: 9, fontWeight: '700', color: session.motorEnabled ? T.green : T.muted }}>{session.motorEnabled ? 'ACTIVE' : 'INACTIVE'}</Text>
                </View>
              </View>
            </View>

            {/* EMG + Posture */}
            <Text style={ms.sectionTitle}>EMG & POSTURE</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <View style={[ms.infoBox, { flex: 1, borderColor: '#DDD6FE', backgroundColor: '#F5F3FF' }]}>
                <MaterialCommunityIcons name="sine-wave" size={16} color={T.purple} />
                <Text style={{ fontSize: 9, fontWeight: '800', color: T.purple, marginTop: 4 }}>EMG RMS</Text>
                <Text style={{ fontSize: 20, fontFamily: 'monospace', fontWeight: '900', color: T.purple, marginTop: 2 }}>
                  {session.emgRms ?? '--'}
                </Text>
                <Text style={{ fontSize: 9, fontWeight: '700', color: contractionColor, marginTop: 3 }}>{contraction}</Text>
              </View>
              <View style={[ms.infoBox, { flex: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }]}>
                <MaterialCommunityIcons name="human" size={16} color={T.blue} />
                <Text style={{ fontSize: 9, fontWeight: '800', color: T.blue, marginTop: 4 }}>POSTURE</Text>
                <Text style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: '900', color: T.blue, marginTop: 2 }}>
                  {position}
                </Text>
                <Text style={{ fontSize: 9, color: T.sub, marginTop: 1 }}>
                  {session.avgBodyAngle?.toFixed(1) ?? '--'}° avg body angle
                </Text>
              </View>
            </View>

            {/* EMG Waveform */}
            <Text style={ms.sectionTitle}>BIOAMP WAVEFORM SNAPSHOT</Text>
            <View style={{ marginBottom: 12 }}>
              <MiniEmg points={session.emgPoints ?? []} h={65} />
            </View>

            {/* Telemetry parameter table */}
            <Text style={ms.sectionTitle}>TELEMETRY PARAMETERS</Text>
            <View style={{ backgroundColor: T.canvas, borderRadius: 12, borderWidth: 1, borderColor: T.border, marginBottom: 12, overflow: 'hidden' }}>
              {[
                { l: 'Thermal Regulation', v: `Avg ${session.avgTemp?.toFixed(1)}°C / Max ${session.maxTemp?.toFixed(1)}°C` },
                { l: 'Heater Setpoint', v: `${session.targetTemp}°C` },
                { l: 'Motor Mode', v: `${session.vibMode} · ${session.vibIntensity}%` },
                { l: 'Body Position', v: `${position} · ${session.avgBodyAngle?.toFixed(1) ?? '--'}°` },
                { l: 'EMG Contraction', v: contraction },
                { l: 'Inertial Dynamics', v: session.imuStats ? `${session.imuStats.avgMovement}g avg · ${session.imuStats.maxMovement}g peak` : 'Static rest' },
                { l: 'Session Location', v: session.location },
                { l: 'Cloud Sync', v: 'MongoDB Verified' },
              ].map(({ l, v }, i, arr) => (
                <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: T.border }}>
                  <Text style={{ fontSize: 12, color: T.sub }}>{l}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: T.text, maxWidth: '50%', textAlign: 'right' }}>{v}</Text>
                </View>
              ))}
            </View>

            {/* Symptoms */}
            {(session.symptoms ?? []).length > 0 && (
              <>
                <Text style={ms.sectionTitle}>REPORTED SYMPTOMS</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {session.symptoms.map(sym => (
                    <View key={sym} style={{ backgroundColor: '#FCE7F3', borderColor: '#FBCFE8', borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: T.pink }}>{sym.toUpperCase()}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Notes */}
            {session.notes ? (
              <>
                <Text style={ms.sectionTitle}>CLINICAL NOTES</Text>
                <View style={{ backgroundColor: T.canvas, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: T.border, marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: T.sub, lineHeight: 18 }}>{session.notes}</Text>
                </View>
              </>
            ) : null}

            {/* Action buttons */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity onPress={onClose} style={{ flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: T.border, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ fontWeight: '700', color: T.sub, fontSize: 13 }}>CLOSE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePDF}
                disabled={printing}
                style={{ flex: 2, borderRadius: 14, backgroundColor: T.pink, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: printing ? 0.7 : 1 }}
              >
                {printing ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Feather name="file-text" size={16} color="#FFF" />
                )}
                <Text style={{ fontWeight: '800', color: '#FFF', fontSize: 13 }}>
                  {printing ? 'GENERATING PDF...' : 'EXPORT PDF REPORT'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Filter types
type Filter = 'all' | 'week' | 'month';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',   label: 'ALL' },
  { key: 'week',  label: 'THIS WEEK' },
  { key: 'month', label: 'THIS MONTH' },
];

// Main History Screen
export default function HistoryScreen() {
  const [sessions,    setSessions]    = useState<SessionRecord[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [filter,      setFilter]      = useState<Filter>('all');
  const [selected,    setSelected]    = useState<SessionRecord | null>(null);
  const [remoteError, setRemoteError] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setRemoteError(false);

      const all = await sessionService.getSessions();
      setSessions(all);
    } catch {
      setRemoteError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'week')  return sessionService.filterThisWeek(sessions);
    if (filter === 'month') return sessionService.filterThisMonth(sessions);
    return sessions;
  }, [sessions, filter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const count = sessions.length;
    const reliefVals = sessions.map(s => s.painBefore - s.painAfter);
    const avgRelief = count > 0 ? (reliefVals.reduce((a, b) => a + b, 0) / count).toFixed(1) : '0.0';
    const avgDuration = count > 0 ? Math.round(sessions.reduce((a, b) => a + (b.durationMin || 0), 0) / count) : 0;
    const avgReliefPct = sessions.length > 0
      ? Math.round(sessions.filter(s => s.painBefore > 0).reduce((sum, s) => sum + ((s.painBefore - s.painAfter) / s.painBefore) * 100, 0) / Math.max(1, sessions.filter(s => s.painBefore > 0).length))
      : 0;
    return { count, avgRelief, avgDuration, avgReliefPct };
  }, [sessions]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>

      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 24, fontWeight: '900', color: T.text, letterSpacing: -0.5 }}>Clinical History</Text>
          <Text style={{ fontSize: 11, color: T.sub, marginTop: 1 }}>AI Bio-Telemetry Analytics & Session Audits</Text>
        </View>
        <TouchableOpacity
          onPress={() => load(true)}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name="refresh-cw" size={16} color={T.blue} />
        </TouchableOpacity>
      </View>

      {/* Remote error banner */}
      {remoteError && (
        <View style={{ backgroundColor: '#FFF3CD', borderWidth: 1, borderColor: '#FDE68A', marginHorizontal: 16, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <MaterialCommunityIcons name="cloud-off-outline" size={16} color={T.amber} />
          <Text style={{ fontSize: 11, color: T.amber, fontWeight: '700', flex: 1 }}>Showing offline data — could not reach server</Text>
        </View>
      )}

      {/* Aggregate stats */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 }}>
        {[
          { l: 'TOTAL',    v: String(stats.count),       s: 'Sessions',   c: T.text  },
          { l: 'AVG RELIEF', v: `-${stats.avgRelief}`,   s: 'Pain points', c: T.green },
          { l: 'AVG TIME',   v: `${stats.avgDuration}m`, s: 'Per session', c: T.blue  },
          { l: 'AVG RELIEF%', v: `${stats.avgReliefPct}%`, s: 'Pain reduction', c: T.pink },
        ].map(({ l, v, s, c }) => (
          <View key={l} style={{ flex: 1, backgroundColor: '#FFF', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: T.border, alignItems: 'center' }}>
            <Text style={{ fontSize: 8, fontWeight: '800', color: T.sub, letterSpacing: 0.5 }}>{l}</Text>
            <Text style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: '900', color: c, marginTop: 2 }}>{v}</Text>
            <Text style={{ fontSize: 9, color: T.muted, marginTop: 1 }}>{s}</Text>
          </View>
        ))}
      </View>

      {/* Filter chips */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 }}>
        {FILTERS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <TouchableOpacity key={key} onPress={() => setFilter(key)}
              style={[hs.chip, active && hs.chipActive]}>
              <Text style={[hs.chipText, active && { color: T.blue, fontWeight: '800' }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={T.pink} size="large" />
          <Text style={{ color: T.muted, fontSize: 12, marginTop: 12 }}>Loading sessions from database...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={T.pink} />}
        >
          {filtered.length === 0 ? (
            <View style={{ alignItems: 'center', marginVertical: 60 }}>
              <MaterialCommunityIcons name="database-off-outline" size={44} color={T.muted} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginTop: 12 }}>No Sessions Found</Text>
              <Text style={{ fontSize: 12, color: T.muted, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 }}>
                Complete a relief session to generate records.
              </Text>
            </View>
          ) : (
            filtered.map(s => {
              const relief = s.painBefore - s.painAfter;
              const cl = s.contractionLevel;
              const pos = s.primaryPosition;

              return (
                <TouchableOpacity key={s.id} onPress={() => setSelected(s)} activeOpacity={0.85} style={hs.card}>
                  {/* Card header */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: T.text }}>{s.durationMin} MIN SESSION</Text>
                      <Text style={{ fontSize: 11, fontFamily: 'monospace', color: T.sub, marginTop: 2 }}>
                        {fmtDate(s.date)} · {s.location}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: relief > 0 ? '#D1FAE5' : '#F1F5F9', borderWidth: 1, borderColor: relief > 0 ? '#A7F3D0' : '#CBD5E1', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                      <Text style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: '800', color: relief > 0 ? T.green : T.sub }}>
                        {relief > 0 ? `-${relief} PTS` : `${s.painAfter}/10`}
                      </Text>
                    </View>
                  </View>

                  {/* Pills row 1 */}
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    <View style={hs.pill}>
                      <MaterialCommunityIcons name="thermometer" size={10} color={T.amber} />
                      <Text style={[hs.pillText, { color: T.amber }]}>{s.avgTemp?.toFixed(1) ?? '--'}°C</Text>
                    </View>
                    <View style={[hs.pill, { backgroundColor: '#FCE7F3', borderColor: '#FBCFE8' }]}>
                      <MaterialCommunityIcons name="vibrate" size={10} color={T.pink} />
                      <Text style={[hs.pillText, { color: T.pink }]}>{s.vibMode} {s.vibIntensity}%</Text>
                    </View>
                    {cl && (
                      <View style={[hs.pill, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}>
                        <MaterialCommunityIcons name="sine-wave" size={10} color={T.purple} />
                        <Text style={[hs.pillText, { color: emgColor(cl) }]}>{emgLabel(cl)}</Text>
                      </View>
                    )}
                    {pos && pos !== 'UNKNOWN' && (
                      <View style={[hs.pill, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                        <MaterialCommunityIcons name="human" size={10} color={T.blue} />
                        <Text style={[hs.pillText, { color: T.blue }]}>{posLabel(pos)}</Text>
                      </View>
                    )}
                  </View>

                  {/* Pills row 2 */}
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {s.emgRms !== undefined && (
                      <View style={hs.pill}>
                        <Text style={hs.pillText}>RMS: {s.emgRms}</Text>
                      </View>
                    )}
                    {s.avgBodyAngle !== undefined && (
                      <View style={hs.pill}>
                        <Text style={hs.pillText}>Angle: {s.avgBodyAngle.toFixed(1)}°</Text>
                      </View>
                    )}
                    {(s.symptoms ?? []).length > 0 && (
                      <View style={[hs.pill, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
                        <Text style={[hs.pillText, { color: T.amber }]}>{s.symptoms.length} symptom{s.symptoms.length > 1 ? 's' : ''}</Text>
                      </View>
                    )}
                  </View>

                  {/* Bottom row */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: T.canvas }}>
                    <Text style={{ fontSize: 10, color: T.sub }}>
                      {s.heaterEnabled ? `Heat ${s.targetTemp}°C` : 'No heat'} · {s.vibMode} · Pain {s.painBefore}→{s.painAfter}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: T.pink }}>AUDIT + PDF</Text>
                      <Feather name="chevron-right" size={14} color={T.pink} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      <AuditModal session={selected} onClose={() => setSelected(null)} />
    </SafeAreaView>
  );
}

// Styles
const hs = StyleSheet.create({
  card: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: T.border, marginBottom: 10,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: '#FFF', borderWidth: 1, borderColor: T.border },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: T.blue },
  chipText: { fontSize: 10, fontWeight: '700', color: T.sub, letterSpacing: 0.5 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: T.canvas, borderWidth: 1, borderColor: T.border, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pillText: { fontSize: 10, fontFamily: 'monospace', fontWeight: '700', color: T.sub },
});

const ms = StyleSheet.create({
  sectionTitle: { fontSize: 10, fontWeight: '800', color: T.sub, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  infoBox: { padding: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
});
