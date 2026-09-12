import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { T } from "../constants/theme";

interface HealthTool {
  id: string;
  icon: string;
  title: string;
  description: string;
  tag: string;
  route: string;
}

const SECTIONS: { title: string; subtitle: string; tools: HealthTool[] }[] = [
  {
    title: "Biomarker & Cycle Vitals",
    subtitle: "Real-time logging to calibrate pain & cramp predictions",
    tools: [
      {
        id: "symptoms",
        icon: "pulse-outline",
        title: "Symptoms Tracker",
        description: "Log acute cramps, pelvic discomfort & flow biomarkers",
        tag: "15 Biomarkers",
        route: "/symptoms-tracker",
      },
      {
        id: "mood",
        icon: "happy-outline",
        title: "Mood & Hormonal State",
        description: "Track emotional variations correlated to estrogen & progesterone",
        tag: "Phase Log",
        route: "/mood-tracker",
      },
    ],
  },
  {
    title: "Recovery & Hydration",
    subtitle: "Maintain physiological balance to mitigate spasm severity",
    tools: [
      {
        id: "hydration",
        icon: "water-outline",
        title: "Hydration Monitor",
        description: "Maintain 2.5L daily target to reduce blood viscosity & cramping",
        tag: "Goal: 2.5L",
        route: "/hydration-tracker",
      },
      {
        id: "sleep",
        icon: "moon-outline",
        title: "Sleep Quality",
        description: "Circadian tracking & restorative rest during luteal phase",
        tag: "Rest Index",
        route: "/sleep-tracker",
      },
    ],
  },
  {
    title: "Targeted Therapy & Spasm Relief",
    subtitle: "Clinical relaxation protocols & pelvic de-stressing",
    tools: [
      {
        id: "exercises",
        icon: "fitness-outline",
        title: "Relief Exercises",
        description: "Targeted physical stretches for pelvic & lower back spasms",
        tag: "Guided Stretches",
        route: "/exercises",
      },
      {
        id: "breathing",
        icon: "leaf-outline",
        title: "Breathing & Relaxation",
        description: "4-4-6 parasympathetic vagus nerve calming session",
        tag: "Vagus Calming",
        route: "/breathing",
      },
    ],
  },
  {
    title: "Nourishment & Care",
    subtitle: "Cycle-specific nutrients & scheduled therapy care",
    tools: [
      {
        id: "nutrition",
        icon: "restaurant-outline",
        title: "Cycle Nutrition",
        description: "Anti-inflammatory, magnesium & iron-rich dietary guide",
        tag: "Phase Diet",
        route: "/nutrition",
      },
      {
        id: "medication",
        icon: "medkit-outline",
        title: "Medications Schedule",
        description: "Prescribed pain relief, supplements & timing reminders",
        tag: "Schedule",
        route: "/medication-reminder",
      },
    ],
  },
];

export default function WellnessHub() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg.screen }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: T.border.default, backgroundColor: "#fff" }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 14, padding: 4 }}>
          <Feather name="arrow-left" size={24} color={T.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: "900", color: T.text.primary }}>Wellness Hub</Text>
          <Text style={{ fontSize: 13, color: T.text.muted, fontWeight: "500", marginTop: 2 }}>Clinical tracking & personalized cycle tools</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        {/* Intro Summary Banner */}
        <View style={{ backgroundColor: "#ffffff", borderRadius: 24, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: "#fce7f3", shadowColor: T.pink.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fdf2f8", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: "#fce7f3" }}>
              <Ionicons name="sparkles" size={13} color={T.pink.primary} />
              <Text style={{ fontSize: 11, fontWeight: "800", color: T.pink.primary, letterSpacing: 0.4 }}>DAILY WELLNESS</Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#10b981" }}>4 / 4 Core Tracked</Text>
          </View>
          <Text style={{ fontSize: 18, fontWeight: "900", color: T.text.primary, marginTop: 4 }}>Comprehensive Cycle Care</Text>
          <Text style={{ fontSize: 13, color: T.text.muted, lineHeight: 19, marginTop: 4 }}>
            Logging daily symptoms and recovery habits increases cycle prediction accuracy and personalizes therapy stimulation.
          </Text>
          <View style={{ height: 6, backgroundColor: "#f3f4f6", borderRadius: 3, marginTop: 14, overflow: "hidden" }}>
            <View style={{ height: "100%", width: "85%", backgroundColor: T.pink.primary, borderRadius: 3 }} />
          </View>
        </View>

        {/* Section Groups */}
        {SECTIONS.map((sec, secIdx) => (
          <View key={sec.title} style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: "900", color: T.text.primary, marginBottom: 2 }}>{sec.title}</Text>
            <Text style={{ fontSize: 12, color: T.text.muted, marginBottom: 12 }}>{sec.subtitle}</Text>

            <View style={{ gap: 12 }}>
              {sec.tools.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => router.push(t.route as any)}
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: 20,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: "#fce7f3",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    shadowColor: T.pink.primary,
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                  activeOpacity={0.82}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: "#fdf2f8",
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: "#fce7f3",
                    }}
                  >
                    <Ionicons name={t.icon as any} size={22} color={T.pink.primary} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <Text style={{ fontSize: 15, fontWeight: "800", color: T.text.primary }}>{t.title}</Text>
                      <View style={{ backgroundColor: "#fdf2f8", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: T.pink.primary }}>{t.tag}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: T.text.secondary, lineHeight: 17 }} numberOfLines={2}>{t.description}</Text>
                  </View>

                  <Feather name="chevron-right" size={18} color="#9ca3af" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
