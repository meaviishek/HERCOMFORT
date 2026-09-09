import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated, Easing, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { T } from "../constants/theme";

const { width } = Dimensions.get("window");
const CIRCLE = width * 0.6;

const PHASES = [
  { label: "Breathe In",  duration: 4000, color: "#22c55e",  instruction: "Slowly inhale through your nose",  scale: 1.2 },
  { label: "Hold",        duration: 4000, color: "#f59e0b",  instruction: "Hold gently...",                   scale: 1.2 },
  { label: "Breathe Out", duration: 6000, color: "#6366f1",  instruction: "Slowly exhale through your mouth", scale: 0.85 },
];

const PATTERNS = [
  { name: "4-4-6 Calm",      phases: [4, 4, 6] },
  { name: "4-7-8 Relaxing",  phases: [4, 7, 8] },
  { name: "Box (4-4-4-4)",   phases: [4, 4, 4, 4] },
];

export default function BreathingScreen() {
  const router = useRouter();
  const [active,      setActive]      = useState(false);
  const [phaseIdx,    setPhaseIdx]    = useState(0);
  const [counter,     setCounter]     = useState(PHASES[0].duration / 1000);
  const [cycles,      setCycles]      = useState(0);
  const [patternIdx,  setPatternIdx]  = useState(0);

  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const opacAnim    = useRef(new Animated.Value(0.5)).current;
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef    = useRef(0);
  const activeRef   = useRef(false);

  function stopAll() {
    activeRef.current = false;
    setActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    scaleAnim.stopAnimation();
    opacAnim.stopAnimation();
    setPhaseIdx(0);
    setCounter(PHASES[0].duration / 1000);
    scaleAnim.setValue(1);
    opacAnim.setValue(0.5);
  }

  function runPhase(idx: number) {
    if (!activeRef.current) return;
    phaseRef.current = idx;
    const phase = PHASES[idx];
    setPhaseIdx(idx);
    setCounter(phase.duration / 1000);

    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: phase.scale, duration: phase.duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(opacAnim, { toValue: idx === 0 ? 1 : idx === 1 ? 0.9 : 0.4, duration: phase.duration, useNativeDriver: true }),
    ]).start();

    let secs = phase.duration / 1000;
    timerRef.current = setInterval(() => {
      secs -= 1;
      setCounter(secs);
      if (secs <= 0) {
        clearInterval(timerRef.current!);
        const next = (idx + 1) % PHASES.length;
        if (next === 0) setCycles(c => c + 1);
        if (activeRef.current) runPhase(next);
      }
    }, 1000);
  }

  function start() {
    activeRef.current = true;
    setActive(true);
    setCycles(0);
    runPhase(0);
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const phase = PHASES[phaseIdx];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 }}>
        <TouchableOpacity onPress={() => { stopAll(); router.back(); }} style={{ marginRight: 12 }}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "900", color: "#fff" }}>🎧 Breathing & Relaxation</Text>
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }}>

        {/* Pattern selector */}
        {!active && (
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 40 }}>
            {PATTERNS.map((p, i) => (
              <TouchableOpacity key={p.name} onPress={() => setPatternIdx(i)}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: patternIdx === i ? "#fff" : "#1e293b", borderWidth: 1, borderColor: patternIdx === i ? "#fff" : "#334155" }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: patternIdx === i ? "#0f172a" : "#94a3b8" }}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Animated circles */}
        <View style={{ width: CIRCLE, height: CIRCLE, alignItems: "center", justifyContent: "center", marginBottom: 40 }}>
          <Animated.View style={{ position: "absolute", width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE/2, backgroundColor: (active ? phase.color : "#e84ea1") + "15", transform: [{ scale: scaleAnim }] }} />
          <Animated.View style={{ position: "absolute", width: CIRCLE * 0.82, height: CIRCLE * 0.82, borderRadius: CIRCLE/2, backgroundColor: (active ? phase.color : "#e84ea1") + "28", transform: [{ scale: scaleAnim }] }} />
          <Animated.View style={{ width: CIRCLE * 0.65, height: CIRCLE * 0.65, borderRadius: CIRCLE/2, backgroundColor: active ? phase.color : T.pink.primary, alignItems: "center", justifyContent: "center", opacity: opacAnim }}>
            <Text style={{ fontSize: 42, fontWeight: "900", color: "#fff" }}>{active ? counter : "🌬️"}</Text>
            <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", fontWeight: "700", marginTop: 4, textAlign: "center" }}>{active ? phase.label : "Ready"}</Text>
          </Animated.View>
        </View>

        {/* Instruction */}
        <Text style={{ fontSize: 15, color: "#94a3b8", textAlign: "center", marginBottom: 8, fontWeight: "500", minHeight: 24 }}>
          {active ? phase.instruction : "Choose a pattern and press Start"}
        </Text>
        {active && <Text style={{ fontSize: 13, color: "#64748b", marginBottom: 32, fontWeight: "600" }}>Cycles completed: {cycles}</Text>}

        {/* Button */}
        <TouchableOpacity onPress={active ? stopAll : start}
          style={{ backgroundColor: active ? "#ef4444" : T.pink.primary, borderRadius: 24, paddingVertical: 18, paddingHorizontal: 56 }}
          activeOpacity={0.8}>
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 17 }}>{active ? "Stop" : "Start"}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
