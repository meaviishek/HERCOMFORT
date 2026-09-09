import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { T } from "../constants/theme";

const { width } = Dimensions.get("window");

const FEATURES = [
  {
    id: "mood",
    emoji: "😊",
    title: "Mood Tracker",
    subtitle: "Log how you feel today",
    bg: "#fff0f4",
    accent: "#e84ea1",
    route: "/mood-tracker",
  },
  {
    id: "sleep",
    emoji: "💤",
    title: "Sleep Tracker",
    subtitle: "Track sleep quality",
    bg: "#f0f4ff",
    accent: "#6366f1",
    route: "/sleep-tracker",
  },
  {
    id: "hydration",
    emoji: "💧",
    title: "Hydration",
    subtitle: "Daily water intake",
    bg: "#e0f7ff",
    accent: "#0ea5e9",
    route: "/hydration-tracker",
  },
  {
    id: "symptoms",
    emoji: "📝",
    title: "Symptoms",
    subtitle: "Track your symptoms",
    bg: "#fdf0ff",
    accent: "#a855f7",
    route: "/symptoms-tracker",
  },
  {
    id: "exercises",
    emoji: "🧘",
    title: "Relief Exercises",
    subtitle: "Period pain relief",
    bg: "#fff7f0",
    accent: "#f97316",
    route: "/exercises",
  },
  {
    id: "breathing",
    emoji: "🎧",
    title: "Breathing",
    subtitle: "Calm & relax",
    bg: "#f0fff4",
    accent: "#22c55e",
    route: "/breathing",
  },
  {
    id: "nutrition",
    emoji: "🍎",
    title: "Nutrition",
    subtitle: "Cycle-based food tips",
    bg: "#fff0f0",
    accent: "#ef4444",
    route: "/nutrition",
  },
  {
    id: "medication",
    emoji: "💊",
    title: "Medications",
    subtitle: "Reminders & history",
    bg: "#f0fff9",
    accent: "#10b981",
    route: "/medication-reminder",
  },
];

export default function WellnessHub() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg.screen }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: T.border.default }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Feather name="arrow-left" size={24} color={T.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: "900", color: T.text.primary }}>Wellness Hub 🌸</Text>
          <Text style={{ fontSize: 13, color: T.text.muted, fontWeight: "500" }}>All your health tools in one place</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Intro Banner */}
        <View style={{ backgroundColor: T.pink.bg, borderRadius: 24, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: T.pink.border }}>
          <Text style={{ fontSize: 16, fontWeight: "900", color: T.pink.dark, marginBottom: 4 }}>Your Complete Wellness Journey</Text>
          <Text style={{ fontSize: 13, color: T.text.muted, lineHeight: 20 }}>
            Track your mood, sleep, hydration and more. All insights are correlated with your cycle.
          </Text>
        </View>

        {/* Grid */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {FEATURES.map((f) => (
            <TouchableOpacity
              key={f.id}
              onPress={() => router.push(f.route as any)}
              style={{
                width: (width - 54) / 2,
                backgroundColor: f.bg,
                borderRadius: 24,
                padding: 20,
                borderWidth: 1,
                borderColor: f.accent + "30",
                shadowColor: f.accent,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 12,
                elevation: 3,
              }}
              activeOpacity={0.8}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: f.accent + "18", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Text style={{ fontSize: 24 }}>{f.emoji}</Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: "900", color: "#111827", marginBottom: 4 }}>{f.title}</Text>
              <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "500", lineHeight: 17 }}>{f.subtitle}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: f.accent }}>Open</Text>
                <Feather name="arrow-right" size={11} color={f.accent} style={{ marginLeft: 3 }} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
