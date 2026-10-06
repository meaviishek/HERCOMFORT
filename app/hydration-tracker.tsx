import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
  Modal,
  TextInput,
  Switch,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T } from '../constants/theme';
import wellnessService, { HydrationEntry } from '../services/wellnessService';
import notificationService from '../services/notificationService';

const GOAL_ML = 2500;
const HYDRATION_LOGS_KEY = '@nari_hydration_logs_today';
const HYDRATION_PREFS_KEY = '@nari_hydration_reminder_prefs';

interface DrinkLog {
  id: string;
  ml: number;
  time: string;
  timestamp: number;
}

export default function HydrationTracker() {
  const router = useRouter();
  const [amount, setAmount] = useState(0);
  const [goal, setGoal] = useState(GOAL_ML);
  const [logs, setLogs] = useState<DrinkLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Reminder settings
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [intervalHours, setIntervalHours] = useState(2); // 2 hours

  // Modals
  const [customModal, setCustomModal] = useState(false);
  const [customMl, setCustomMl] = useState('');
  const [goalModal, setGoalModal] = useState(false);
  const [editGoalInput, setEditGoalInput] = useState('2500');

  const waveAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    try {
      const today = await wellnessService.getTodayHydration();
      setAmount(today.amount);
      if (today.goal) setGoal(today.goal);

      // Load local logs for today
      const rawLogs = await AsyncStorage.getItem(HYDRATION_LOGS_KEY);
      if (rawLogs) {
        const parsed: DrinkLog[] = JSON.parse(rawLogs);
        const startOfDay = new Date().setHours(0, 0, 0, 0);
        setLogs(parsed.filter((l) => l.timestamp >= startOfDay));
      }

      // Load reminder prefs
      const rawPrefs = await AsyncStorage.getItem(HYDRATION_PREFS_KEY);
      if (rawPrefs) {
        const p = JSON.parse(rawPrefs);
        setReminderEnabled(p.enabled ?? true);
        setIntervalHours(p.intervalHours ?? 2);
      }
    } catch (e) {
      console.warn('hydration load', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    Animated.timing(waveAnim, {
      toValue: Math.min(amount / goal, 1),
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [amount, goal, waveAnim]);

  const saveLogs = async (updatedLogs: DrinkLog[]) => {
    setLogs(updatedLogs);
    await AsyncStorage.setItem(HYDRATION_LOGS_KEY, JSON.stringify(updatedLogs));
  };

  const add = async (ml: number) => {
    if (ml <= 0) return;
    try {
      const result = (await wellnessService.addHydration(ml, goal)) as HydrationEntry;
      setAmount(result.amount);

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const newLog: DrinkLog = {
        id: `drink_${Date.now()}`,
        ml,
        time: timeStr,
        timestamp: Date.now(),
      };
      await saveLogs([newLog, ...logs]);

      if (result.amount >= goal && amount < goal) {
        Alert.alert('🎉 Goal Reached!', "You've hit your daily water goal! Great job staying hydrated!");
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not update hydration.');
    }
  };

  const deleteLog = async (logId: string, ml: number) => {
    Alert.alert('Delete Drink Entry', `Remove this ${ml} mL entry?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const newAmount = Math.max(0, amount - ml);
          try {
            await wellnessService.setHydration(newAmount, goal);
            setAmount(newAmount);
            await saveLogs(logs.filter((l) => l.id !== logId));
          } catch {
            Alert.alert('Error', 'Could not delete entry.');
          }
        },
      },
    ]);
  };

  const handleCustomAdd = async () => {
    const val = parseInt(customMl.trim(), 10);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid Volume', 'Please enter a valid amount in mL.');
      return;
    }
    await add(val);
    setCustomMl('');
    setCustomModal(false);
  };

  const handleSaveGoal = async () => {
    const val = parseInt(editGoalInput.trim(), 10);
    if (isNaN(val) || val < 500 || val > 6000) {
      Alert.alert('Invalid Goal', 'Please enter a daily goal between 500 and 6,000 mL.');
      return;
    }
    try {
      await wellnessService.setHydration(amount, val);
      setGoal(val);
      setGoalModal(false);
      Alert.alert('Target Updated', `Your daily hydration target is now ${val} mL.`);
    } catch {
      Alert.alert('Error', 'Could not update goal.');
    }
  };

  const handleToggleReminder = async (enabled: boolean) => {
    setReminderEnabled(enabled);
    const prefs = { enabled, intervalHours };
    await AsyncStorage.setItem(HYDRATION_PREFS_KEY, JSON.stringify(prefs));
    await notificationService.scheduleHydrationReminder(intervalHours, enabled);
  };

  const handleSetInterval = async (hrs: number) => {
    setIntervalHours(hrs);
    const prefs = { enabled: reminderEnabled, intervalHours: hrs };
    await AsyncStorage.setItem(HYDRATION_PREFS_KEY, JSON.stringify(prefs));
    if (reminderEnabled) {
      await notificationService.scheduleHydrationReminder(hrs, true);
    }
  };

  const handleTestNotification = async () => {
    await notificationService.sendImmediateTestNotification(
      '💧 Time to Hydrate!',
      'Drink a glass of water to soothe cramps, ease pelvic tension, and stay refreshed!'
    );
    Alert.alert('Reminder Sent', 'Check your device notification tray to see how reminders appear.');
  };

  const reset = async () => {
    Alert.alert('Reset Today?', 'Clear all logged water for today?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          try {
            await wellnessService.setHydration(0, goal);
            setAmount(0);
            await saveLogs([]);
          } catch {
            Alert.alert('Error', 'Could not reset.');
          }
        },
      },
    ]);
  };

  const pct = Math.min(amount / goal, 1);
  const liters = (amount / 1000).toFixed(2);
  const goalLiters = (goal / 1000).toFixed(1);
  const remaining = Math.max(goal - amount, 0);
  const fillHeight = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const cupColor = pct >= 1 ? '#059669' : pct >= 0.5 ? '#0284C7' : '#38BDF8';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Top Header */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
            <Feather name="arrow-left" size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Hydration Tracker</Text>
        </View>
        <TouchableOpacity onPress={reset} style={s.resetBtn} activeOpacity={0.7}>
          <Feather name="refresh-ccw" size={16} color="#64748B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
      >
        {/* Visual Water Bottle Card */}
        <View style={s.bottleCard}>
          <View style={s.bottleOuter}>
            <Animated.View
              style={[
                s.bottleFill,
                { height: fillHeight, backgroundColor: cupColor },
              ]}
            />
            <View style={s.bottleCenterText}>
              <Text style={[s.bottleLiters, { color: pct >= 0.4 ? '#FFFFFF' : '#0369A1' }]}>
                {liters}L
              </Text>
              <Text style={[s.bottleGoalText, { color: pct >= 0.4 ? 'rgba(255,255,255,0.9)' : '#0284C7' }]}>
                of {goalLiters}L
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 16, alignItems: 'center' }}>
            {pct >= 1 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="checkmark-circle" size={20} color="#059669" />
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#059669' }}>
                  Daily Goal Achieved!
                </Text>
              </View>
            ) : (
              <Text style={{ fontSize: 14, color: '#64748B', fontWeight: '600' }}>
                {(remaining / 1000).toFixed(2)}L remaining to goal
              </Text>
            )}

            <TouchableOpacity
              onPress={() => {
                setEditGoalInput(String(goal));
                setGoalModal(true);
              }}
              style={s.editGoalChip}
            >
              <Feather name="edit-2" size={12} color="#0284C7" />
              <Text style={s.editGoalText}>Target: {goal} mL (Tap to edit)</Text>
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          <View style={s.progTrack}>
            <Animated.View
              style={[
                s.progFill,
                {
                  width: `${Math.min(pct * 100, 100)}%`,
                  backgroundColor: cupColor,
                },
              ]}
            />
          </View>
          <View style={s.progLabels}>
            <Text style={s.progSub}>0 mL</Text>
            <Text style={[s.progSub, { color: '#0284C7', fontWeight: '800' }]}>
              {Math.round(pct * 100)}%
            </Text>
            <Text style={s.progSub}>{goal} mL</Text>
          </View>
        </View>

        {/* ── Hydration Reminder Options (New Requested Feature) ────────── */}
        <Text style={s.sectionHeader}>HYDRATION REMINDER & ALERTS</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowLeft}>
              <View style={[s.iconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="notifications-outline" size={20} color="#0284C7" />
              </View>
              <View>
                <Text style={s.rowLabel}>Drink Water Reminder</Text>
                <Text style={s.rowSub}>Regular alerts to drink water & ease cramps</Text>
              </View>
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={handleToggleReminder}
              trackColor={{ false: '#E2E8F0', true: '#BAE6FD' }}
              thumbColor={reminderEnabled ? '#0284C7' : '#94A3B8'}
            />
          </View>

          {reminderEnabled && (
            <>
              <Text style={s.subSectionLabel}>ALERT FREQUENCY</Text>
              <View style={s.intervalRow}>
                {[1, 1.5, 2, 3].map((hrs) => {
                  const isSelected = intervalHours === hrs;
                  return (
                    <TouchableOpacity
                      key={hrs}
                      onPress={() => handleSetInterval(hrs)}
                      style={[s.intervalChip, isSelected && s.intervalChipActive]}
                    >
                      <Text
                        style={[
                          s.intervalChipText,
                          isSelected && s.intervalChipTextActive,
                        ]}
                      >
                        Every {hrs === 1 ? '1 hr' : `${hrs} hrs`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                onPress={handleTestNotification}
                style={s.testBtn}
                activeOpacity={0.7}
              >
                <Feather name="bell" size={14} color="#0284C7" />
                <Text style={s.testBtnText}>Send Test Notification Now</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── Quick Add Presets ────────────────────────────────────────── */}
        <Text style={s.sectionHeader}>QUICK LOG WATER</Text>
        <View style={s.quickGrid}>
          {[
            { ml: 150, label: '150 mL', sub: 'Small cup', icon: 'cup-outline' },
            { ml: 250, label: '250 mL', sub: 'Standard glass', icon: 'cup-water' },
            { ml: 500, label: '500 mL', sub: 'Water bottle', icon: 'bottle-tonic-outline' },
            { ml: 750, label: '750 mL', sub: 'Large flask', icon: 'flask-outline' },
          ].map((btn) => (
            <TouchableOpacity
              key={btn.ml}
              onPress={() => add(btn.ml)}
              style={s.quickBtn}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={btn.icon as any}
                size={26}
                color="#0284C7"
                style={{ marginBottom: 4 }}
              />
              <Text style={s.quickBtnLabel}>{btn.label}</Text>
              <Text style={s.quickBtnSub}>{btn.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={() => setCustomModal(true)}
          style={s.customAddBtn}
          activeOpacity={0.8}
        >
          <Feather name="plus-circle" size={18} color="#0284C7" />
          <Text style={s.customAddText}>Log Custom Water Amount (mL)</Text>
        </TouchableOpacity>

        {/* ── Today's Intake Log History ─────────────────────────────────── */}
        <Text style={s.sectionHeader}>TODAY'S INTAKE LOG ({logs.length})</Text>
        <View style={s.card}>
          {logs.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <MaterialCommunityIcons name="water-off-outline" size={32} color="#94A3B8" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#64748B', marginTop: 8 }}>
                No Drinks Logged Yet
              </Text>
              <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                Tap a quick preset above to record your hydration.
              </Text>
            </View>
          ) : (
            logs.map((log, idx) => {
              const isLast = idx === logs.length - 1;
              return (
                <View
                  key={log.id}
                  style={[s.logRow, isLast && { borderBottomWidth: 0 }]}
                >
                  <View style={s.logLeft}>
                    <View style={s.logIcon}>
                      <MaterialCommunityIcons name="cup-water" size={18} color="#0284C7" />
                    </View>
                    <View>
                      <Text style={s.logAmount}>+{log.ml} mL</Text>
                      <Text style={s.logTime}>{log.time}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => deleteLog(log.id, log.ml)}
                    style={s.deleteBtn}
                  >
                    <Feather name="trash-2" size={16} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {/* Clinical Tip */}
        <View style={s.tipBox}>
          <Ionicons name="bulb-outline" size={20} color="#0284C7" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.tipTitle}>Why Hydration Matters for Cramps</Text>
            <Text style={s.tipText}>
              Staying adequately hydrated improves micro-vascular circulation in pelvic tissues,
              flushing out prostaglandins and reducing the intensity of uterine contractions.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Custom Amount Modal */}
      <Modal
        visible={customModal}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Log Custom Intake</Text>
            <Text style={s.modalSub}>Enter the exact volume consumed in milliliters</Text>

            <View style={s.modalInputRow}>
              <TextInput
                style={s.modalInput}
                keyboardType="numeric"
                placeholder="e.g. 330"
                placeholderTextColor="#94A3B8"
                value={customMl}
                onChangeText={setCustomMl}
                autoFocus
              />
              <Text style={s.modalUnit}>mL</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity
                onPress={() => setCustomModal(false)}
                style={s.modalCancelBtn}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCustomAdd} style={s.modalSaveBtn}>
                <Text style={s.modalSaveText}>Log Drink</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Goal Edit Modal */}
      <Modal
        visible={goalModal}
        transparent
        animationType="fade"
        onRequestClose={() => setGoalModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Edit Daily Target</Text>
            <Text style={s.modalSub}>Set your personalized daily water consumption goal</Text>

            <View style={s.modalInputRow}>
              <TextInput
                style={s.modalInput}
                keyboardType="numeric"
                placeholder="e.g. 2500"
                placeholderTextColor="#94A3B8"
                value={editGoalInput}
                onChangeText={setEditGoalInput}
                autoFocus
              />
              <Text style={s.modalUnit}>mL</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity
                onPress={() => setGoalModal(false)}
                style={s.modalCancelBtn}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveGoal} style={s.modalSaveBtn}>
                <Text style={s.modalSaveText}>Update Target</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    marginRight: 10,
  },
  resetBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  bottleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  bottleOuter: {
    width: 140,
    height: 200,
    borderRadius: 28,
    backgroundColor: '#E0F2FE',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#BAE6FD',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bottleFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 4,
  },
  bottleCenterText: {
    position: 'absolute',
    alignItems: 'center',
    top: '40%',
  },
  bottleLiters: {
    fontSize: 32,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  bottleGoalText: {
    fontSize: 13,
    fontWeight: '700',
  },
  editGoalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 8,
  },
  editGoalText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  progTrack: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    height: 10,
    width: '100%',
    marginTop: 18,
    overflow: 'hidden',
  },
  progFill: {
    height: '100%',
    borderRadius: 10,
  },
  progLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 6,
  },
  progSub: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
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
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  rowSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  subSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 6,
  },
  intervalRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  intervalChip: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  intervalChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0284C7',
  },
  intervalChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  intervalChipTextActive: {
    color: '#0284C7',
    fontWeight: '800',
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  testBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  quickBtn: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  quickBtnLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0369A1',
  },
  quickBtnSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  customAddBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  customAddText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  logLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  logTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  deleteBtn: {
    padding: 6,
  },
  tipBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0369A1',
    marginBottom: 2,
  },
  tipText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 16,
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalUnit: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  modalSaveBtn: {
    flex: 2,
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
