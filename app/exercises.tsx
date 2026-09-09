import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { T } from "../constants/theme";

const CATEGORIES = [
  {
    id: "cramps", label: "For Cramps", emoji: "🌸", color: T.pink.primary, bg: T.pink.bg,
    exercises: [
      { name: "Child's Pose", duration: "3 min", desc: "Kneel on the floor, sit back on your heels, and extend your arms forward on the mat. Hold and breathe deeply for 3 minutes.", benefit: "Relieves lower abdominal cramps and lower back pain.", steps: ["Kneel and sit back on heels","Extend arms forward, forehead to mat","Hold for 3 minutes, breathing slowly"] },
      { name: "Cat-Cow Stretch", duration: "5 min", desc: "On hands and knees, alternate arching and rounding your back with each breath.", benefit: "Massages abdominal organs and relieves cramps.", steps: ["Start on hands and knees","Inhale, drop belly (Cow)","Exhale, round spine (Cat)","Repeat for 5 minutes"] },
      { name: "Knees-to-Chest", duration: "3 min", desc: "Lie on your back and pull both knees to your chest, hugging them gently.", benefit: "Releases tension in the lower back and hips.", steps: ["Lie flat on your back","Pull both knees to chest","Rock gently side to side","Hold 30s, release, repeat"] },
      { name: "Pelvic Tilts", duration: "5 min", desc: "Lying on your back with knees bent, gently tilt your pelvis upward and hold.", benefit: "Strengthens core and reduces period pain.", steps: ["Lie with knees bent","Flatten lower back to floor","Hold 5 seconds, release","Repeat 10-15 times"] },
    ],
  },
  {
    id: "back", label: "For Back Pain", emoji: "💆", color: "#8b5cf6", bg: "#f5f0ff",
    exercises: [
      { name: "Spinal Twist", duration: "4 min", desc: "Sit cross-legged and gently twist your torso to the left and right.", benefit: "Releases spinal tension and reduces back cramps.", steps: ["Sit tall cross-legged","Place right hand on left knee","Twist left, hold 30s","Switch sides"] },
      { name: "Cobra Stretch", duration: "3 min", desc: "Lie on your stomach and press up through your palms, lifting your chest.", benefit: "Opens the front body and relieves lower back tension.", steps: ["Lie face down, palms under shoulders","Inhale, press up, lift chest","Keep hips on floor","Hold 15-20s, release"] },
      { name: "Hip Stretch", duration: "5 min", desc: "In a low lunge position, sink your hips toward the floor to open the hip flexors.", benefit: "Releases hip tension that worsens period pain.", steps: ["Step right foot forward into lunge","Lower left knee to mat","Sink hips forward and down","Hold 45s each side"] },
    ],
  },
  {
    id: "relax", label: "For Relaxation", emoji: "🧘", color: "#059669", bg: "#f0fff8",
    exercises: [
      { name: "4-7-8 Breathing", duration: "5 min", desc: "Inhale 4s, hold 7s, exhale 8s. A powerful relaxation technique.", benefit: "Activates the parasympathetic nervous system, reducing pain and anxiety.", steps: ["Sit comfortably","Inhale through nose for 4s","Hold breath for 7s","Exhale through mouth for 8s","Repeat 4 cycles"] },
      { name: "Body Scan Meditation", duration: "10 min", desc: "Lie down and progressively relax each body part from toes to head.", benefit: "Reduces overall tension and improves pain tolerance.", steps: ["Lie comfortably on your back","Close eyes, breathe naturally","Focus on toes: release tension","Move up slowly through body"] },
      { name: "Progressive Relaxation", duration: "8 min", desc: "Tense and release each muscle group for full body relaxation.", benefit: "Reduces muscle cramps and physical tension.", steps: ["Lie down comfortably","Tense toes for 5s, release","Work up through calves, thighs","Continue to face muscles"] },
    ],
  },
];

export default function ExercisesScreen() {
  const router = useRouter();
  const [activeCat, setActiveCat] = useState("cramps");
  const [modal, setModal] = useState<any | null>(null);

  const cat = CATEGORIES.find(c => c.id === activeCat)!;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg.screen }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.border.default }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Feather name="arrow-left" size={24} color={T.text.primary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "900", color: T.text.primary }}>🧘 Relief Exercises</Text>
      </View>

      {/* Category tabs */}
      <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingVertical: 14, gap: 10 }}>
        {CATEGORIES.map(c => (
          <TouchableOpacity key={c.id} onPress={() => setActiveCat(c.id)}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 16, backgroundColor: activeCat === c.id ? c.color : T.bg.input, alignItems: "center" }}>
            <Text style={{ fontSize: 16, marginBottom: 2 }}>{c.emoji}</Text>
            <Text style={{ fontSize: 10, fontWeight: "700", color: activeCat === c.id ? "#fff" : T.text.muted, textAlign: "center" }}>{c.label.replace("For ", "")}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: T.text.primary, marginBottom: 4 }}>{cat.emoji} {cat.label}</Text>
        <Text style={{ fontSize: 13, color: T.text.muted, marginBottom: 20 }}>{cat.exercises.length} exercises</Text>

        {cat.exercises.map((ex, i) => (
          <TouchableOpacity key={ex.name} onPress={() => setModal(ex)} activeOpacity={0.9}
            style={{ backgroundColor: cat.bg, borderRadius: 24, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: cat.color + "25" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: "900", color: T.text.primary, marginBottom: 4 }}>{ex.name}</Text>
                <Text style={{ fontSize: 13, color: T.text.muted, lineHeight: 19 }}>{ex.benefit}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <View style={{ backgroundColor: cat.color + "20", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: cat.color }}>⏱ {ex.duration}</Text>
                </View>
                <Feather name="play-circle" size={28} color={cat.color} />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Exercise detail modal */}
      <Modal visible={!!modal} animationType="slide" transparent onRequestClose={() => setModal(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          {modal && (
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingBottom: 48, maxHeight: "85%" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: T.text.primary }}>{modal.name}</Text>
                  <Text style={{ fontSize: 13, color: T.text.muted }}>⏱ {modal.duration}</Text>
                </View>
                <TouchableOpacity onPress={() => setModal(null)}>
                  <Feather name="x" size={24} color={T.text.muted} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 14, color: T.text.secondary, lineHeight: 22, marginBottom: 20 }}>{modal.desc}</Text>
              <View style={{ backgroundColor: T.pink.bg, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: T.pink.border }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: T.pink.primary, marginBottom: 4 }}>✨ Benefit</Text>
                <Text style={{ fontSize: 13, color: T.text.secondary, lineHeight: 20 }}>{modal.benefit}</Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: "900", color: T.text.primary, marginBottom: 12 }}>Steps</Text>
              {modal.steps.map((s: string, i: number) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 10, gap: 10 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: T.pink.primary, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                    <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11 }}>{i+1}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, color: T.text.secondary, lineHeight: 22 }}>{s}</Text>
                </View>
              ))}
              <TouchableOpacity onPress={() => setModal(null)}
                style={{ backgroundColor: T.pink.primary, borderRadius: 20, paddingVertical: 16, alignItems: "center", marginTop: 8 }}>
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>Got it 🌸</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
