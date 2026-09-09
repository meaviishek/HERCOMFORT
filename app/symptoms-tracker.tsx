import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { T } from "../constants/theme";
import wellnessService, { SymptomEntry, SymptomInsights } from "../services/wellnessService";

const ALL_SYMPTOMS = [
  { key: "cramps",            label: "Cramps",            emoji: "🌀" },
  { key: "bloating",          label: "Bloating",          emoji: "🫧" },
  { key: "headache",          label: "Headache",          emoji: "🤕" },
  { key: "acne",              label: "Acne",              emoji: "😓" },
  { key: "breast_tenderness", label: "Breast Tenderness", emoji: "💔" },
  { key: "fatigue",           label: "Fatigue",           emoji: "😴" },
  { key: "nausea",            label: "Nausea",            emoji: "🤢" },
  { key: "back_pain",         label: "Back Pain",         emoji: "😣" },
  { key: "food_cravings",     label: "Food Cravings",     emoji: "🍩" },
  { key: "constipation",      label: "Constipation",      emoji: "😰" },
  { key: "diarrhea",          label: "Diarrhea",          emoji: "💨" },
  { key: "mood_swings",       label: "Mood Swings",       emoji: "😤" },
  { key: "anxiety",           label: "Anxiety",           emoji: "😱" },
  { key: "insomnia",          label: "Insomnia",          emoji: "🌙" },
  { key: "spotting",          label: "Spotting",          emoji: "🩸" },
];

const today = new Date().toISOString().split("T")[0];

export default function SymptomsTracker() {
  const router = useRouter();
  const [selected,  setSelected]  = useState<string[]>([]);
  const [history,   setHistory]   = useState<SymptomEntry[]>([]);
  const [insights,  setInsights]  = useState<SymptomInsights | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [hist, ins] = await Promise.all([
        wellnessService.getSymptomsHistory(30),
        wellnessService.getSymptomInsights(),
      ]);
      setHistory(hist);
      setInsights(ins);
      const todayEntry = hist.find(h => h.date === today);
      if (todayEntry) setSelected(todayEntry.symptoms);
    } catch (e) { console.warn("symptoms load", e); }
    finally { setLoading(false); }
  }

  function toggle(key: string) {
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  async function save() {
    setSaving(true);
    try {
      await wellnessService.logSymptoms(selected, today);
      const [hist, ins] = await Promise.all([wellnessService.getSymptomsHistory(30), wellnessService.getSymptomInsights()]);
      setHistory(hist); setInsights(ins);
      Alert.alert("Saved! 📝", "Symptoms logged for today.");
    } catch (e: any) { Alert.alert("Error", e?.response?.data?.message || "Could not save."); }
    finally { setSaving(false); }
  }

  if (loading) return <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.bg.screen }}><ActivityIndicator size="large" color="#a855f7" /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg.screen }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.border.default }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Feather name="arrow-left" size={24} color={T.text.primary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "900", color: T.text.primary }}>📝 Symptoms Tracker</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Pattern insight */}
        {insights && insights.topSymptoms.length > 0 && (
          <View style={{ backgroundColor: "#fdf0ff", borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#e9d5ff" }}>
            <Text style={{ fontSize: 13, fontWeight: "800", color: "#7c3aed", marginBottom: 8 }}>🔮 Your Symptom Pattern</Text>
            <Text style={{ fontSize: 12, color: T.text.muted, marginBottom: 10 }}>Most frequent over {insights.totalLogs} log entries:</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {insights.topSymptoms.slice(0, 3).map(ts => {
                const sym = ALL_SYMPTOMS.find(s => s.key === ts.key);
                return (
                  <View key={ts.key} style={{ backgroundColor: "#fff", borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#e9d5ff", flex: 1 }}>
                    <Text style={{ fontSize: 22 }}>{sym?.emoji}</Text>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#7c3aed", textAlign: "center", marginTop: 2 }}>{sym?.label}</Text>
                    <Text style={{ fontSize: 10, color: T.text.muted }}>{ts.count}x</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: "900", color: T.text.primary }}>Today's Symptoms</Text>
          <View style={{ backgroundColor: T.pink.bg, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: T.pink.primary }}>{selected.length} selected</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
          {ALL_SYMPTOMS.map(s => {
            const sel = selected.includes(s.key);
            return (
              <TouchableOpacity key={s.key} onPress={() => toggle(s.key)}
                style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: sel ? T.pink.bg : T.bg.input, borderWidth: 1.5, borderColor: sel ? T.pink.primary : "transparent", flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 16 }}>{s.emoji}</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: sel ? T.pink.primary : T.text.muted }}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity onPress={() => setSelected([])}
          style={{ backgroundColor: T.bg.input, borderRadius: 16, paddingVertical: 14, alignItems: "center", marginBottom: 20, borderWidth: 1, borderColor: selected.length === 0 ? T.pink.primary : "transparent" }}>
          <Text style={{ fontWeight: "700", color: selected.length === 0 ? T.pink.primary : T.text.muted }}>✨ No symptoms today</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={save} disabled={saving}
          style={{ backgroundColor: "#a855f7", borderRadius: 20, paddingVertical: 16, alignItems: "center", marginBottom: 28 }}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>Save Symptoms</Text>}
        </TouchableOpacity>

        {history.length > 0 && (
          <View>
            <Text style={{ fontSize: 18, fontWeight: "900", color: T.text.primary, marginBottom: 14 }}>Recent History</Text>
            {history.slice(0, 7).map((h, i) => (
              <View key={i} style={{ backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: T.border.default }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ fontWeight: "800", color: T.text.primary }}>
                    {new Date(h.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                  </Text>
                  <Text style={{ fontSize: 12, color: T.text.muted }}>{h.symptoms.length} symptom{h.symptoms.length !== 1 ? "s" : ""}</Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {h.symptoms.length === 0
                    ? <Text style={{ fontSize: 12, color: "#22c55e", fontWeight: "600" }}>✨ No symptoms</Text>
                    : h.symptoms.map(sk => {
                        const sym = ALL_SYMPTOMS.find(x => x.key === sk);
                        return <Text key={sk} style={{ fontSize: 13 }}>{sym?.emoji}</Text>;
                      })
                  }
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
