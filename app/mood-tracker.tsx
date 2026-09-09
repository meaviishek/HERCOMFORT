import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { T } from "../constants/theme";
import wellnessService, { MoodEntry } from "../services/wellnessService";

const MOODS = [
  { emoji: "😊", label: "Happy",    value: "happy",    color: "#f59e0b" },
  { emoji: "🙂", label: "Good",     value: "good",     color: "#22c55e" },
  { emoji: "😐", label: "Neutral",  value: "neutral",  color: "#94a3b8" },
  { emoji: "😔", label: "Sad",      value: "sad",      color: "#6366f1" },
  { emoji: "😡", label: "Irritated",value: "irritated",color: "#ef4444" },
  { emoji: "😴", label: "Tired",    value: "tired",    color: "#8b5cf6" },
  { emoji: "😰", label: "Anxious",  value: "anxious",  color: "#f97316" },
];

const today = new Date().toISOString().split("T")[0];

export default function MoodTracker() {
  const router = useRouter();
  const [selected,   setSelected]   = useState<string | null>(null);
  const [note,       setNote]       = useState("");
  const [saving,     setSaving]     = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [history,    setHistory]    = useState<MoodEntry[]>([]);
  const [todayEntry, setTodayEntry] = useState<MoodEntry | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const hist = await wellnessService.getMoodHistory(30);
      setHistory(hist);
      const t = hist.find(h => h.date === today);
      if (t) { setTodayEntry(t); setSelected(t.value); setNote(t.note || ""); }
    } catch (e) { console.warn("mood load err", e); }
    finally { setLoading(false); }
  }

  async function saveMood() {
    if (!selected) { Alert.alert("Select a mood first!"); return; }
    const mood = MOODS.find(m => m.value === selected)!;
    try {
      setSaving(true);
      await wellnessService.logMood({ value: mood.value, emoji: mood.emoji, label: mood.label, note, date: today });
      const entry: MoodEntry = { value: mood.value, emoji: mood.emoji, label: mood.label, note, date: today };
      setTodayEntry(entry);
      const updated = [entry, ...history.filter(h => h.date !== today)];
      setHistory(updated);
      Alert.alert("Saved! 😊", "Your mood has been logged.");
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.message || "Could not save mood.");
    } finally { setSaving(false); }
  }

  function getInsight(): string | null {
    if (history.length < 5) return null;
    const low = history.filter(h => ["sad","irritated","anxious"].includes(h.value));
    if (low.length >= 2) return "You often experience mood changes during your cycle. Tracking over time reveals clear patterns! 🌸";
    return "Your mood looks generally positive! Keep it up 💪";
  }

  const insight = getInsight();
  const selectedMood = MOODS.find(m => m.value === selected);

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg.screen, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" color={T.pink.primary} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg.screen }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.border.default }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Feather name="arrow-left" size={24} color={T.text.primary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "900", color: T.text.primary }}>😊 Mood Tracker</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {todayEntry && (
          <View style={{ backgroundColor: T.pink.bg, borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: T.pink.border, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ fontSize: 36 }}>{todayEntry.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: T.text.muted, fontWeight: "600" }}>TODAY'S MOOD</Text>
              <Text style={{ fontSize: 18, fontWeight: "900", color: T.text.primary }}>{todayEntry.label}</Text>
              {todayEntry.note ? <Text style={{ fontSize: 12, color: T.text.muted, marginTop: 2 }}>{todayEntry.note}</Text> : null}
            </View>
          </View>
        )}

        <Text style={{ fontSize: 16, fontWeight: "900", color: T.text.primary, marginBottom: 14 }}>How are you feeling?</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
          {MOODS.map(m => {
            const active = selected === m.value;
            return (
              <TouchableOpacity key={m.value} onPress={() => setSelected(m.value)}
                style={{ width: "30%", backgroundColor: active ? m.color + "22" : T.bg.input, borderRadius: 16, padding: 14, alignItems: "center", borderWidth: 2, borderColor: active ? m.color : "transparent" }}>
                <Text style={{ fontSize: 32, marginBottom: 6 }}>{m.emoji}</Text>
                <Text style={{ fontSize: 12, fontWeight: "700", color: active ? m.color : T.text.muted }}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={{ fontSize: 14, fontWeight: "800", color: T.text.secondary, marginBottom: 8 }}>Add a note (optional)</Text>
        <TextInput value={note} onChangeText={setNote} placeholder="What's on your mind today?" placeholderTextColor={T.text.muted}
          multiline numberOfLines={3}
          style={{ backgroundColor: T.bg.input, borderRadius: 16, padding: 16, fontSize: 14, color: T.text.primary, textAlignVertical: "top", minHeight: 80, marginBottom: 20, borderWidth: 1, borderColor: T.border.default }} />

        <TouchableOpacity onPress={saveMood} disabled={saving || !selected}
          style={{ backgroundColor: selected ? selectedMood!.color : T.text.muted, borderRadius: 20, paddingVertical: 16, alignItems: "center", opacity: selected ? 1 : 0.5 }}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>Log Mood</Text>}
        </TouchableOpacity>

        {insight && (
          <View style={{ backgroundColor: "#fdf0ff", borderRadius: 20, padding: 16, marginTop: 24, borderWidth: 1, borderColor: "#e9d5ff", flexDirection: "row", gap: 10 }}>
            <Text style={{ fontSize: 20 }}>🔮</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#7c3aed", marginBottom: 4 }}>Cycle Insight</Text>
              <Text style={{ fontSize: 13, color: "#6b7280", lineHeight: 19 }}>{insight}</Text>
            </View>
          </View>
        )}

        {history.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <Text style={{ fontSize: 18, fontWeight: "900", color: T.text.primary, marginBottom: 14 }}>Recent History</Text>
            {history.slice(0, 7).map((h, i) => {
              const m = MOODS.find(x => x.value === h.value);
              return (
                <View key={i} style={{ backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: T.border.default, gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: (m?.color ?? "#e84ea1") + "18", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 24 }}>{h.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "800", color: T.text.primary }}>{h.label}</Text>
                    {h.note ? <Text style={{ fontSize: 12, color: T.text.muted, marginTop: 2 }}>{h.note}</Text> : null}
                  </View>
                  <Text style={{ fontSize: 11, color: T.text.muted, fontWeight: "600" }}>
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
