import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { T } from "../constants/theme";
import wellnessService, { SleepEntry, SleepInsights } from "../services/wellnessService";

const BEDTIMES  = ["9 PM","10 PM","11 PM","12 AM","1 AM","2 AM"];
const WAKETIMES = ["4 AM","5 AM","6 AM","7 AM","8 AM","9 AM","10 AM"];
const DURATIONS = [4,5,6,7,8,9,10];
const QUALITIES = [
  { label: "Terrible", icon: "emoticon-dead-outline",    value: 1, emoji: "😩" },
  { label: "Poor",     icon: "emoticon-sad-outline",     value: 2, emoji: "😔" },
  { label: "Okay",     icon: "emoticon-neutral-outline", value: 3, emoji: "😐" },
  { label: "Good",     icon: "emoticon-happy-outline",   value: 4, emoji: "🙂" },
  { label: "Great",    icon: "emoticon-excited-outline", value: 5, emoji: "😁" },
];

export default function SleepTracker() {
  const router = useRouter();
  const [duration, setDuration]  = useState(7);
  const [quality,  setQuality]   = useState(3);
  const [bedtime,  setBedtime]   = useState("10 PM");
  const [wakeTime, setWakeTime]  = useState("6 AM");
  const [saving,   setSaving]    = useState(false);
  const [loading,  setLoading]   = useState(true);
  const [history,  setHistory]   = useState<SleepEntry[]>([]);
  const [insights, setInsights]  = useState<SleepInsights | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [hist, ins] = await Promise.all([
        wellnessService.getSleepHistory(14),
        wellnessService.getSleepInsights(),
      ]);
      setHistory(hist);
      setInsights(ins);
      // Prefill with today's data if exists
      const t = hist.find(h => h.date === new Date().toISOString().split("T")[0]);
      if (t) { setDuration(t.duration); setQuality(t.quality); setBedtime(t.bedtime); setWakeTime(t.wakeTime); }
    } catch (e) { console.warn("sleep load", e); }
    finally { setLoading(false); }
  }

  async function save() {
    setSaving(true);
    try {
      await wellnessService.logSleep({ duration, quality, bedtime, wakeTime });
      const [hist, ins] = await Promise.all([wellnessService.getSleepHistory(14), wellnessService.getSleepInsights()]);
      setHistory(hist); setInsights(ins);
      Alert.alert("Saved", "Sleep data logged!");
    } catch (e: any) { Alert.alert("Error", e?.response?.data?.message || "Could not save."); }
    finally { setSaving(false); }
  }

  if (loading) return <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.bg.screen }}><ActivityIndicator size="large" color="#6366f1" /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg.screen }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.border.default }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Feather name="arrow-left" size={24} color={T.text.primary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "900", color: T.text.primary }}>Sleep Tracker</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Stats */}
        {insights && (
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 24 }}>
            {[{ label: "Avg Duration", value: `${insights.avgDuration}h`, color: "#6366f1" }, { label: "Avg Quality", value: `${insights.avgQuality}/5`, color: T.pink.primary }].map(s => (
              <View key={s.label} style={{ flex: 1, backgroundColor: "#fff0f7", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#fce7f3" }}>
                <Text style={{ fontSize: 11, color: T.pink.primary, fontWeight: "700", marginBottom: 6, textTransform: "uppercase" }}>{s.label}</Text>
                <Text style={{ fontSize: 26, fontWeight: "900", color: T.pink.dark }}>{s.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Duration */}
        <Text style={{ fontSize: 15, fontWeight: "900", color: T.text.primary, marginBottom: 12 }}>Sleep Duration</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginBottom: 24, paddingRight: 20 }}>
          {DURATIONS.map(d => (
            <TouchableOpacity key={d} onPress={() => setDuration(d)}
              style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: duration===d ? "#6366f1" : T.bg.input, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: duration===d ? "#6366f1" : "transparent" }}>
              <Text style={{ fontWeight: "900", color: duration===d ? "#fff" : T.text.secondary, fontSize: 18 }}>{d}</Text>
              <Text style={{ fontSize: 9, color: duration===d ? "rgba(255,255,255,0.8)" : T.text.muted, fontWeight: "600" }}>hrs</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Quality */}
        <Text style={{ fontSize: 15, fontWeight: "900", color: T.text.primary, marginBottom: 12 }}>Sleep Quality</Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 24 }}>
          {QUALITIES.map(q => {
            const active = quality === q.value;
            return (
              <TouchableOpacity key={q.value} onPress={() => setQuality(q.value)}
                style={{ flex: 1, backgroundColor: active ? "#6366f1" + "18" : "#fff", borderRadius: 16, padding: 10, alignItems: "center", borderWidth: 2, borderColor: active ? "#6366f1" : T.border.default }}>
                <MaterialCommunityIcons name={q.icon as any} size={24} color={active ? "#6366f1" : T.text.muted} />
                <Text style={{ fontSize: 10, fontWeight: "700", color: active ? "#6366f1" : T.text.muted, marginTop: 6 }}>{q.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bedtime */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Feather name="moon" size={14} color="#6366f1" />
          <Text style={{ fontSize: 13, fontWeight: "800", color: T.text.secondary }}>Bedtime</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
          {BEDTIMES.map(b => (
            <TouchableOpacity key={b} onPress={() => setBedtime(b)}
              style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: bedtime===b ? "#6366f1" : T.bg.input }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: bedtime===b ? "#fff" : T.text.secondary }}>{b}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Wake */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Feather name="sun" size={14} color="#f59e0b" />
          <Text style={{ fontSize: 13, fontWeight: "800", color: T.text.secondary }}>Wake Time</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 24 }}>
          {WAKETIMES.map(w => (
            <TouchableOpacity key={w} onPress={() => setWakeTime(w)}
              style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: wakeTime===w ? "#6366f1" : T.bg.input }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: wakeTime===w ? "#fff" : T.text.secondary }}>{w}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Save */}
        <TouchableOpacity onPress={save} disabled={saving}
          style={{ backgroundColor: "#6366f1", borderRadius: 20, paddingVertical: 16, alignItems: "center", elevation: 2, shadowColor: "#6366f1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 }}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>Log Sleep</Text>}
        </TouchableOpacity>

        {/* Insight */}
        {insights && (
          <View style={{ backgroundColor: "#eef2ff", borderRadius: 20, padding: 16, marginTop: 20, borderWidth: 1, borderColor: "#c7d2fe", flexDirection: "row", gap: 12, alignItems: "center" }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
              <Feather name="info" size={18} color="#4338ca" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#4338ca", marginBottom: 2 }}>Sleep Insight</Text>
              <Text style={{ fontSize: 13, color: "#6b7280", lineHeight: 20 }}>{insights.message}</Text>
            </View>
          </View>
        )}

        {/* History */}
        {history.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <Text style={{ fontSize: 18, fontWeight: "900", color: T.text.primary, marginBottom: 14 }}>Recent History</Text>
            {history.slice(0, 5).map((h, i) => {
              const q = QUALITIES.find(x => x.value === h.quality);
              return (
                <View key={i} style={{ backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: T.border.default }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#eef2ff", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                    <Text style={{ fontWeight: "900", color: "#6366f1", fontSize: 15 }}>{h.duration}h</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "800", color: T.text.primary }}>{h.bedtime} → {h.wakeTime}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <MaterialCommunityIcons name={(q?.icon as any) || "emoticon-neutral-outline"} size={14} color={T.text.muted} />
                      <Text style={{ fontSize: 12, color: T.text.muted }}>{q?.label}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, color: T.text.muted }}>
                    {new Date(h.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
