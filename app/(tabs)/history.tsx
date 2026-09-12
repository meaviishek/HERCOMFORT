/**
 * history.tsx  –  Nari App History Tab
 *
 * Displays all saved therapy sessions with:
 *   - Filter chips: All / This Week / This Month
 *   - Session cards with pain delta, temp, vibration %
 *   - Tappable detail modal with EMG waveform + therapy settings
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
import { T, palette } from '../../constants/theme';
import sessionService, { SessionRecord } from '../../services/sessionService';

// ─── Design Constants ─────────────────────────────────────────────────────────
const PURPLE = '#E84EA1';       // Nari signature pink
const PURPLE_LIGHT = '#FCE7F3'; // Soft pink accent
const SCREEN_BG = '#FFF5FA';    // Light blush background
const CARD_BG = '#FFFFFF';

// ─── Date formatter ───────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Pain delta badge colour ──────────────────────────────────────────────────
function deltaBg(before: number, after: number) {
  const d = after - before;
  if (d <= -4) return { bg: '#EDE9FE', tc: PURPLE };
  if (d <= -2) return { bg: '#D1FAE5', tc: '#065F46' };
  return { bg: '#FEF3C7', tc: '#92400E' };
}

// ─── EMG Mini Waveform ────────────────────────────────────────────────────────
function MiniEmg({ points, width = 280, height = 60 }: { points: number[]; width?: number; height?: number }) {
  if (!points || points.length < 2) {
    return (
      <View style={{ height, backgroundColor: PURPLE_LIGHT, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 12, color: PURPLE }}>No waveform data</Text>
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
    <View style={{ height, backgroundColor: PURPLE_LIGHT, borderRadius: 12, overflow: 'hidden', padding: 8 }}>
      <Svg width={width - 16} height={height - 16}>
        <Path
          d={segs.join(' ')}
          fill="none"
          stroke={PURPLE}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

// ─── Session Detail Modal ──────────────────────────────────────────────────────
function SessionDetailModal({
  session,
  onClose,
}: {
  session: SessionRecord | null;
  onClose: () => void;
}) {
  if (!session) return null;
  const delta = session.painAfter - session.painBefore;
  const outcome = delta <= -4 ? 'Very Helpful' : delta <= -2 ? 'Helpful' : delta < 0 ? 'Mild Relief' : 'No Change';
  const outcomeColor = delta <= -2 ? PURPLE : delta < 0 ? '#10B981' : '#F59E0B';
  const muscleToneRed = session.emgPoints.length > 4
    ? Math.round(Math.abs((session.emgPoints[0] - session.emgPoints[session.emgPoints.length - 1]) / session.emgPoints[0]) * 100)
    : 0;

  return (
    <Modal visible={!!session} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '90%' }}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: T.text.primary }}>Session Details</Text>
              <TouchableOpacity
                onPress={onClose}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={18} color={T.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* Date + duration */}
            <Text style={{ fontSize: 14, fontWeight: '700', color: PURPLE, marginBottom: 14 }}>
              {fmtDate(session.date)} • {session.durationMin} Minutes
            </Text>

            {/* Pain comparison */}
            <View style={{ flexDirection: 'row', backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, marginBottom: 18, alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 28, fontWeight: '900', color: '#EC4899' }}>{session.painBefore}/10</Text>
                <Text style={{ fontSize: 11, color: T.text.muted, marginTop: 2 }}>Pain Before</Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color={PURPLE} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 28, fontWeight: '900', color: '#10B981' }}>{session.painAfter}/10</Text>
                <Text style={{ fontSize: 11, color: T.text.muted, marginTop: 2 }}>Pain After</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: outcomeColor }}>{outcome}</Text>
                <Text style={{ fontSize: 11, color: T.text.muted, marginTop: 2 }}>Outcome</Text>
              </View>
            </View>

            {/* Therapy settings */}
            <Text style={{ fontSize: 14, fontWeight: '800', color: T.text.primary, marginBottom: 12 }}>Therapy Settings</Text>
            {[
              { label: 'Avg Temperature', value: `${session.avgTemp}°C (Max ${session.maxTemp}°C)`, color: T.text.primary },
              { label: 'Vibration Intensity', value: `${session.vibIntensity}%`, color: T.text.primary },
              { label: 'Muscle Tone Reduction', value: `Reduced by ${muscleToneRed}%`, color: '#10B981' },
              { label: 'Motion State', value: 'Low', color: T.text.primary },
            ].map(({ label, value, color }) => (
              <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <Text style={{ fontSize: 13, color: T.text.secondary }}>{label}</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color }}>{value}</Text>
              </View>
            ))}

            {/* EMG waveform */}
            <Text style={{ fontSize: 14, fontWeight: '800', color: T.text.primary, marginTop: 18, marginBottom: 10 }}>
              Recorded EMG Waveform
            </Text>
            <MiniEmg points={session.emgPoints} />

            {/* Session notes */}
            <View style={{ backgroundColor: PURPLE_LIGHT, borderRadius: 16, padding: 16, marginTop: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: PURPLE, marginBottom: 6 }}>Session Notes</Text>
              <Text style={{ fontSize: 13, color: '#4B5563', lineHeight: 20 }}>{session.notes}</Text>
            </View>

            {/* Close button */}
            <TouchableOpacity
              onPress={onClose}
              style={{ backgroundColor: PURPLE, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 20 }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Session Card ──────────────────────────────────────────────────────────────
function SessionCard({
  session,
  onPress,
}: {
  session: SessionRecord;
  onPress: () => void;
}) {
  const delta = session.painAfter - session.painBefore;
  const { bg: badgeBg, tc: badgeTc } = deltaBg(session.painBefore, session.painAfter);
  const ptsDelta = `${delta > 0 ? '+' : ''}${delta} pts`;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.sessionCard}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {/* Icon */}
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#FCE7F3', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <MaterialCommunityIcons name="flower-tulip" size={22} color="#EC4899" />
        </View>

        {/* Main info */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: T.text.primary }}>{fmtDate(session.date)}</Text>
          <Text style={{ fontSize: 12, color: T.text.muted, marginTop: 2 }}>
            {session.durationMin} min session  •  {session.location}
          </Text>
        </View>

        {/* Delta badge */}
        <View style={{ backgroundColor: badgeBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: badgeTc }}>{ptsDelta}</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={{ flexDirection: 'row', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="arrow-forward" size={12} color={T.text.muted} />
          <Text style={{ fontSize: 13, color: T.text.secondary }}>
            Pain: {session.painBefore} → {session.painAfter}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="thermometer" size={12} color="#EC4899" />
          <Text style={{ fontSize: 13, color: '#EC4899', fontWeight: '600' }}>
            Temp: {session.avgTemp}°C
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <MaterialCommunityIcons name="sine-wave" size={12} color={PURPLE} />
          <Text style={{ fontSize: 13, color: PURPLE, fontWeight: '600' }}>
            Vibe: {session.vibIntensity}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Filter Chips ─────────────────────────────────────────────────────────────
type Filter = 'all' | 'week' | 'month';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: SCREEN_BG }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 26, fontWeight: '900', color: T.text.primary }}>Relief History</Text>
          <Text style={{ fontSize: 13, color: T.text.muted, marginTop: 2 }}>
            {sessions.length} soothing session{sessions.length !== 1 ? 's' : ''} recorded
          </Text>
        </View>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: PURPLE_LIGHT, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9 }}
        >
          <MaterialCommunityIcons name="file-chart-outline" size={16} color={PURPLE} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: PURPLE }}>Report</Text>
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12 }}>
        {FILTERS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setFilter(key)}
            style={{
              paddingHorizontal: 18,
              paddingVertical: 9,
              borderRadius: 20,
              backgroundColor: filter === key ? PURPLE : '#fff',
              borderWidth: 1.5,
              borderColor: filter === key ? PURPLE : '#E5E7EB',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: filter === key ? '#fff' : T.text.secondary }}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={PURPLE} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PURPLE} />}
        >
          {filtered.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: PURPLE_LIGHT, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ionicons name="time-outline" size={34} color={PURPLE} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: T.text.primary }}>No sessions yet</Text>
              <Text style={{ fontSize: 13, color: T.text.muted, marginTop: 6, textAlign: 'center', paddingHorizontal: 40 }}>
                Start a relief session to see your history here
              </Text>
            </View>
          ) : (
            filtered.map((s) => (
              <SessionCard key={s.id} session={s} onPress={() => setSelected(s)} />
            ))
          )}
        </ScrollView>
      )}

      {/* Detail Modal */}
      <SessionDetailModal session={selected} onClose={() => setSelected(null)} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  sessionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#E84EA1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
});
