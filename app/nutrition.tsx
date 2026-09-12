import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { T } from "../constants/theme";

const PHASE_NUTRITION: Record<string, { title: string; icon: string; tip: string; color: string; bg: string; sections: { label: string; icon: string; foods: string[] }[] }> = {
  menstrual: {
    title: "Period Phase", icon: "flower-outline", tip: "Your body needs extra iron and anti-inflammatory foods right now.",
    color: T.pink.primary, bg: T.pink.bg,
    sections: [
      { label: "Iron-Rich Foods", icon: "restaurant-outline", foods: ["Spinach", "Lentils", "Dark chocolate", "Kidney beans", "Tofu"] },
      { label: "Magnesium Foods", icon: "fitness-outline", foods: ["Pumpkin seeds", "Almonds", "Cashews", "Dark leafy greens", "Banana"] },
      { label: "Hydrating Foods", icon: "water-outline", foods: ["Watermelon", "Cucumber", "Herbal teas", "Coconut water", "Oranges"] },
      { label: "Anti-Cramp Foods", icon: "shield-checkmark-outline", foods: ["Bananas (potassium)", "Ginger tea", "Turmeric milk", "Chamomile tea"] },
    ],
  },
  follicular: {
    title: "Follicular Phase", icon: "leaf-outline", tip: "Energy is rising — fuel it with fresh, light foods.",
    color: "#22c55e", bg: "#f0fff8",
    sections: [
      { label: "Fresh Vegetables", icon: "leaf-outline", foods: ["Broccoli", "Zucchini", "Peas", "Artichokes", "Fermented foods"] },
      { label: "Lean Proteins", icon: "restaurant-outline", foods: ["Eggs", "Chicken", "Salmon", "Legumes", "Greek yogurt"] },
      { label: "Complex Carbs", icon: "nutrition-outline", foods: ["Quinoa", "Oats", "Brown rice", "Sweet potato"] },
    ],
  },
  ovulation: {
    title: "Ovulation Phase", icon: "sparkles-outline", tip: "Peak energy! Focus on antioxidant-rich and hormone-supporting foods.",
    color: "#f97316", bg: "#fff8f0",
    sections: [
      { label: "Antioxidant Foods", icon: "sparkles-outline", foods: ["Blueberries", "Strawberries", "Beets", "Bell peppers", "Tomatoes"] },
      { label: "Zinc-Rich Foods", icon: "nutrition-outline", foods: ["Pumpkin seeds", "Chickpeas", "Cashews", "Beef", "Oysters"] },
      { label: "Fiber-Rich Foods", icon: "refresh-outline", foods: ["Flaxseeds", "Chia seeds", "Brussels sprouts", "Lentils"] },
    ],
  },
  luteal: {
    title: "Luteal Phase", icon: "moon-outline", tip: "Slow down and nourish. Reduce sugar cravings with these foods.",
    color: "#8b5cf6", bg: "#f5f0ff",
    sections: [
      { label: "B6-Rich Foods", icon: "fish-outline", foods: ["Salmon", "Chicken", "Potato", "Banana", "Sunflower seeds"] },
      { label: "Calcium Foods", icon: "cafe-outline", foods: ["Yogurt", "Cheese", "Tofu", "Kale", "Almonds"] },
      { label: "Mood Boosters", icon: "heart-outline", foods: ["Dark chocolate (70%+)", "Oily fish", "Walnuts", "Pumpkin seeds"] },
      { label: "Foods to Reduce", icon: "warning-outline", foods: ["Refined sugar", "Salty snacks", "Alcohol", "Caffeine"] },
    ],
  },
};

const WELLNESS_TIPS = [
  "Eating small, frequent meals during your period helps stabilize blood sugar and reduce mood swings.",
  "Ginger tea can naturally reduce period pain — it's as effective as ibuprofen in some studies!",
  "Dark leafy greens replenish the iron you lose during menstruation.",
  "Avoiding dairy during your period can reduce bloating for some women.",
  "Salmon is rich in omega-3 fatty acids, which are potent anti-inflammatory compounds.",
];

export default function NutritionScreen() {
  const router = useRouter();
  // Detect phase from date (simple heuristic) — ideally from cycle context
  const day = new Date().getDate() % 28;
  const currentPhase = day < 6 ? "menstrual" : day < 14 ? "follicular" : day < 17 ? "ovulation" : "luteal";
  const data = PHASE_NUTRITION[currentPhase];
  const randomTip = WELLNESS_TIPS[new Date().getDate() % WELLNESS_TIPS.length];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg.screen }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.border.default }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Feather name="arrow-left" size={24} color={T.text.primary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "900", color: T.text.primary }}>Nutrition Guide</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

        {/* Phase header */}
        <View style={{ backgroundColor: data.bg, borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: data.color + "30" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: data.color + "30" }}>
              <Ionicons name={data.icon as any} size={24} color={data.color} />
            </View>
            <View>
              <Text style={{ fontSize: 11, fontWeight: "700", color: data.color, textTransform: "uppercase", letterSpacing: 0.8 }}>Current Phase</Text>
              <Text style={{ fontSize: 20, fontWeight: "900", color: T.text.primary, marginTop: 2 }}>{data.title}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 14, color: T.text.muted, lineHeight: 21 }}>{data.tip}</Text>
        </View>

        {/* Today's wellness tip */}
        <View style={{ backgroundColor: T.pink.bg, borderRadius: 20, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: T.pink.border, flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="bulb-outline" size={18} color={T.pink.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "800", color: T.pink.primary, marginBottom: 2 }}>Today's Wellness Tip</Text>
            <Text style={{ fontSize: 13, color: T.text.secondary, lineHeight: 20 }}>{randomTip}</Text>
          </View>
        </View>

        {/* Food sections */}
        {data.sections.map(section => (
          <View key={section.label} style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Ionicons name={section.icon as any} size={18} color={data.color} />
              <Text style={{ fontSize: 16, fontWeight: "900", color: T.text.primary }}>{section.label}</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {section.foods.map(food => (
                <View key={food} style={{ backgroundColor: data.bg, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: data.color + "30" }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: data.color }}>{food}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Phase selector */}
        <Text style={{ fontSize: 16, fontWeight: "900", color: T.text.primary, marginBottom: 14, marginTop: 8 }}>Other Phases</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {Object.entries(PHASE_NUTRITION).map(([key, val]) => (
            <View key={key} style={{ backgroundColor: val.bg, borderRadius: 20, padding: 16, width: "48%", borderWidth: 1, borderColor: val.color + "30" }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                <Ionicons name={val.icon as any} size={18} color={val.color} />
              </View>
              <Text style={{ fontSize: 14, fontWeight: "800", color: val.color }}>{val.title}</Text>
              <Text style={{ fontSize: 11, color: T.text.muted, marginTop: 2 }}>{val.sections.length} food groups</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
