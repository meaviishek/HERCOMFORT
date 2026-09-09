import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { T } from "../constants/theme";
import wellnessService, { Medication } from "../services/wellnessService";

const FREQ_OPTIONS  = ["Once daily","Twice daily","Three times","As needed","Weekly"];
const TIME_OPTIONS  = ["6 AM","8 AM","10 AM","12 PM","2 PM","4 PM","6 PM","8 PM","10 PM"];
const UNIT_OPTIONS  = ["mg", "ml", "tablet(s)", "drop(s)"];

export default function MedicationReminder() {
  const router = useRouter();
  const [meds,   setMeds]   = useState<Medication[]>([]);
  const [modal,  setModal]  = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading,setLoading]= useState(true);
  const [name,   setName]   = useState("");
  const [dose,   setDose]   = useState("");
  const [unit,   setUnit]   = useState("mg");
  const [time,   setTime]   = useState("8 AM");
  const [freq,   setFreq]   = useState("Once daily");
  const [notes,  setNotes]  = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try { setMeds(await wellnessService.getMedications()); }
    catch (e) { console.warn("meds load", e); }
    finally { setLoading(false); }
  }

  async function save() {
    if (!name.trim()) { Alert.alert("Enter medication name"); return; }
    setSaving(true);
    try {
      const med = await wellnessService.addMedication({ name: name.trim(), dose, unit, time, frequency: freq, notes, active: true });
      setMeds(prev => [med, ...prev]);
      resetForm(); setModal(false);
      Alert.alert("Added! 💊", `${med.name} added to your medications.`);
    } catch (e: any) { Alert.alert("Error", e?.response?.data?.message || "Could not save."); }
    finally { setSaving(false); }
  }

  async function toggleActive(id: string, current: boolean) {
    try {
      const updated = await wellnessService.updateMedication(id, { active: !current });
      setMeds(prev => prev.map(m => m._id === id ? updated : m));
    } catch { Alert.alert("Error", "Could not update."); }
  }

  async function deleteMed(id: string, name: string) {
    Alert.alert("Delete?", `Remove ${name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await wellnessService.deleteMedication(id); setMeds(prev => prev.filter(m => m._id !== id)); }
        catch { Alert.alert("Error", "Could not delete."); }
      }},
    ]);
  }

  function resetForm() { setName(""); setDose(""); setUnit("mg"); setTime("8 AM"); setFreq("Once daily"); setNotes(""); }

  const activeMeds   = meds.filter(m => m.active);
  const inactiveMeds = meds.filter(m => !m.active);

  if (loading) return <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.bg.screen }}><ActivityIndicator size="large" color="#10b981" /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg.screen }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.border.default }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Feather name="arrow-left" size={24} color={T.text.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "900", color: T.text.primary }}>💊 Medications</Text>
        </View>
        <TouchableOpacity onPress={() => { resetForm(); setModal(true); }}
          style={{ backgroundColor: "#10b981", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Feather name="plus" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Disclaimer */}
        <View style={{ backgroundColor: "#fffbeb", borderRadius: 16, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: "#fde68a", flexDirection: "row", gap: 8 }}>
          <Text style={{ fontSize: 16 }}>⚠️</Text>
          <Text style={{ flex: 1, fontSize: 12, color: "#92400e", lineHeight: 18 }}>
            This reminder is for your reference only. Always follow your doctor's prescription. Never self-prescribe medications.
          </Text>
        </View>

        <Text style={{ fontSize: 18, fontWeight: "900", color: T.text.primary, marginBottom: 14 }}>Active ({activeMeds.length})</Text>

        {activeMeds.length === 0 && (
          <View style={{ backgroundColor: T.pink.bg, borderRadius: 20, padding: 28, alignItems: "center", marginBottom: 20, borderWidth: 1, borderColor: T.pink.border }}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>💊</Text>
            <Text style={{ fontSize: 16, fontWeight: "900", color: T.text.primary, marginBottom: 4 }}>No Medications Added</Text>
            <Text style={{ fontSize: 13, color: T.text.muted, textAlign: "center" }}>Add your prescribed medications to keep track</Text>
          </View>
        )}

        {activeMeds.map(m => (
          <View key={m._id} style={{ backgroundColor: "#fff", borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#d1fae5", shadowColor: "#10b981", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#d1fae5", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 20 }}>💊</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: "900", color: T.text.primary }}>{m.name}</Text>
                    <Text style={{ fontSize: 12, color: T.text.muted }}>{m.dose} {m.unit} · {m.frequency}</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: "#f0fff9", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="time-outline" size={12} color="#059669" />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#059669" }}>{m.time}</Text>
                </View>
                {m.notes ? <Text style={{ fontSize: 12, color: T.text.muted, marginTop: 8 }}>📝 {m.notes}</Text> : null}
              </View>
              <View style={{ flexDirection: "column", gap: 8, marginLeft: 8 }}>
                <TouchableOpacity onPress={() => toggleActive(m._id, m.active)} style={{ padding: 6 }}>
                  <Ionicons name="pause-circle" size={22} color="#f59e0b" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteMed(m._id, m.name)} style={{ padding: 6 }}>
                  <Feather name="trash-2" size={18} color="#f87171" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        {inactiveMeds.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: "900", color: T.text.muted, marginBottom: 12 }}>Paused ({inactiveMeds.length})</Text>
            {inactiveMeds.map(m => (
              <View key={m._id} style={{ backgroundColor: T.bg.input, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12, opacity: 0.7 }}>
                <Text style={{ fontSize: 24 }}>💊</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "800", color: T.text.secondary }}>{m.name}</Text>
                  <Text style={{ fontSize: 12, color: T.text.muted }}>{m.dose} {m.unit} · {m.time}</Text>
                </View>
                <TouchableOpacity onPress={() => toggleActive(m._id, m.active)}>
                  <Ionicons name="play-circle" size={24} color="#10b981" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteMed(m._id, m.name)}>
                  <Feather name="trash-2" size={18} color="#f87171" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add modal */}
      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 48, maxHeight: "90%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: "900", color: T.text.primary }}>Add Medication</Text>
              <TouchableOpacity onPress={() => setModal(false)}><Feather name="x" size={24} color={T.text.muted} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: T.text.secondary, marginBottom: 6 }}>Medicine Name *</Text>
              <TextInput value={name} onChangeText={setName} placeholder="e.g., Ibuprofen, Folic Acid" placeholderTextColor={T.text.muted}
                style={{ backgroundColor: T.bg.input, borderRadius: 14, padding: 14, fontSize: 14, color: T.text.primary, marginBottom: 16 }} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: T.text.secondary, marginBottom: 6 }}>Dose</Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
                <TextInput value={dose} onChangeText={setDose} placeholder="400" placeholderTextColor={T.text.muted} keyboardType="numeric"
                  style={{ width: 80, backgroundColor: T.bg.input, borderRadius: 14, padding: 14, fontSize: 14, color: T.text.primary }} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {UNIT_OPTIONS.map(u => (
                    <TouchableOpacity key={u} onPress={() => setUnit(u)}
                      style={{ paddingHorizontal: 14, paddingVertical: 14, borderRadius: 14, backgroundColor: unit === u ? "#10b981" : T.bg.input }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: unit === u ? "#fff" : T.text.muted }}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <Text style={{ fontSize: 13, fontWeight: "700", color: T.text.secondary, marginBottom: 6 }}>Time</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                {TIME_OPTIONS.map(t => (
                  <TouchableOpacity key={t} onPress={() => setTime(t)}
                    style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: time === t ? "#10b981" : T.bg.input }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: time === t ? "#fff" : T.text.muted }}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={{ fontSize: 13, fontWeight: "700", color: T.text.secondary, marginBottom: 6 }}>Frequency</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {FREQ_OPTIONS.map(f => (
                  <TouchableOpacity key={f} onPress={() => setFreq(f)}
                    style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: freq === f ? "#10b981" : T.bg.input }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: freq === f ? "#fff" : T.text.muted }}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={{ fontSize: 13, fontWeight: "700", color: T.text.secondary, marginBottom: 6 }}>Notes (optional)</Text>
              <TextInput value={notes} onChangeText={setNotes} placeholder="e.g., Take with food" placeholderTextColor={T.text.muted} multiline numberOfLines={2}
                style={{ backgroundColor: T.bg.input, borderRadius: 14, padding: 14, fontSize: 14, color: T.text.primary, textAlignVertical: "top", marginBottom: 20 }} />
              <TouchableOpacity onPress={save} disabled={saving}
                style={{ backgroundColor: "#10b981", borderRadius: 20, paddingVertical: 16, alignItems: "center" }}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>Save Medication</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
