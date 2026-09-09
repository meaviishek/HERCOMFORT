import React, { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { T } from "../constants/theme";
import wellnessService, { HydrationEntry } from "../services/wellnessService";

const GOAL_ML = 2500;

export default function HydrationTracker() {
  const router    = useRouter();
  const [amount,  setAmount]  = useState(0);
  const [goal,    setGoal]    = useState(GOAL_ML);
  const [loading, setLoading] = useState(true);
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { load(); }, []);

  useEffect(() => {
    Animated.timing(waveAnim, { toValue: amount / goal, duration: 600, useNativeDriver: false }).start();
  }, [amount, goal]);

  async function load() {
    try {
      const today = await wellnessService.getTodayHydration();
      setAmount(today.amount);
      setGoal(today.goal || GOAL_ML);
    } catch (e) { console.warn("hydration load", e); }
    finally { setLoading(false); }
  }

  async function add(ml: number) {
    try {
      const result = await wellnessService.addHydration(ml, goal) as HydrationEntry;
      setAmount(result.amount);
      if (result.amount >= goal && amount < goal) {
        Alert.alert("🎉 Goal Reached!", "You've hit your daily water goal! Great job!");
      }
    } catch (e: any) { Alert.alert("Error", e?.response?.data?.message || "Could not update."); }
  }

  async function reset() {
    Alert.alert("Reset?", "Clear today's hydration?", [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", style: "destructive", onPress: async () => {
        try { await wellnessService.setHydration(0, goal); setAmount(0); }
        catch { Alert.alert("Error", "Could not reset."); }
      }},
    ]);
  }

  const pct = Math.min(amount / goal, 1);
  const liters = (amount / 1000).toFixed(2);
  const goalLiters = (goal / 1000).toFixed(1);
  const remaining = Math.max(goal - amount, 0);
  const fillHeight = waveAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const cupColor   = pct >= 1 ? "#22c55e" : pct >= 0.5 ? "#0ea5e9" : "#93c5fd";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg.screen }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.border.default }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Feather name="arrow-left" size={24} color={T.text.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "900", color: T.text.primary }}>💧 Hydration Tracker</Text>
        </View>
        <TouchableOpacity onPress={reset}>
          <Feather name="refresh-ccw" size={18} color={T.text.muted} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Water bottle visual */}
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <View style={{ width: 140, height: 220, borderRadius: 28, backgroundColor: "#e0f7ff", overflow: "hidden", borderWidth: 3, borderColor: "#7dd3fc", position: "relative", alignItems: "center", justifyContent: "flex-end" }}>
            <Animated.View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: fillHeight, backgroundColor: cupColor + "cc", borderRadius: 4 }} />
            <View style={{ position: "absolute", alignItems: "center" }}>
              <Text style={{ fontSize: 32, fontWeight: "900", color: pct >= 0.5 ? "#fff" : "#0369a1" }}>{liters}L</Text>
              <Text style={{ fontSize: 13, color: pct >= 0.5 ? "rgba(255,255,255,0.85)" : "#0369a1", fontWeight: "600" }}>of {goalLiters}L</Text>
            </View>
          </View>
          <View style={{ marginTop: 20, alignItems: "center" }}>
            {pct >= 1
              ? <Text style={{ fontSize: 16, fontWeight: "900", color: "#22c55e" }}>🎉 Daily goal achieved!</Text>
              : <Text style={{ fontSize: 14, color: T.text.muted, fontWeight: "600" }}>{(remaining/1000).toFixed(2)}L remaining to goal</Text>
            }
          </View>
        </View>

        {/* Progress bar */}
        <View style={{ backgroundColor: T.bg.input, borderRadius: 12, height: 12, marginBottom: 8, overflow: "hidden" }}>
          <Animated.View style={{ height: "100%", width: `${Math.min(pct * 100, 100)}%`, backgroundColor: cupColor, borderRadius: 12 }} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 28 }}>
          <Text style={{ fontSize: 11, color: T.text.muted, fontWeight: "600" }}>0L</Text>
          <Text style={{ fontSize: 11, color: "#0ea5e9", fontWeight: "700" }}>{Math.round(pct * 100)}%</Text>
          <Text style={{ fontSize: 11, color: T.text.muted, fontWeight: "600" }}>{goalLiters}L</Text>
        </View>

        {/* Quick add */}
        <Text style={{ fontSize: 15, fontWeight: "900", color: T.text.primary, marginBottom: 14 }}>Quick Add</Text>
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          {[{ ml: 250, label: "+250 ml", icon: "☕" }, { ml: 500, label: "+500 ml", icon: "🥤" }].map(btn => (
            <TouchableOpacity key={btn.ml} onPress={() => add(btn.ml)}
              style={{ flex: 1, backgroundColor: "#e0f7ff", borderRadius: 20, paddingVertical: 18, alignItems: "center", borderWidth: 2, borderColor: "#7dd3fc" }}>
              <Text style={{ fontSize: 28, marginBottom: 4 }}>{btn.icon}</Text>
              <Text style={{ fontSize: 14, fontWeight: "900", color: "#0369a1" }}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 28 }}>
          {[{ ml: 750, label: "+750 ml", icon: "🍶" }, { ml: 1000, label: "+1 L", icon: "💧" }].map(btn => (
            <TouchableOpacity key={btn.ml} onPress={() => add(btn.ml)}
              style={{ flex: 1, backgroundColor: "#f0feff", borderRadius: 20, paddingVertical: 18, alignItems: "center", borderWidth: 2, borderColor: "#a5f3fc" }}>
              <Text style={{ fontSize: 28, marginBottom: 4 }}>{btn.icon}</Text>
              <Text style={{ fontSize: 14, fontWeight: "900", color: "#0e7490" }}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tip */}
        <View style={{ backgroundColor: "#f0feff", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#a5f3fc", flexDirection: "row", gap: 10 }}>
          <Text style={{ fontSize: 20 }}>💡</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "800", color: "#0e7490", marginBottom: 4 }}>Hydration Tip</Text>
            <Text style={{ fontSize: 13, color: T.text.muted, lineHeight: 20 }}>
              During your period, staying hydrated reduces bloating and cramps. Aim for 2.5L daily! 🌸
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
