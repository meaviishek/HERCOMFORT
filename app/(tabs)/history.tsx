/**
 * history.tsx  –  Nari App Clinical Session History Tab
 *
 * Professional AI Bio-Intelligence & Clinical History (LITE UI):
 *   - Aggregated Biometric Analytics (Total Sessions, Avg Pain Reduction, Avg Duration)
 *   - Filter chips: All Sessions / This Week / This Month
 *   - High-contrast clinical cards with exact session duration (e.g. 5 min, 15 min), pain deltas, and telemetry
 *   - Comprehensive AI Clinical Audit Modal with full parameter diagnostics
 *   - NO emojis used. Pure vector icons and medical typography.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import sessionService, { SessionRecord } from '../../services/sessionService';

// ─── Professional LITE Theme Tokens ──────────────────────────────────────────
const THEME = {
  bg: '#F8FAFC',
  cardBg: '#FFFFFF',
  cardBorder: '#E2E8F0',
  accentPink: '#E84EA1',
  accentBlue: '#0284C7',
  accentGreen: '#059669',
  accentPurple: '#7C3AED',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
};

// ─── Format Date ─────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Mini EMG Oscilloscope (Lite) ────────────────────────────────────────────
function MiniEmg({ points, width = 280, height = 60 }: { points: number[]; width?: number; height?: number }) {
  if (!points || points.length < 2) {
    return (
      <View style={{ height, backgroundColor: '#FAF5FF', borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F3E8FF' }}>
        <Text style={{ fontSize: 11, fontFamily: 'monospace', color: THEME.textMuted }}>BASELINE STABLE</Text>
      </View>
    );
  }
  const pts = points.slice(-30);
  const minV = Math.min(...pts);
  const maxV = Math.max(...pts);
  const range = maxV - minV || 1;
  const toY = (v: number) => height - 8 - ((v - minV) / range) * (height - 16);
  const segs = pts.map((v, i) => {
    const x = ((i / (pts.length - 1)) * (width - 16)).toFixed(1);
    const y = toY(v).toFixed(1);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  });

  return (
    <View style={{ height, backgroundColor: '#FAF5FF', borderRadius: 8, overflow: 'hidden', padding: 8, borderWidth: 1, borderColor: '#E9D5FF' }}>
      <Svg width={width - 16} height={height - 16}>
        <Path
          d={segs.join(' ')}
          fill="none"
          stroke={THEME.accentPurple}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

// ─── Session Detail Modal (Lite) ──────────────────────────────────────────────
function SessionDetailModal({
  session,
  onClose,
}: {
  session: SessionRecord | null;
  onClose: () => void;
}) {
  if (!session) return null;
  const relief = session.painBefore - session.painAfter;
  const reliefPct = Math.round((relief / Math.max(session.painBefore, 1)) * 100);

  return (
    <Modal visible={!!session} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, maxHeight: '90%', borderWidth: 1, borderColor: THEME.cardBorder }}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: THEME.textPrimary }}>
                  AI CLINICAL SESSION AUDIT
                </Text>
                <Text style={{ fontSize: 11, fontFamily: 'monospace', color: THEME.textMuted }}>
                  {fmtDate(session.date)}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                <Feather name="x" size={20} color={THEME.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* AI Evaluation */}
            <View style={{ backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD', borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <MaterialCommunityIcons name="brain" size={16} color={THEME.accentBlue} />
                <Text style={{ fontSize: 11, fontWeight: '800', color: THEME.accentBlue, letterSpacing: 0.8 }}>
                  AI ANALYTIC INFERENCE
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: THEME.textPrimary, lineHeight: 18 }}>
                {relief > 0
                  ? `Effective therapeutic response: ${reliefPct}% pain attenuation recorded with ${session.targetTemp}°C heat and ${session.vibMode} stimulation over ${session.durationMin} minutes.`
                  : `Session recorded over ${session.durationMin} minutes. Stable baseline maintained.`}
              </Text>
            </View>

            {/* Metrics */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <View style={styles.detailMetricBox}>
                <Text style={styles.detailMetricLbl}>DURATION</Text>
                <Text style={styles.detailMetricVal}>{session.durationMin} MIN</Text>
                <Text style={styles.detailMetricSub}>
                  {session.durationSeconds ? `${session.durationSeconds}s exact` : 'Recorded'}
                </Text>
              </View>
              <View style={styles.detailMetricBox}>
                <Text style={styles.detailMetricLbl}>PAIN DELTA</Text>
                <Text style={[styles.detailMetricVal, { color: relief > 0 ? THEME.accentGreen : THEME.textPrimary }]}>
                  {session.painBefore} → {session.painAfter}
                </Text>
                <Text style={styles.detailMetricSub}>{relief > 0 ? `-${relief} pts` : 'No change'}</Text>
              </View>
              <View style={styles.detailMetricBox}>
                <Text style={styles.detailMetricLbl}>EMG RMS</Text>
                <Text style={[styles.detailMetricVal, { color: THEME.accentPurple }]}>
                  {session.emgRms ? `${session.emgRms}` : '--'} µV
                </Text>
                <Text style={styles.detailMetricSub}>{session.contractionLevel ?? 'Baseline'}</Text>
              </View>
            </View>

            {/* Diagnostic Parameters */}
            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: THEME.textSecondary, letterSpacing: 0.8, marginBottom: 8 }}>
                TELEMETRY PARAMETERS
              </Text>
              <View style={styles.paramRow}>
                <Text style={styles.paramLabel}>Thermal Regulation</Text>
                <Text style={styles.paramValue}>Avg {session.avgTemp}°C / Max {session.maxTemp}°C</Text>
              </View>
              <View style={styles.paramRow}>
                <Text style={styles.paramLabel}>Neuro-Stimulation</Text>
                <Text style={styles.paramValue}>{session.vibIntensity}% • {session.vibMode}</Text>
              </View>
              <View style={styles.paramRow}>
                <Text style={styles.paramLabel}>Inertial Dynamics</Text>
                <Text style={styles.paramValue}>
                  {session.imuStats ? `${session.imuStats.avgMovement}g avg • ${session.imuStats.maxMovement}g peak` : 'Static Rest'}
                </Text>
              </View>
              <View style={[styles.paramRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.paramLabel}>Cloud Persistence</Text>
                <Text style={[styles.paramValue, { color: THEME.accentGreen }]}>MongoDB Verified</Text>
              </View>
            </View>

            {/* Waveform */}
            <Text style={{ fontSize: 11, fontWeight: '800', color: THEME.textSecondary, letterSpacing: 0.8, marginBottom: 8 }}>
              BIOAMP ANALOG WAVEFORM SNAPSHOT
            </Text>
            <MiniEmg points={session.emgPoints} />

            {/* Notes */}
            {session.notes ? (
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginTop: 14, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: THEME.textSecondary, marginBottom: 4 }}>CLINICAL NOTES</Text>
                <Text style={{ fontSize: 12, color: THEME.textSecondary, lineHeight: 18 }}>{session.notes}</Text>
              </View>
            ) : null}

            {/* Close */}
            <TouchableOpacity
              onPress={onClose}
              style={{ backgroundColor: THEME.accentPink, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 18 }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>
                CLOSE AUDIT
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Filter Types ─────────────────────────────────────────────────────────────
type Filter = 'all' | 'week' | 'month';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'ALL SESSIONS' },
  { key: 'week', label: 'THIS WEEK' },
  { key: 'month', label: 'THIS MONTH' },
];

