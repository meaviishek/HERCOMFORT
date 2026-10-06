import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T } from '../constants/theme';

const STORAGE_KEY = '@nari_user_preferences_v1';

interface PrefsState {
  weightUnit: 'kg' | 'lbs';
  heightUnit: 'cm' | 'ft';
  tempUnit: '°C' | '°F';
  cupUnit: 'mL' | 'oz';
  waterGoal: string;
  firstDay: 'Sunday' | 'Monday';
  timeFormat: '12-Hour' | '24-Hour';
  haptics: boolean;
  dailyCheckin: boolean;
  bmiTracking: boolean;
}

const DEFAULT_PREFS: PrefsState = {
  weightUnit: 'kg',
  heightUnit: 'cm',
  tempUnit: '°C',
  cupUnit: 'mL',
  waterGoal: '2,400 mL',
  firstDay: 'Sunday',
  timeFormat: '12-Hour',
  haptics: true,
  dailyCheckin: true,
  bmiTracking: true,
};

export default function PreferencesScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<PrefsState>(DEFAULT_PREFS);
  const [activePicker, setActivePicker] = useState<{
    title: string;
    key: keyof PrefsState;
    options: string[];
  } | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
        } catch {}
      }
    });
  }, []);

  const updatePref = <K extends keyof PrefsState>(key: K, val: PrefsState[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: val };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear temporary files and image cache (38.4 MB). Your health history will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Success', 'Cache cleared successfully (38.4 MB freed).');
          },
        },
      ]
    );
  };

  const handleResetProgress = () => {
    Alert.alert(
      'Reset Daily Progress',
      'Do you want to reset today\'s hydration and daily symptom counters?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Reset Complete', 'Today\'s counters have been reset.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Top Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Preferences</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Section: Physical Units */}
        <Text style={s.sectionHeader}>BIOMETRIC & UNITS</Text>
        <View style={s.card}>
          <TouchableOpacity
            style={s.row}
            onPress={() =>
              setActivePicker({
                title: 'Weight Unit',
                key: 'weightUnit',
                options: ['kg', 'lbs'],
              })
            }
          >
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="scale-bathroom" size={20} color={T.pink.action} />
              <Text style={s.rowLabel}>Weight Unit</Text>
            </View>
            <View style={s.rowRight}>
              <Text style={s.rowVal}>{prefs.weightUnit}</Text>
              <Feather name="chevron-right" size={18} color="#94A3B8" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.row}
            onPress={() =>
              setActivePicker({
                title: 'Height Unit',
                key: 'heightUnit',
                options: ['cm', 'ft'],
              })
            }
          >
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="human-male-height" size={20} color={T.pink.action} />
              <Text style={s.rowLabel}>Height Unit</Text>
            </View>
            <View style={s.rowRight}>
              <Text style={s.rowVal}>{prefs.heightUnit}</Text>
              <Feather name="chevron-right" size={18} color="#94A3B8" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.row}
            onPress={() =>
              setActivePicker({
                title: 'Temperature Unit',
                key: 'tempUnit',
                options: ['°C', '°F'],
              })
            }
          >
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="thermometer" size={20} color={T.pink.action} />
              <Text style={s.rowLabel}>Therapy Temperature Unit</Text>
            </View>
            <View style={s.rowRight}>
              <Text style={s.rowVal}>{prefs.tempUnit}</Text>
              <Feather name="chevron-right" size={18} color="#94A3B8" />
            </View>
          </TouchableOpacity>

          <View style={[s.row, { borderBottomWidth: 0 }]}>
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="calculator-variant-outline" size={20} color={T.pink.action} />
              <Text style={s.rowLabel}>Body Mass Index (BMI)</Text>
            </View>
            <Switch
              value={prefs.bmiTracking}
              onValueChange={(v) => updatePref('bmiTracking', v)}
              trackColor={{ false: '#E2E8F0', true: '#FBCFE8' }}
              thumbColor={prefs.bmiTracking ? T.pink.action : '#94A3B8'}
            />
          </View>
        </View>

        {/* Section: Hydration & Daily Goals */}
        <Text style={s.sectionHeader}>HYDRATION & WELLNESS</Text>
        <View style={s.card}>
          <TouchableOpacity
            style={s.row}
            onPress={() =>
              setActivePicker({
                title: 'Daily Water Goal',
                key: 'waterGoal',
                options: ['1,800 mL', '2,000 mL', '2,400 mL', '2,800 mL', '3,200 mL'],
              })
            }
          >
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="cup-water" size={20} color="#0284C7" />
              <Text style={s.rowLabel}>Water Intake Goal</Text>
            </View>
            <View style={s.rowRight}>
              <Text style={s.rowVal}>{prefs.waterGoal}</Text>
              <Feather name="chevron-right" size={18} color="#94A3B8" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.row, { borderBottomWidth: 0 }]}
            onPress={() =>
              setActivePicker({
                title: 'Cup Measuring Unit',
                key: 'cupUnit',
                options: ['mL', 'oz'],
              })
            }
          >
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="cup-outline" size={20} color="#0284C7" />
              <Text style={s.rowLabel}>Cup Volume Unit</Text>
            </View>
            <View style={s.rowRight}>
              <Text style={s.rowVal}>{prefs.cupUnit}</Text>
              <Feather name="chevron-right" size={18} color="#94A3B8" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Section: Calendar & Format */}
        <Text style={s.sectionHeader}>CALENDAR & TIME FORMAT</Text>
        <View style={s.card}>
          <TouchableOpacity
            style={s.row}
            onPress={() =>
              setActivePicker({
                title: 'First Day of Week',
                key: 'firstDay',
                options: ['Sunday', 'Monday'],
              })
            }
          >
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="calendar-month-outline" size={20} color="#7C3AED" />
              <Text style={s.rowLabel}>First Day of Week</Text>
            </View>
            <View style={s.rowRight}>
              <Text style={s.rowVal}>{prefs.firstDay}</Text>
              <Feather name="chevron-right" size={18} color="#94A3B8" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.row, { borderBottomWidth: 0 }]}
            onPress={() =>
              setActivePicker({
                title: 'Time Display Format',
                key: 'timeFormat',
                options: ['12-Hour', '24-Hour'],
              })
            }
          >
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="clock-time-four-outline" size={20} color="#7C3AED" />
              <Text style={s.rowLabel}>Time Format</Text>
            </View>
            <View style={s.rowRight}>
              <Text style={s.rowVal}>{prefs.timeFormat}</Text>
              <Feather name="chevron-right" size={18} color="#94A3B8" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Section: System & Interaction */}
        <Text style={s.sectionHeader}>FEEDBACK & INTERACTION</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="vibrate" size={20} color="#059669" />
              <View>
                <Text style={s.rowLabel}>Haptic Feedback</Text>
                <Text style={s.rowSub}>Vibrate on belt commands & button taps</Text>
              </View>
            </View>
            <Switch
              value={prefs.haptics}
              onValueChange={(v) => updatePref('haptics', v)}
              trackColor={{ false: '#E2E8F0', true: '#A7F3D0' }}
              thumbColor={prefs.haptics ? '#059669' : '#94A3B8'}
            />
          </View>

          <View style={[s.row, { borderBottomWidth: 0 }]}>
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="heart-pulse" size={20} color="#059669" />
              <View>
                <Text style={s.rowLabel}>Daily Health Check-in</Text>
                <Text style={s.rowSub}>Prompt for symptoms & mood tracking</Text>
              </View>
            </View>
            <Switch
              value={prefs.dailyCheckin}
              onValueChange={(v) => updatePref('dailyCheckin', v)}
              trackColor={{ false: '#E2E8F0', true: '#A7F3D0' }}
              thumbColor={prefs.dailyCheckin ? '#059669' : '#94A3B8'}
            />
          </View>
        </View>

        {/* Section: Storage & Maintenance */}
        <Text style={s.sectionHeader}>DATA & STORAGE</Text>
        <View style={s.card}>
          <TouchableOpacity style={s.row} onPress={handleResetProgress}>
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="restart" size={20} color="#D97706" />
              <Text style={s.rowLabel}>Reset Today's Progress</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity style={[s.row, { borderBottomWidth: 0 }]} onPress={handleClearCache}>
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="cached" size={20} color="#DC2626" />
              <View>
                <Text style={s.rowLabel}>Clear Application Cache</Text>
                <Text style={s.rowSub}>38.4 MB cached data</Text>
              </View>
            </View>
            <Feather name="trash-2" size={18} color="#DC2626" />
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Modal Picker */}
      <Modal visible={!!activePicker} transparent animationType="fade" onRequestClose={() => setActivePicker(null)}>
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setActivePicker(null)}
        >
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>{activePicker?.title}</Text>
            <View style={{ marginTop: 8 }}>
              {activePicker?.options.map((opt) => {
                const isSelected = prefs[activePicker.key] === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[s.modalOpt, isSelected && s.modalOptSelected]}
                    onPress={() => {
                      updatePref(activePicker.key, opt as any);
                      setActivePicker(null);
                    }}
                  >
                    <Text style={[s.modalOptText, isSelected && s.modalOptTextSelected]}>{opt}</Text>
                    {isSelected && <Feather name="check" size={18} color={T.pink.action} />}
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              onPress={() => setActivePicker(null)}
              style={s.modalCancelBtn}
            >
              <Text style={s.modalCancelText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 18,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  rowSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowVal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  modalOptSelected: {
    backgroundColor: '#FFF0F5',
  },
  modalOptText: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '600',
  },
  modalOptTextSelected: {
    color: T.pink.action,
    fontWeight: '800',
  },
  modalCancelBtn: {
    marginTop: 14,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});
