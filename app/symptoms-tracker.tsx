import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { T } from "../constants/theme";
import wellnessService, { SymptomEntry, SymptomInsights } from "../services/wellnessService";

const ALL_SYMPTOMS = [
  { key: "cramps",            label: "Cramps",            icon: "pulse-outline" },
  { key: "bloating",          label: "Bloating",          icon: "radio-button-on-outline" },
  { key: "headache",          label: "Headache",          icon: "alert-circle-outline" },
  { key: "acne",              label: "Acne",              icon: "sparkles-outline" },
  { key: "breast_tenderness", label: "Breast Tenderness", icon: "heart-dislike-outline" },
  { key: "fatigue",           label: "Fatigue",           icon: "battery-dead-outline" },
  { key: "nausea",            label: "Nausea",            icon: "medkit-outline" },
  { key: "back_pain",         label: "Back Pain",         icon: "body-outline" },
  { key: "food_cravings",     label: "Food Cravings",     icon: "restaurant-outline" },
  { key: "constipation",      label: "Constipation",      icon: "timer-outline" },
  { key: "diarrhea",          label: "Diarrhea",          icon: "water-outline" },
  { key: "mood_swings",       label: "Mood Swings",       icon: "swap-horizontal-outline" },
  { key: "anxiety",           label: "Anxiety",           icon: "cloud-outline" },
  { key: "insomnia",          label: "Insomnia",          icon: "moon-outline" },
  { key: "spotting",          label: "Spotting",          icon: "water" },
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
      Alert.alert("Saved", "Symptoms logged for today.");
    } catch (e: any) { Alert.alert("Error", e?.response?.data?.message || "Could not save."); }
    finally { setSaving(false); }
  }

  if (loading) return <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.bg.screen }}><ActivityIndicator size="large" color={T.pink.primary} /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg.screen }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.border.default }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Feather name="arrow-left" size={24} color={T.text.primary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "900", color: T.text.primary }}>Symptoms Tracker</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Pattern insight */}
        {insights && insights.topSymptoms.length > 0 && (
          <View style={{ backgroundColor: "#fff0f7", borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#fce7f3" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Ionicons name="analytics-outline" size={16} color={T.pink.primary} />
              <Text style={{ fontSize: 13, fontWeight: "800", color: T.pink.primary }}>Your Symptom Pattern</Text>
            </View>
            <Text style={{ fontSize: 12, color: T.text.muted, marginBottom: 10 }}>Most frequent over {insights.totalLogs} log entries:</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {insights.topSymptoms.slice(0, 3).map(ts => {
                const sym = ALL_SYMPTOMS.find(s => s.key === ts.key);
                return (
                  <View key={ts.key} style={{ backgroundColor: "#fff", borderRadius: 14, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#fce7f3", flex: 1 }}>
                    <Ionicons name={(sym?.icon as any) || "pulse-outline"} size={22} color={T.pink.primary} />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: T.pink.primary, textAlign: "center", marginTop: 4 }}>{sym?.label || ts.key}</Text>
                    <Text style={{ fontSize: 10, color: T.text.muted, marginTop: 2 }}>{ts.count}x</Text>
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
                style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: sel ? T.pink.bg : T.bg.input, borderWidth: 1.5, borderColor: sel ? T.pink.primary : "transparent", flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name={s.icon as any} size={18} color={sel ? T.pink.primary : T.text.muted} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: sel ? T.pink.primary : T.text.muted }}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity onPress={() => setSelected([])}
          style={{ backgroundColor: T.bg.input, borderRadius: 16, paddingVertical: 14, alignItems: "center", marginBottom: 20, borderWidth: 1, borderColor: selected.length === 0 ? T.pink.primary : "transparent", flexDirection: "row", justifyContent: "center", gap: 6 }}>
          <Ionicons name="checkmark-circle-outline" size={18} color={selected.length === 0 ? T.pink.primary : T.text.muted} />
          <Text style={{ fontWeight: "700", color: selected.length === 0 ? T.pink.primary : T.text.muted }}>No symptoms today</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={save} disabled={saving}
          style={{ backgroundColor: T.pink.primary, borderRadius: 20, paddingVertical: 16, alignItems: "center", marginBottom: 28, elevation: 3, shadowColor: T.pink.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 }}>
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
                    ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Ionicons name="checkmark-circle" size={14} color="#22c55e" /><Text style={{ fontSize: 12, color: "#22c55e", fontWeight: "600" }}>No symptoms</Text></View>
                    : h.symptoms.map(sk => {
                        const sym = ALL_SYMPTOMS.find(x => x.key === sk);
                        return (
                          <View key={sk} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: T.pink.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
                            <Ionicons name={(sym?.icon as any) || "ellipse-outline"} size={12} color={T.pink.primary} />
                            <Text style={{ fontSize: 11, fontWeight: "600", color: T.pink.dark }}>{sym?.label || sk}</Text>
                          </View>
                        );
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