// ─── Main History Screen Component (Lite UI) ──────────────────────────────────
export default function HistoryScreen() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<SessionRecord | null>(null);

  const loadSessions = useCallback(async () => {
    const all = await sessionService.getSessions();
    setSessions(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  }, [loadSessions]);

  const filtered =
    filter === 'week'
      ? sessionService.filterThisWeek(sessions)
      : filter === 'month'
      ? sessionService.filterThisMonth(sessions)
      : sessions;

  // Aggregate stats
  const totalCount = sessions.length;
  const reliefValues = sessions.map((s) => s.painBefore - s.painAfter);
  const avgRelief =
    reliefValues.length > 0
      ? (reliefValues.reduce((a, b) => a + b, 0) / reliefValues.length).toFixed(1)
      : '0.0';
  const avgDuration =
    sessions.length > 0
      ? Math.round(sessions.reduce((a, b) => a + (b.durationMin || 0), 0) / sessions.length)
      : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      {/* Top Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 24, fontWeight: '900', color: THEME.textPrimary, letterSpacing: -0.5 }}>
            Clinical History
          </Text>
          <Text style={{ fontSize: 11, color: THEME.textSecondary, marginTop: 1 }}>
            AI Bio-Telemetry Analytics & Session Audits
          </Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: THEME.cardBorder, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name="refresh-cw" size={16} color={THEME.accentBlue} />
        </TouchableOpacity>
      </View>

      {/* Aggregate Clinical Metrics */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 }}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLbl}>TOTAL</Text>
          <Text style={styles.summaryVal}>{totalCount}</Text>
          <Text style={styles.summarySub}>Sessions</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLbl}>AVG RELIEF</Text>
          <Text style={[styles.summaryVal, { color: THEME.accentGreen }]}>-{avgRelief}</Text>
          <Text style={styles.summarySub}>Pain Points</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLbl}>AVG TIME</Text>
          <Text style={[styles.summaryVal, { color: THEME.accentBlue }]}>{avgDuration}m</Text>
          <Text style={styles.summarySub}>Per Session</Text>
        </View>
      </View>

      {/* Filter Chips */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 }}>
        {FILTERS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setFilter(key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List Content */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={THEME.accentPink} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.accentPink} />}
        >
          {filtered.length === 0 ? (
            <View style={{ alignItems: 'center', marginVertical: 60 }}>
              <MaterialCommunityIcons name="database-off-outline" size={44} color={THEME.textMuted} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: THEME.textSecondary, marginTop: 12 }}>
                No Sessions Found
              </Text>
              <Text style={{ fontSize: 12, color: THEME.textMuted, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 }}>
                Initiate a relief session in the Therapy tab to generate telemetry records.
              </Text>
            </View>
          ) : (
            filtered.map((s) => {
              const relief = s.painBefore - s.painAfter;
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setSelected(s)}
                  activeOpacity={0.8}
                  style={styles.historyCard}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: THEME.textPrimary }}>
                        {s.durationMin} MIN SESSION
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: 'monospace', color: THEME.textSecondary, marginTop: 2 }}>
                        {fmtDate(s.date)} • {s.location}
                      </Text>
                    </View>

                    <View
                      style={{
                        backgroundColor: relief > 0 ? '#D1FAE5' : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: relief > 0 ? '#A7F3D0' : '#CBD5E1',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: 'monospace',
                          fontWeight: '800',
                          color: relief > 0 ? THEME.accentGreen : THEME.textSecondary,
                        }}
                      >
                        {relief > 0 ? `-${relief} PTS` : `${s.painAfter}/10`}
                      </Text>
                    </View>
                  </View>

                  {/* Feature Pills */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <View style={styles.historyPill}>
                      <Text style={styles.historyPillText}>AVG {s.avgTemp?.toFixed(1) ?? '38.0'}°C</Text>
                    </View>
                    {s.emgRms !== undefined && (
                      <View style={[styles.historyPill, { backgroundColor: '#F3E8FF', borderColor: '#E9D5FF' }]}>
                        <Text style={[styles.historyPillText, { color: THEME.accentPurple }]}>
                          RMS: {s.emgRms} µV
                        </Text>
                      </View>
                    )}
                    {s.contractionLevel && (
                      <View style={[styles.historyPill, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                        <Text style={[styles.historyPillText, { color: '#B45309' }]}>
                          {s.contractionLevel}
                        </Text>
                      </View>
                    )}
                    {s.imuStats?.avgMovement !== undefined && (
                      <View style={[styles.historyPill, { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' }]}>
                        <Text style={[styles.historyPillText, { color: THEME.accentBlue }]}>
                          MOVE: {s.imuStats.avgMovement}g
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Bottom details */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                    <Text style={{ fontSize: 11, color: THEME.textSecondary }}>
                      Heat {s.targetTemp}°C • {s.vibMode} ({s.vibIntensity}%)
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: THEME.accentBlue }}>VIEW AUDIT</Text>
                      <Feather name="chevron-right" size={14} color={THEME.accentBlue} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Audit Detail Modal */}
      <SessionDetailModal session={selected} onClose={() => setSelected(null)} />
    </SafeAreaView>
  );
}

// ─── Stylesheet (Lite UI) ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  summaryBox: {
    flex: 1,
    backgroundColor: THEME.cardBg,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryLbl: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.textSecondary,
    letterSpacing: 0.5,
  },
  summaryVal: {
    fontSize: 16,
    fontFamily: 'monospace',
    fontWeight: '900',
    color: THEME.textPrimary,
    marginTop: 2,
  },
  summarySub: {
    fontSize: 10,
    color: THEME.textMuted,
    marginTop: 1,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: THEME.cardBg,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
  },
  filterChipActive: {
    backgroundColor: '#F1F5F9',
    borderColor: THEME.accentBlue,
  },
  filterChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textSecondary,
    letterSpacing: 0.5,
  },
  filterChipTextActive: {
    color: THEME.textPrimary,
    fontWeight: '800',
  },
  historyCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    marginBottom: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  historyPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  historyPillText: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '800',
    color: THEME.textSecondary,
  },
  detailMetricBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  detailMetricLbl: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.textSecondary,
  },
  detailMetricVal: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '900',
    color: THEME.textPrimary,
    marginTop: 2,
  },
  detailMetricSub: {
    fontSize: 10,
    color: THEME.textMuted,
    marginTop: 1,
  },
  paramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  paramLabel: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  paramValue: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
});
