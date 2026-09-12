import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Dimensions,
  Modal, Alert, ActivityIndicator, RefreshControl, Animated,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useBluetooth, CONNECTION_STATUS } from "../../context/BluetoothContext";
import cycleService, { CycleSummary, Cycle, FlowLevel } from "../../services/cycleService";
import { T, palette } from "../../constants/theme";

const { width } = Dimensions.get("window");
const CAL_DAY_SZ = Math.floor((width - 48) / 7);

function fmtDate(iso: string | Date | undefined | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtShort(iso: string | Date | undefined | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Phase meta – only label/subtitle changes; colour is ALWAYS pink
const PHASE_META: Record<string, { label: string; subtitle: string }> = {
  menstrual:  { label: "Period",     subtitle: "Take it easy today" },
  follicular: { label: "Follicular", subtitle: "Energy rising" },
  ovulation:  { label: "Fertile",   subtitle: "Peak fertility window" },
  luteal:     { label: "Luteal",    subtitle: "Slow down & rest" },
};

const FLOW_LEVELS: { label: string; value: FlowLevel; color: string }[] = [
  { label: "Light",  value: "light",  color: palette.pink200 },
  { label: "Medium", value: "medium", color: T.pink.primary },
  { label: "Heavy",  value: "heavy",  color: T.pink.dark },
];

const SYMPTOMS = [
  { key: "cramps",            label: "Cramps" },
  { key: "bloating",          label: "Bloating" },
  { key: "headache",          label: "Headache" },
  { key: "fatigue",           label: "Fatigue" },
  { key: "mood_swings",       label: "Mood" },
  { key: "breast_tenderness", label: "Tender" },
  { key: "acne",              label: "Acne" },
  { key: "nausea",            label: "Nausea" },
  { key: "backache",          label: "Backache" },
  { key: "spotting",          label: "Spotting" },
];

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS  = ["S","M","T","W","T","F","S"];

// ── MiniCalendar ──────────────────────────────────────────────────────────────
function MiniCalendar({ year, month, cycles, summary }: { year: number; month: number; cycles: Cycle[]; summary: CycleSummary | null }) {
  const firstDay   = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const days: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function getMark(day: number) {
    const d = new Date(year, month - 1, day);
    for (const c of cycles) {
      const s = new Date(c.startDate);
      const e = c.endDate ? new Date(c.endDate) : new Date();
      if (d >= s && d <= e) return "period";
    }
    if (summary?.fertileWindowStart && summary?.fertileWindowEnd) {
      if (d >= new Date(summary.fertileWindowStart) && d <= new Date(summary.fertileWindowEnd)) return "fertile";
    }
    if (summary?.ovulationDate && d.toDateString() === new Date(summary.ovulationDate).toDateString()) return "ovulation";
    if (summary?.nextPeriodDate && d.toDateString() === new Date(summary.nextPeriodDate).toDateString()) return "predicted";
    return null;
  }

  const markStyle: Record<string, { bg: string; tc: string; border: string }> = {
    period:    { bg: T.pink.bg,        tc: T.pink.dark,    border: T.pink.border },
    ovulation: { bg: "#fce7f3",        tc: T.pink.primary, border: T.pink.border },
    fertile:   { bg: palette.pink100,  tc: T.pink.dark,    border: palette.pink200 },
    predicted: { bg: palette.pink50,   tc: T.pink.primary, border: palette.pink100 },
  };

  return (
    <View>
      <View style={{ flexDirection: "row", marginBottom: 6 }}>
        {DAY_LABELS.map((l, i) => (
          <View key={i} style={{ width: CAL_DAY_SZ, alignItems: "center" }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: T.text.muted }}>{l}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {days.map((day, idx) => {
          if (!day) return <View key={`e${idx}`} style={{ width: CAL_DAY_SZ }} />;
          const mark  = getMark(day);
          const isToday = today.getDate() === day && today.getMonth() === month - 1 && today.getFullYear() === year;
          const ms = mark ? markStyle[mark] : null;
          return (
            <View key={day} style={{ width: CAL_DAY_SZ, height: CAL_DAY_SZ, alignItems: "center", justifyContent: "center", marginBottom: 2 }}>
              <View style={{ width: CAL_DAY_SZ - 4, height: CAL_DAY_SZ - 4, borderRadius: (CAL_DAY_SZ - 4) / 2, backgroundColor: isToday ? T.pink.primary : (ms?.bg ?? "transparent"), borderWidth: ms && !isToday ? 1 : 0, borderColor: ms?.border, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 12, fontWeight: isToday ? "900" : "600", color: isToday ? "#fff" : (ms?.tc ?? T.text.primary) }}>{day}</Text>
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10, gap: 8 }}>
        {[
          { color: T.pink.primary,  label: "Period" },
          { color: palette.pink300, label: "Predicted" },
          { color: palette.pink400, label: "Ovulation" },
          { color: palette.pink200, label: "Fertile" },
        ].map(it => (
          <View key={it.label} style={{ flexDirection: "row", alignItems: "center", marginRight: 12 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: it.color, marginRight: 4 }} />
            <Text style={{ fontSize: 10, color: T.text.muted, fontWeight: "600" }}>{it.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── LogPeriodModal ────────────────────────────────────────────────────────────
function LogPeriodModal({ visible, onClose, onSaved, activeCycle }: { visible: boolean; onClose: () => void; onSaved: () => void; activeCycle: Cycle | null }) {
  const [mode, setMode] = useState<"start" | "end">("start");
  const [flow, setFlow] = useState<FlowLevel>("medium");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (visible) { setMode(activeCycle && !activeCycle.endDate ? "end" : "start"); setFlow("medium"); setSymptoms([]); }
  }, [visible, activeCycle]);

  function toggleSym(k: string) { setSymptoms(p => p.includes(k) ? p.filter(s => s !== k) : [...p, k]); }

  async function submit() {
    try {
      setLoading(true);
      if (mode === "start") await cycleService.startPeriod({ startDate: today, flowLevel: flow, symptoms });
      else await cycleService.endPeriod({ endDate: today, cycleId: activeCycle?._id });
      onSaved(); onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      Alert.alert("Error", e.response?.data?.message || "Something went wrong");
    } finally { setLoading(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: T.bg.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingBottom: 48 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <Text style={{ fontSize: 22, fontWeight: "900", color: T.text.primary }}>{mode === "start" ? "Log Period Start" : "End Period"}</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={24} color={T.text.muted} /></TouchableOpacity>
          </View>
          {activeCycle && !activeCycle.endDate && (
            <View style={{ flexDirection: "row", backgroundColor: T.bg.input, borderRadius: 16, padding: 4, marginBottom: 24 }}>
              {(["start", "end"] as const).map(m => (
                <TouchableOpacity key={m} onPress={() => setMode(m)} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: mode === m ? T.pink.primary : "transparent", alignItems: "center" }}>
                  <Text style={{ fontWeight: "700", color: mode === m ? "#fff" : T.text.muted }}>{m === "start" ? "New Period" : "End Period"}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {mode === "start" && (
            <>
              <Text style={{ fontWeight: "800", color: T.text.secondary, marginBottom: 12, fontSize: 14 }}>Flow Level</Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 24 }}>
                {FLOW_LEVELS.map(fl => (
                  <TouchableOpacity key={fl.value} onPress={() => setFlow(fl.value)} style={{ flex: 1, paddingVertical: 12, borderRadius: 16, backgroundColor: flow === fl.value ? fl.color : T.bg.input, alignItems: "center", borderWidth: 2, borderColor: flow === fl.value ? fl.color : "transparent" }}>
                    <Text style={{ fontWeight: "700", color: flow === fl.value ? "#fff" : T.text.muted, fontSize: 13 }}>{fl.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={{ fontWeight: "800", color: T.text.secondary, marginBottom: 12, fontSize: 14 }}>Symptoms (optional)</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
                {SYMPTOMS.map(s => {
                  const sel = symptoms.includes(s.key);
                  return (
                    <TouchableOpacity key={s.key} onPress={() => toggleSym(s.key)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: sel ? T.pink.bg : T.bg.input, borderWidth: 1.5, borderColor: sel ? T.pink.primary : "transparent" }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: sel ? T.pink.primary : T.text.muted }}>{s.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
          {mode === "end" && (
            <Text style={{ color: T.text.muted, fontSize: 14, marginBottom: 28, lineHeight: 22 }}>
              Recording today ({fmtDate(today)}) as the last day of your period. Cycle data will be updated.
            </Text>
          )}
          <TouchableOpacity onPress={submit} disabled={loading} style={{ backgroundColor: T.pink.primary, borderRadius: 20, paddingVertical: 16, alignItems: "center" }}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>{mode === "start" ? "Log Period Start" : "End Period"}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── CycleHistoryCard ──────────────────────────────────────────────────────────
function CycleHistoryCard({ cycle, index, onDelete }: { cycle: Cycle; index: number; onDelete: () => void }) {
  return (
    <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: T.border.pink }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <View style={{ backgroundColor: T.pink.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: T.pink.primary }}>Cycle #{index + 1}</Text>
            </View>
            {cycle.isIrregular && (
              <View style={{ backgroundColor: "#fef3c7", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#d97706" }}>Irregular</Text>
              </View>
            )}
          </View>
          <Text style={{ fontWeight: "800", color: T.text.primary, fontSize: 15, marginBottom: 8 }}>
            {fmtShort(cycle.startDate)} {"→"} {cycle.endDate ? fmtShort(cycle.endDate) : "Ongoing"}
          </Text>
          <View style={{ flexDirection: "row", gap: 16 }}>
            {!!cycle.periodDuration && <View><Text style={{ fontSize: 10, color: T.text.muted, fontWeight: "600" }}>DURATION</Text><Text style={{ fontSize: 14, fontWeight: "800", color: T.text.secondary }}>{cycle.periodDuration}d</Text></View>}
            {!!cycle.cycleLength   && <View><Text style={{ fontSize: 10, color: T.text.muted, fontWeight: "600" }}>CYCLE</Text><Text style={{ fontSize: 14, fontWeight: "800", color: T.text.secondary }}>{cycle.cycleLength}d</Text></View>}
            {cycle.symptoms?.length > 0 && <View><Text style={{ fontSize: 10, color: T.text.muted, fontWeight: "600" }}>SYMPTOMS</Text><Text style={{ fontSize: 14, fontWeight: "800", color: T.text.secondary }}>{cycle.symptoms.length}</Text></View>}
          </View>
        </View>
        <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}>
          <Feather name="trash-2" size={16} color="#f87171" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── HomeScreen ────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { connectedDevice, connectionStatus, liveData } = useBluetooth();
  const isDeviceConnected = connectionStatus === CONNECTION_STATUS.CONNECTED;
  const [summary,    setSummary]    = useState<CycleSummary | null>(null);
  const [calCycles,  setCalCycles]  = useState<Cycle[]>([]);
  const [history,    setHistory]    = useState<Cycle[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLogModal,  setShowLogModal]  = useState(false);
  const [showCalendar,  setShowCalendar]  = useState(false);
  const [showHistory,   setShowHistory]   = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const today    = new Date();
  const calYear  = today.getFullYear();
  const calMonth = today.getMonth() + 1;
  const firstName = user?.name?.split(" ")[0] || "there";

  useEffect(() => {
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.04, duration: 1800, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 1800, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, []);

  async function fetchAll() {
    try {
      const [sum, cal, hist] = await Promise.all([
        cycleService.getSummary(),
        cycleService.getCalendarData(calYear, calMonth),
        cycleService.getHistory(1, 5),
      ]);
      setSummary(sum); setCalCycles(cal); setHistory(hist.cycles);
    } catch (e) { console.warn("fetchAll err", e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { fetchAll(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchAll(); }, []);

  function handleDelete(id: string) {
    Alert.alert("Delete Cycle", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { try { await cycleService.deleteCycle(id); fetchAll(); } catch { Alert.alert("Error", "Failed."); } } },
    ]);
  }

  const phase       = summary?.phase || "follicular";
  const phaseMeta   = PHASE_META[phase] || PHASE_META.follicular;
  const hasData     = summary?.hasData    ?? false;
  const isOngoing   = summary?.isOngoing  ?? false;
  const cycleDay    = summary?.cycleDay   ?? 1;
  const daysUntil   = summary?.daysUntilNextPeriod ?? null;
  const avgLen      = summary?.avgCycleLength ?? 28;
  const activeCycle = (summary?.currentCycle ?? null) as Cycle | null;

  let centerLabel = "No Data";
  let centerSub   = "Log your first period";
  if (hasData) {
    if (isOngoing) { centerLabel = `Day ${cycleDay}`; centerSub = phaseMeta.subtitle; }
    else { centerLabel = daysUntil !== null ? (daysUntil === 0 ? "Today" : `${daysUntil}d`) : "-"; centerSub = "until next period"; }
  }

  if (loading) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}><ActivityIndicator size="large" color={T.pink.primary} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg.screen, paddingTop: 48 }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120, backgroundColor: T.bg.screen }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.pink.primary} />}>

        {/* ── Pink Header ────────────────────────────────────────────────── */}
        <View style={{ backgroundColor: T.bg.header, paddingTop: 8, paddingBottom: 64, position: "relative", overflow: "hidden", minHeight: 460 }}>

          {/* Top nav */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, marginBottom: 20, zIndex: 20 }}>
            <View>
              <Text style={{ fontSize: 12, color: T.text.muted, fontWeight: "600" }}>Hello, {firstName}</Text>
              <Text style={{ fontSize: 16, fontWeight: "900", color: T.text.primary }}>
                {today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {/* Bluetooth Connect Option */}
              <TouchableOpacity
                onPress={() => router.push("/ble-device" as any)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: isDeviceConnected ? "#ecfdf5" : "#fff",
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  elevation: 3,
                  shadowColor: isDeviceConnected ? "#10b981" : T.pink.primary,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 6,
                  borderWidth: 1,
                  borderColor: isDeviceConnected ? "#a7f3d0" : "#fce7f3",
                }}
                activeOpacity={0.85}
              >
                <Feather
                  name="bluetooth"
                  size={16}
                  color={isDeviceConnected ? "#10b981" : T.pink.primary}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: isDeviceConnected ? "#065f46" : T.pink.primary,
                  }}
                >
                  {isDeviceConnected ? "Connected" : "Pair Device"}
                </Text>
              </TouchableOpacity>

              {/* Calendar Toggle Button */}
              <TouchableOpacity
                onPress={() => setShowCalendar(p => !p)}
                style={{
                  backgroundColor: showCalendar ? T.pink.primary : "#fff",
                  borderRadius: 14,
                  padding: 10,
                  elevation: 3,
                  shadowColor: T.pink.primary,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 8,
                  borderWidth: 1,
                  borderColor: "#fce7f3",
                }}
              >
                <Feather name="calendar" size={18} color={showCalendar ? "#fff" : T.pink.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Phase badge */}
          {hasData && (
            <View style={{ alignSelf: "center", backgroundColor: T.pink.light, paddingHorizontal: 16, paddingVertical: 5, borderRadius: 20, marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.pink.primary }} />
              <Text style={{ fontSize: 12, fontWeight: "800", color: T.pink.primary, textTransform: "uppercase", letterSpacing: 1 }}>{phaseMeta.label} Phase</Text>
            </View>
          )}

          {/* Concentric rings + circle */}
          <View style={{ alignItems: "center", justifyContent: "center", zIndex: 10 }}>
            <View style={{ position: "absolute", backgroundColor: T.pink.ring1, borderRadius: 999, width: 380, height: 380 }} />
            <View style={{ position: "absolute", backgroundColor: T.pink.ring2, borderRadius: 999, width: 280, height: 280 }} />
            <Animated.View style={{ transform: [{ scale: pulseAnim }], width: 220, height: 220, borderRadius: 110, backgroundColor: T.pink.primary, alignItems: "center", justifyContent: "center", shadowColor: T.pink.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12, padding: 20, zIndex: 20, marginTop: 8 }}>
              {isOngoing && hasData && (
                <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>{phaseMeta.label}:</Text>
              )}
              <Text style={{ color: "#fff", fontSize: 48, fontWeight: "900", lineHeight: 52, letterSpacing: -2, textAlign: "center" }}>{centerLabel}</Text>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, textAlign: "center", fontWeight: "600", marginTop: 4, paddingHorizontal: 12, lineHeight: 16 }}>{centerSub}</Text>
              <TouchableOpacity onPress={() => setShowLogModal(true)}
                style={{ backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)" }}>
                <Text style={{ color: T.pink.primary, fontWeight: "800", fontSize: 11 }}>
                  {isOngoing && hasData ? "Log Flow" : hasData ? "Log Period" : "Start Tracking"}
                </Text>
                <Feather name="plus" size={12} color={T.pink.primary} />
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Wave */}
          <View style={{ position: "absolute", bottom: -1, width: "100%", height: 60, zIndex: 10 }}>
            <Svg width={width} height="60" viewBox="0 0 1440 120" preserveAspectRatio="none">
              <Path fill="#ffffff" d="M0,60 C320,120 420,0 720,60 C1020,120 1120,0 1440,60 L1440,120 L0,120 Z" />
            </Svg>
          </View>
        </View>

        {/* ── Calendar ───────────────────────────────────────────────────── */}
        {showCalendar && (
          <View style={{ marginHorizontal: 20, marginTop: 20, backgroundColor: "#fff", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: T.border.pink, elevation: 4, shadowColor: T.pink.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: "900", color: T.text.primary, marginBottom: 16 }}>
              {MONTH_NAMES[calMonth - 1]} {calYear}
            </Text>
            <MiniCalendar year={calYear} month={calMonth} cycles={calCycles} summary={summary} />
          </View>
        )}

        {/* ── Insight cards ──────────────────────────────────────────────── */}
        {hasData && (
          <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: "900", color: T.text.primary, marginBottom: 14 }}>Cycle Insights</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 24 }}>

              {/* Avg cycle length */}
              <View style={{ backgroundColor: T.pink.bg, borderRadius: 20, padding: 16, width: 130, borderWidth: 1, borderColor: T.border.pink }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: T.pink.primary, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <Feather name="refresh-cw" size={16} color="#fff" />
                </View>
                <Text style={{ fontSize: 26, fontWeight: "900", color: T.pink.dark, lineHeight: 28 }}>{avgLen}</Text>
                <Text style={{ fontSize: 11, color: T.pink.primary, fontWeight: "700" }}>day cycle</Text>
                <Text style={{ fontSize: 10, color: T.text.muted, marginTop: 4, fontWeight: "600" }}>avg length</Text>
              </View>

              {/* Avg period duration */}
              {!!summary?.avgPeriodDuration && (
                <View style={{ backgroundColor: T.pink.bg, borderRadius: 20, padding: 16, width: 130, borderWidth: 1, borderColor: T.border.pink }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: T.pink.dark, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <Feather name="droplet" size={16} color="#fff" />
                  </View>
                  <Text style={{ fontSize: 26, fontWeight: "900", color: T.pink.dark, lineHeight: 28 }}>{summary.avgPeriodDuration}</Text>
                  <Text style={{ fontSize: 11, color: T.pink.primary, fontWeight: "700" }}>day period</Text>
                  <Text style={{ fontSize: 10, color: T.text.muted, marginTop: 4, fontWeight: "600" }}>avg duration</Text>
                </View>
              )}

              {/* Days until next */}
              {daysUntil !== null && !isOngoing && (
                <View style={{ backgroundColor: "#fff5fa", borderRadius: 20, padding: 16, width: 130, borderWidth: 1, borderColor: T.border.pink }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: T.pink.action, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <Feather name="clock" size={16} color="#fff" />
                  </View>
                  <Text style={{ fontSize: 26, fontWeight: "900", color: T.pink.dark, lineHeight: 28 }}>{daysUntil}d</Text>
                  <Text style={{ fontSize: 11, color: T.pink.primary, fontWeight: "700" }}>until period</Text>
                  <Text style={{ fontSize: 10, color: T.text.muted, marginTop: 4, fontWeight: "600" }}>{fmtShort(summary?.nextPeriodDate)}</Text>
                </View>
              )}

              {/* Fertile window */}
              {!!summary?.fertileWindowStart && (
                <View style={{ backgroundColor: T.pink.bg, borderRadius: 20, padding: 16, width: 130, borderWidth: 1, borderColor: T.border.pink }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: palette.pink400, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <Ionicons name="flower" size={16} color="#fff" />
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: "900", color: T.pink.dark, lineHeight: 16 }}>{fmtShort(summary?.fertileWindowStart)}</Text>
                  <Text style={{ fontSize: 10, color: T.text.muted }}>to</Text>
                  <Text style={{ fontSize: 11, fontWeight: "900", color: T.pink.dark }}>{fmtShort(summary?.fertileWindowEnd)}</Text>
                  <Text style={{ fontSize: 10, color: T.pink.primary, fontWeight: "700", marginTop: 4 }}>fertile window</Text>
                </View>
              )}

              {/* Irregular warning */}
              {summary?.isIrregular && (
                <View style={{ backgroundColor: "#fff8f0", borderRadius: 20, padding: 16, width: 130, borderWidth: 1, borderColor: "#fed7aa" }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#f97316", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <Feather name="alert-triangle" size={16} color="#fff" />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: "900", color: "#7c2d12", lineHeight: 18 }}>Irregular{"\n"}Cycle</Text>
                  <Text style={{ fontSize: 10, color: T.text.muted, marginTop: 4, fontWeight: "600" }}>detected</Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {/* ── No data state ───────────────────────────────────────────────── */}
        {!hasData && (
          <View style={{ marginHorizontal: 20, marginTop: 24, backgroundColor: T.pink.bg, borderRadius: 28, padding: 28, alignItems: "center", borderWidth: 1, borderColor: T.border.pink }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🌸</Text>
            <Text style={{ fontSize: 20, fontWeight: "900", color: T.text.primary, textAlign: "center", marginBottom: 8 }}>Start Tracking Your Cycle</Text>
            <Text style={{ fontSize: 14, color: T.text.muted, textAlign: "center", lineHeight: 22, marginBottom: 24 }}>
              Log your first period to unlock predictions, fertile windows, and personalized insights.
            </Text>
            <TouchableOpacity onPress={() => setShowLogModal(true)} style={{ backgroundColor: T.pink.primary, borderRadius: 20, paddingHorizontal: 32, paddingVertical: 14 }}>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>Log My First Period</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── History ────────────────────────────────────────────────────── */}
        {history.length > 0 && (
          <View style={{ marginTop: 28, paddingHorizontal: 20 }}>
            <TouchableOpacity onPress={() => setShowHistory(p => !p)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <Text style={{ fontSize: 20, fontWeight: "900", color: T.text.primary }}>Cycle History</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 13, color: T.pink.primary, fontWeight: "700" }}>{showHistory ? "Hide" : "Show all"}</Text>
                <Feather name={showHistory ? "chevron-up" : "chevron-down"} size={16} color={T.pink.primary} />
              </View>
            </TouchableOpacity>
            {showHistory && history.map((c, i) => (
              <CycleHistoryCard key={c._id} cycle={c} index={i} onDelete={() => handleDelete(c._id)} />
            ))}
          </View>
        )}


        {/* ── Wellness Hub ───────────────────────────────────────────────── */}
        <View style={{ marginTop: 28, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Text style={{ fontSize: 20, fontWeight: "900", color: T.text.primary }}>Your Wellness</Text>
            <TouchableOpacity onPress={() => router.push("/wellness" as any)}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: T.pink.bg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: T.pink.border }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: T.pink.primary }}>All Tools</Text>
              <Feather name="arrow-right" size={12} color={T.pink.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 24 }}>
            {[
              { icon: "pulse-outline",         label: "Symptoms",  sub: "15 markers", route: "/symptoms-tracker" },
              { icon: "happy-outline",         label: "Mood",      sub: "Daily log",  route: "/mood-tracker" },
              { icon: "water-outline",         label: "Hydration", sub: "2.5L goal",  route: "/hydration-tracker" },
              { icon: "moon-outline",          label: "Sleep",     sub: "Rest index", route: "/sleep-tracker" },
              { icon: "fitness-outline",       label: "Exercises", sub: "Spasm relief",route: "/exercises" },
              { icon: "leaf-outline",          label: "Breathing", sub: "Calm vagus", route: "/breathing" },
              { icon: "restaurant-outline",    label: "Nutrition", sub: "Phase diet", route: "/nutrition" },
              { icon: "medkit-outline",        label: "Meds",      sub: "Schedule",   route: "/medication-reminder" },
            ].map(it => (
              <TouchableOpacity key={it.label} onPress={() => router.push(it.route as any)}
                style={{ width: 94, height: 112, backgroundColor: "#ffffff", borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#fce7f3", padding: 10, shadowColor: T.pink.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
                activeOpacity={0.82}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#fdf2f8", alignItems: "center", justifyContent: "center", marginBottom: 8, borderWidth: 1, borderColor: "#fce7f3" }}>
                  <Ionicons name={it.icon as any} size={22} color={T.pink.primary} />
                </View>
                <Text style={{ fontSize: 12, fontWeight: "800", color: T.text.primary, textAlign: "center" }}>{it.label}</Text>
                <Text style={{ fontSize: 9, fontWeight: "600", color: T.text.muted, marginTop: 2 }}>{it.sub}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Quick Actions ──────────────────────────────────────────────── */}
        <View style={{ marginTop: 28, paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: "900", color: T.text.primary, marginBottom: 14 }}>Quick Relief</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 24 }}>
            {/* 1. Log Symptoms */}
            <TouchableOpacity onPress={() => router.push("/symptoms-tracker" as any)}
              style={{ backgroundColor: "#ffffff", width: 140, height: 165, borderRadius: 26, padding: 18, justifyContent: "space-between", borderWidth: 1, borderColor: "#fce7f3", shadowColor: T.pink.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 }}
              activeOpacity={0.85}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#fdf2f8", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#fce7f3" }}>
                <Ionicons name="pulse-outline" size={22} color={T.pink.primary} />
              </View>
              <View>
                <Text style={{ color: T.pink.primary, fontWeight: "800", fontSize: 11, letterSpacing: 0.4 }}>BIOMARKERS</Text>
                <Text style={{ color: T.text.primary, fontWeight: "900", fontSize: 16, marginTop: 2, lineHeight: 20 }}>Log Daily{"\n"}Symptoms</Text>
              </View>
            </TouchableOpacity>

            {/* 2. Vagus Nerve Breathing */}
            <TouchableOpacity onPress={() => router.push("/breathing" as any)}
              style={{ backgroundColor: "#831843", width: 155, height: 165, borderRadius: 26, padding: 18, justifyContent: "space-between", position: "relative", overflow: "hidden", shadowColor: "#831843", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 4 }}
              activeOpacity={0.85}>
              <View style={{ backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, alignSelf: "flex-start" }}>
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>5 MIN SESSION</Text>
              </View>
              <View>
                <Text style={{ color: "#fbcfe8", fontWeight: "700", fontSize: 11 }}>VAGUS RELAXATION</Text>
                <Text style={{ color: "#ffffff", fontWeight: "900", fontSize: 16, marginTop: 2, lineHeight: 20 }}>Breathing{"\n"}Calm Protocol</Text>
              </View>
              <View style={{ position: "absolute", bottom: -16, right: -10, opacity: 0.15 }}>
                <Ionicons name="leaf" size={88} color="white" />
              </View>
            </TouchableOpacity>

            {/* 3. Physical Stretches */}
            <TouchableOpacity onPress={() => router.push("/exercises" as any)}
              style={{ backgroundColor: "#be185d", width: 155, height: 165, borderRadius: 26, padding: 18, justifyContent: "space-between", position: "relative", overflow: "hidden", shadowColor: "#be185d", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 4 }}
              activeOpacity={0.85}>
              <View style={{ backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, alignSelf: "flex-start" }}>
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>10 MIN ROUTINE</Text>
              </View>
              <View>
                <Text style={{ color: "#fbcfe8", fontWeight: "700", fontSize: 11 }}>SPASM RELEASE</Text>
                <Text style={{ color: "#ffffff", fontWeight: "900", fontSize: 16, marginTop: 2, lineHeight: 20 }}>Pelvic Relief{"\n"}Exercises</Text>
              </View>
              <View style={{ position: "absolute", bottom: -16, right: -8, opacity: 0.15 }}>
                <Ionicons name="fitness" size={88} color="white" />
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* ── Her Comfort Bluetooth Device Connect ── */}
        <View style={{ marginTop: 28, paddingHorizontal: 20 }}>
          <TouchableOpacity
            onPress={() => router.push("/ble-device" as any)}
            activeOpacity={0.85}
            style={{
              backgroundColor: isDeviceConnected ? "#052e16" : "#831843",
              borderRadius: 28,
              padding: 20,
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
              shadowColor: isDeviceConnected ? "#16a34a" : "#be185d",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.22,
              shadowRadius: 20,
              elevation: 8,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: isDeviceConnected ? "#22c55e40" : "#f472b640",
            }}
          >
            <View style={{
              position: "absolute", top: -30, right: -30,
              width: 120, height: 120, borderRadius: 60,
              backgroundColor: (isDeviceConnected ? "#22c55e" : "#ffb3cc") + "25",
            }} />
            <View style={{
              width: 54, height: 54, borderRadius: 27,
              backgroundColor: (isDeviceConnected ? "#22c55e" : "#ffffff") + "25",
              alignItems: "center", justifyContent: "center",
              borderWidth: 1.5, borderColor: (isDeviceConnected ? "#22c55e" : "#ffffff") + "50",
            }}>
              <Feather name="bluetooth" size={26} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <Text style={{ fontSize: 16, fontWeight: "900", color: "#fff" }}>
                  {connectedDevice?.name || "Her Comfort Device"}
                </Text>
                {isDeviceConnected && (
                  <View style={{ backgroundColor: "#22c55e30", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ color: "#4ade80", fontSize: 9, fontWeight: "800" }}>CONNECTED</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 12, color: isDeviceConnected ? "#86efac" : "#fce7f3", fontWeight: "500" }}>
                {isDeviceConnected
                  ? `Active · 🌡️ ${Number(liveData?.temp ?? liveData?.temperature ?? 36.5).toFixed(1)}°C · Tap to manage`
                  : "Tap to scan & connect your Bluetooth relief band"}
              </Text>
            </View>
            <View style={{
              backgroundColor: "rgba(255,255,255,0.2)",
              borderRadius: 12, padding: 8,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
            }}>
              <Feather name="arrow-right" size={18} color="#ffffff" />
            </View>
          </TouchableOpacity>
        </View>

      </ScrollView>

      <LogPeriodModal visible={showLogModal} onClose={() => setShowLogModal(false)} onSaved={fetchAll} activeCycle={activeCycle} />
    </View>
  );
}
