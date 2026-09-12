/**
 * Insights Screen — explore.tsx
 * Clinical Cycle, Health Trends & Wellness Analytics
 */

import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { T } from '../../constants/theme';
import { useBluetooth } from '../../context/BluetoothContext';

export default function InsightsScreen() {
  const router = useRouter();
  const { connectedDevice } = useBluetooth();
  const [selectedRange, setSelectedRange] = useState<'week' | 'month' | 'year'>('month');

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Health Insights</Text>
          <Text style={s.subTitle}>Cycle trends, clinical patterns & therapy efficacy</Text>
        </View>

        <TouchableOpacity
          style={s.deviceLinkBtn}
          onPress={() => router.push('/ble-device' as any)}
          activeOpacity={0.8}
        >
          <Feather
            name="bluetooth"
            size={14}
            color={connectedDevice ? '#16a34a' : T.pink.primary}
          />
          <Text
            style={[
              s.deviceLinkTxt,
              { color: connectedDevice ? '#16a34a' : T.pink.primary },
            ]}
          >
            {connectedDevice ? 'Connected' : 'Pair Device'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Period & Relief Banner ── */}
        <View style={s.highlightBanner}>
          <View style={{ flex: 1 }}>
            <View style={s.badgeWrap}>
              <Text style={s.badgeTxt}>THERAPY EFFICACY</Text>
            </View>
            <Text style={s.bannerTitle}>74% Pain Reduction Index</Text>
            <Text style={s.bannerSub}>
              Average post-session VAS score dropped from 7.4/10 to 2.8/10 across your last 14 relief sessions.
            </Text>

            {/* Visual VAS Scale Bar */}
            <View style={s.vasBarWrap}>
              <View style={s.vasTrack}>
                <View style={[s.vasFill, { width: '74%' }]} />
              </View>
              <View style={s.vasLabels}>
                <Text style={s.vasTxt}>Baseline 7.4</Text>
                <Text style={[s.vasTxt, { color: '#059669', fontWeight: '800' }]}>Post-Therapy 2.8 (-62%)</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Range Selector ── */}
        <View style={s.rangeBar}>
          {(['week', 'month', 'year'] as const).map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => setSelectedRange(r)}
              style={[s.rangeChip, selectedRange === r && s.rangeChipActive]}
            >
              <Text
                style={[
                  s.rangeChipTxt,
                  selectedRange === r && s.rangeChipTxtActive,
                ]}
              >
                {r === 'week' ? 'Past 7 Days' : r === 'month' ? 'Past 30 Days' : 'This Year'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Key Metrics Grid ── */}
        <Text style={s.sectionTitle}>Overview Statistics</Text>
        <View style={s.metricGrid}>
          {/* Card 1 */}
          <View style={s.metricCard}>
            <View style={s.metricHeader}>
              <View style={[s.metricIcon, { backgroundColor: '#fdf2f8' }]}>
                <Ionicons name="flash-outline" size={18} color={T.pink.primary} />
              </View>
              <View style={s.metricBadge}>
                <Text style={s.metricDelta}>+3 sessions</Text>
              </View>
            </View>
            <Text style={s.metricVal}>14</Text>
            <Text style={s.metricLbl}>Total Relief Sessions</Text>
          </View>

          {/* Card 2 */}
          <View style={s.metricCard}>
            <View style={s.metricHeader}>
              <View style={[s.metricIcon, { backgroundColor: '#fef2f2' }]}>
                <MaterialCommunityIcons name="thermometer" size={18} color="#ef4444" />
              </View>
              <View style={[s.metricBadge, { backgroundColor: '#fef2f2' }]}>
                <Text style={[s.metricDelta, { color: '#dc2626' }]}>Target 40°C</Text>
              </View>
            </View>
            <Text style={s.metricVal}>39.5°C</Text>
            <Text style={s.metricLbl}>Avg Therapy Temp</Text>
          </View>

          {/* Card 3 */}
          <View style={s.metricCard}>
            <View style={s.metricHeader}>
              <View style={[s.metricIcon, { backgroundColor: '#f0fdf4' }]}>
                <MaterialCommunityIcons name="sine-wave" size={18} color="#16a34a" />
              </View>
              <View style={[s.metricBadge, { backgroundColor: '#f0fdf4' }]}>
                <Text style={[s.metricDelta, { color: '#16a34a' }]}>Optimal</Text>
              </View>
            </View>
            <Text style={s.metricVal}>22 min</Text>
            <Text style={s.metricLbl}>Avg Session Duration</Text>
          </View>

          {/* Card 4 */}
          <View style={s.metricCard}>
            <View style={s.metricHeader}>
              <View style={[s.metricIcon, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="calendar-outline" size={18} color="#2563eb" />
              </View>
              <View style={[s.metricBadge, { backgroundColor: '#eff6ff' }]}>
                <Text style={[s.metricDelta, { color: '#2563eb' }]}>±1 day</Text>
              </View>
            </View>
            <Text style={s.metricVal}>28 days</Text>
            <Text style={s.metricLbl}>Cycle Regularity</Text>
          </View>
        </View>

        {/* ── Pattern Analysis ── */}
        <Text style={s.sectionTitle}>Symptom & Clinical Correlations</Text>
        <View style={s.correlationCard}>
          {/* Item 1 */}
          <View style={s.corrRow}>
            <View style={s.corrIconBox}>
              <Ionicons name="pulse-outline" size={22} color={T.pink.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.corrMetaRow}>
                <Text style={s.corrTag}>DAY 1–2 ACUTE SPASM</Text>
                <Text style={s.corrStat}>-68% spasm rate</Text>
              </View>
              <Text style={s.corrTitle}>Prostaglandin Vasoconstriction Peak</Text>
              <Text style={s.corrSub}>
                Pelvic contractions peak at 42 μV EMG during flow onset. Early 40°C thermal therapy plus rhythmic vibration suppresses acute spasm amplitude.
              </Text>
            </View>
          </View>

          <View style={s.divider} />

          {/* Item 2 */}
          <View style={s.corrRow}>
            <View style={[s.corrIconBox, { backgroundColor: '#f5f3ff' }]}>
              <Ionicons name="body-outline" size={22} color="#7c3aed" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.corrMetaRow}>
                <Text style={[s.corrTag, { color: '#7c3aed', backgroundColor: '#f5f3ff' }]}>LUTEAL PHASE</Text>
                <Text style={s.corrStat}>+14% resting tone</Text>
              </View>
              <Text style={s.corrTitle}>Pre-Menstrual Pelvic Tone</Text>
              <Text style={s.corrSub}>
                Baseline myometrial tone rises ~14% 48h before menstruation. Pre-emptive 15-min gentle vibration therapy aborts early onset cramping.
              </Text>
            </View>
          </View>

          <View style={s.divider} />

          {/* Item 3 */}
          <View style={s.corrRow}>
            <View style={[s.corrIconBox, { backgroundColor: '#f0f9ff' }]}>
              <Ionicons name="water-outline" size={22} color="#0284c7" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.corrMetaRow}>
                <Text style={[s.corrTag, { color: '#0284c7', backgroundColor: '#f0f9ff' }]}>BIOMARKER LOG</Text>
                <Text style={s.corrStat}>2.2L logged avg</Text>
              </View>
              <Text style={s.corrTitle}>Hydration & Blood Viscosity Link</Text>
              <Text style={s.corrSub}>
                Days maintaining ≥2.2L fluid intake correlated with 35% shorter acute pain spikes and noticeably reduced lower back referred discomfort.
              </Text>
            </View>
          </View>
        </View>

        {/* ── Modality Breakdown ── */}
        <Text style={s.sectionTitle}>Therapy Effectiveness Breakdown</Text>
        <View style={s.modalityCard}>
          <View style={s.modalityItem}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="fire" size={16} color="#e84ea1" />
                <Text style={s.modalityName}>Thermal Therapy (38–42°C)</Text>
              </View>
              <Text style={s.modalityPct}>88%</Text>
            </View>
            <View style={s.modalityTrack}>
              <View style={[s.modalityFill, { width: '88%', backgroundColor: '#e84ea1' }]} />
            </View>
          </View>

          <View style={[s.modalityItem, { marginTop: 14 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="sine-wave" size={16} color="#8b5cf6" />
                <Text style={s.modalityName}>Wave Vibration Therapy</Text>
              </View>
              <Text style={s.modalityPct}>76%</Text>
            </View>
            <View style={s.modalityTrack}>
              <View style={[s.modalityFill, { width: '76%', backgroundColor: '#8b5cf6' }]} />
            </View>
          </View>

          <View style={[s.modalityItem, { marginTop: 14 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="sparkles" size={16} color="#059669" />
                <Text style={s.modalityName}>Dual-Action Protocol (Heat + Pulse)</Text>
              </View>
              <Text style={[s.modalityPct, { color: '#059669' }]}>94%</Text>
            </View>
            <View style={s.modalityTrack}>
              <View style={[s.modalityFill, { width: '94%', backgroundColor: '#059669' }]} />
            </View>
          </View>
        </View>

        {/* ── Bottom Action to Launch Session ── */}
        <TouchableOpacity
          style={s.launchSessionCard}
          onPress={() => router.push('/(tabs)/session' as any)}
          activeOpacity={0.88}
        >
          <View style={s.launchIconBox}>
            <Ionicons name="flash" size={24} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.launchTitle}>Start Relief Session</Text>
            <Text style={s.launchSub}>Launch real-time sensor & therapy dashboard</Text>
          </View>
          <Feather name="arrow-right" size={20} color="#fff" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff5fa' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '900', color: T.text.primary },
  subTitle: { fontSize: 13, color: T.text.muted, marginTop: 2 },
  deviceLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fce7f3',
  },
  deviceLinkTxt: { fontSize: 12, fontWeight: '700' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  highlightBanner: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#fce7f3',
    shadowColor: T.pink.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  badgeWrap: {
    backgroundColor: '#fdf2f8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fce7f3',
  },
  badgeTxt: { fontSize: 10, fontWeight: '800', color: T.pink.primary, letterSpacing: 0.5 },
  bannerTitle: { fontSize: 20, fontWeight: '900', color: T.text.primary },
  bannerSub: { fontSize: 13, color: T.text.muted, marginTop: 4, lineHeight: 19 },
  vasBarWrap: { marginTop: 14 },
  vasTrack: { height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  vasFill: { height: '100%', backgroundColor: T.pink.primary, borderRadius: 4 },
  vasLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  vasTxt: { fontSize: 11, color: T.text.muted, fontWeight: '600' },
  rangeBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fce7f3',
  },
  rangeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  rangeChipActive: { backgroundColor: T.pink.primary },
  rangeChipTxt: { fontSize: 12, fontWeight: '700', color: T.text.secondary },
  rangeChipTxtActive: { color: '#fff' },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: T.text.primary, marginBottom: 12 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  metricCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fce7f3',
    elevation: 2,
    shadowColor: T.pink.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  metricHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  metricIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  metricBadge: { backgroundColor: '#fdf2f8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  metricDelta: { fontSize: 10, fontWeight: '800', color: T.pink.primary },
  metricVal: { fontSize: 22, fontWeight: '900', color: T.text.primary },
  metricLbl: { fontSize: 11, color: T.text.muted, marginTop: 2, fontWeight: '600' },
  correlationCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#fce7f3',
    marginBottom: 24,
    shadowColor: T.pink.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  corrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  corrIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fdf2f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corrMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  corrTag: { fontSize: 10, fontWeight: '800', color: T.pink.primary, backgroundColor: '#fdf2f8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  corrStat: { fontSize: 11, fontWeight: '700', color: '#10b981' },
  corrTitle: { fontSize: 15, fontWeight: '800', color: T.text.primary, marginTop: 4 },
  corrSub: { fontSize: 12, color: T.text.secondary, marginTop: 4, lineHeight: 18 },
  divider: { height: 1, backgroundColor: '#f9fafb', marginVertical: 14 },
  modalityCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#fce7f3',
    marginBottom: 24,
    shadowColor: T.pink.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  modalityItem: {},
  modalityName: { fontSize: 13, fontWeight: '700', color: T.text.primary },
  modalityPct: { fontSize: 13, fontWeight: '800', color: T.pink.primary },
  modalityTrack: { height: 7, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  modalityFill: { height: '100%', borderRadius: 4 },
  launchSessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.pink.primary,
    borderRadius: 22,
    padding: 18,
    gap: 14,
    elevation: 4,
    shadowColor: T.pink.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  launchIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchTitle: { fontSize: 16, fontWeight: '900', color: '#fff' },
  launchSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
});

