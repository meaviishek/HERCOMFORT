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
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T } from '../constants/theme';
import notificationService from '../services/notificationService';

const REMINDERS_KEY = '@nari_reminders_config_v2';

export interface ReminderItem {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  enabled: boolean;
  category: 'cycle' | 'therapy' | 'wellness' | 'mindfulness';
  icon: string;
  iconColor: string;
  targetRoute?: string;
}

const DEFAULT_REMINDERS: ReminderItem[] = [
  // ── Cycle & Reproductive ──
  {
    id: 'period_predict',
    title: 'Upcoming Period Alert',
    subtitle: 'Alert 2 days before predicted onset',
    time: '09:00 AM',
    enabled: true,
    category: 'cycle',
    icon: 'water',
    iconColor: '#E84EA1',
    targetRoute: '/(tabs)',
  },
  {
    id: 'ovulation_window',
    title: 'Fertile Window & Ovulation',
    subtitle: 'Notification when fertile window starts',
    time: '10:00 AM',
    enabled: true,
    category: 'cycle',
    icon: 'flower-tulip-outline',
    iconColor: '#7C3AED',
    targetRoute: '/(tabs)',
  },
  {
    id: 'symptom_log',
    title: 'Daily Symptom Log',
    subtitle: 'Evening prompt to record pain & mood',
    time: '08:30 PM',
    enabled: true,
    category: 'cycle',
    icon: 'clipboard-pulse-outline',
    iconColor: '#0284C7',
    targetRoute: '/symptoms-tracker',
  },

  // ── Physical Therapy & Her Comfort ──
  {
    id: 'therapy_session',
    title: 'Her Comfort Therapy Session',
    subtitle: 'Scheduled thermal & vibration pain relief',
    time: '07:30 PM',
    enabled: true,
    category: 'therapy',
    icon: 'lightning-bolt',
    iconColor: '#E84EA1',
    targetRoute: '/(tabs)/session',
  },
  {
    id: 'posture_reset',
    title: 'Posture & Belt Check',
    subtitle: 'Check spine alignment & belt fit for relief',
    time: '11:30 AM',
    enabled: true,
    category: 'therapy',
    icon: 'human-straighten',
    iconColor: '#059669',
    targetRoute: '/(tabs)/session',
  },
  {
    id: 'device_battery',
    title: 'Belt Battery & Readiness',
    subtitle: 'Alert when belt battery is below 20%',
    time: 'Immediate',
    enabled: true,
    category: 'therapy',
    icon: 'battery-alert-variant-outline',
    iconColor: '#D97706',
    targetRoute: '/ble-device',
  },

  // ── Mindfulness & Relaxation ──
  {
    id: 'relax_breathe',
    title: 'Relax & Breathe (Mindfulness)',
    subtitle: '3-min pelvic relaxation breathing break',
    time: '02:00 PM',
    enabled: true,
    category: 'mindfulness',
    icon: 'weather-windy',
    iconColor: '#10B981',
    targetRoute: '/breathing',
  },
  {
    id: 'gentle_walk',
    title: 'Gentle Movement & Stretch',
    subtitle: 'Break prolonged sitting to reduce cramps',
    time: '04:30 PM',
    enabled: true,
    category: 'mindfulness',
    icon: 'walk',
    iconColor: '#F59E0B',
    targetRoute: '/exercises',
  },

  // ── Hydration & Wellness ──
  {
    id: 'hydration',
    title: 'Hydration Intake Alert',
    subtitle: 'Regular prompts to drink water & ease cramps',
    time: 'Every 2 hrs',
    enabled: true,
    category: 'wellness',
    icon: 'cup-water',
    iconColor: '#0284C7',
    targetRoute: '/hydration-tracker',
  },
  {
    id: 'sleep_winddown',
    title: 'Bedtime Wind-down & Rest',
    subtitle: 'Gentle cue to begin evening rest routine',
    time: '10:30 PM',
    enabled: false,
    category: 'wellness',
    icon: 'moon-waning-crescent',
    iconColor: '#6366F1',
    targetRoute: '/sleep-tracker',
  },
];

const TIME_PRESETS = [
  '07:00 AM',
  '08:00 AM',
  '09:00 AM',
  '10:00 AM',
  '11:30 AM',
  '12:00 PM',
  '02:00 PM',
  '04:30 PM',
  '06:00 PM',
  '07:30 PM',
  '08:30 PM',
  '09:30 PM',
  '10:30 PM',
  'Every 1 hr',
  'Every 2 hrs',
  'Every 3 hrs',
];

export default function RemindersScreen() {
  const router = useRouter();
  const [reminders, setReminders] = useState<ReminderItem[]>(DEFAULT_REMINDERS);
  const [editingItem, setEditingItem] = useState<ReminderItem | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(REMINDERS_KEY).then((raw) => {
      if (raw) {
        try {
          setReminders(JSON.parse(raw));
        } catch {}
      }
    });
  }, []);

  const syncNotification = async (item: ReminderItem) => {
    switch (item.id) {
      case 'hydration':
        const hrs = item.time.includes('1') ? 1 : item.time.includes('3') ? 3 : 2;
        await notificationService.scheduleHydrationReminder(hrs, item.enabled);
        break;
      case 'relax_breathe':
        await notificationService.scheduleRelaxBreatheReminder(item.time, item.enabled);
        break;
      case 'posture_reset':
        await notificationService.schedulePostureReminder(item.time, item.enabled);
        break;
      case 'therapy_session':
        await notificationService.scheduleTherapyReminder(item.time, item.enabled);
        break;
      case 'period_predict':
        await notificationService.scheduleCycleReminder(2, item.enabled);
        break;
      default:
        break;
    }
  };

  const saveReminders = (updated: ReminderItem[]) => {
    setReminders(updated);
    AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(updated)).catch(() => {});
  };

  const toggleReminder = async (id: string) => {
    const updated = reminders.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    saveReminders(updated);
    const target = updated.find((r) => r.id === id);
    if (target) {
      await syncNotification(target);
    }
  };

  const updateTime = async (time: string) => {
    if (!editingItem) return;
    const updated = reminders.map((r) =>
      r.id === editingItem.id ? { ...r, time } : r
    );
    saveReminders(updated);
    const target = updated.find((r) => r.id === editingItem.id);
    if (target) {
      await syncNotification(target);
    }
    setEditingItem(null);
  };

  const handleTestAlert = async () => {
    await notificationService.sendImmediateTestNotification(
      '🌸 Nari Health Reminder Test',
      'Reminders are successfully enabled! You will receive scheduled alerts for hydration, therapy, and mindfulness.'
    );
    Alert.alert('Test Sent', 'A test reminder has been dispatched to your notification tray.');
  };

  const cycleReminders = reminders.filter((r) => r.category === 'cycle');
  const therapyReminders = reminders.filter((r) => r.category === 'therapy');
  const mindfulnessReminders = reminders.filter((r) => r.category === 'mindfulness');
  const wellnessReminders = reminders.filter((r) => r.category === 'wellness');

  const renderSection = (title: string, list: ReminderItem[]) => (
    <View style={{ marginBottom: 20 }}>
      <Text style={s.sectionHeader}>{title}</Text>
      <View style={s.card}>
        {list.map((item, idx) => {
          const isLast = idx === list.length - 1;
          return (
            <View
              key={item.id}
              style={[s.reminderRow, isLast && { borderBottomWidth: 0 }]}
            >
              <TouchableOpacity
                onPress={() => item.targetRoute && router.push(item.targetRoute as any)}
                style={[s.iconBox, { backgroundColor: item.iconColor + '18' }]}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={item.icon as any}
                  size={22}
                  color={item.iconColor}
                />
              </TouchableOpacity>

              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <TouchableOpacity
                  onPress={() => item.targetRoute && router.push(item.targetRoute as any)}
                  activeOpacity={0.8}
                >
                  <Text style={s.reminderTitle}>{item.title}</Text>
                  <Text style={s.reminderSub}>{item.subtitle}</Text>
                </TouchableOpacity>

                {item.time !== 'Immediate' && (
                  <TouchableOpacity
                    style={s.timeChip}
                    onPress={() => setEditingItem(item)}
                    activeOpacity={0.7}
                  >
                    <Feather name="clock" size={11} color="#64748B" />
                    <Text style={s.timeChipText}>{item.time}</Text>
                    <Feather name="chevron-down" size={12} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              <Switch
                value={item.enabled}
                onValueChange={() => toggleReminder(item.id)}
                trackColor={{ false: '#E2E8F0', true: '#FBCFE8' }}
                thumbColor={item.enabled ? T.pink.action : '#94A3B8'}
              />
            </View>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Reminders & Alerts</Text>
        <TouchableOpacity
          onPress={handleTestAlert}
          style={s.testBellBtn}
          activeOpacity={0.7}
        >
          <Feather name="bell" size={18} color={T.pink.action} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Access Top Cards */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <TouchableOpacity
            style={s.featureCard}
            onPress={() => router.push('/hydration-tracker' as any)}
            activeOpacity={0.85}
          >
            <View style={[s.featureIcon, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="water-outline" size={20} color="#0284C7" />
            </View>
            <Text style={s.featureTitle}>Hydration</Text>
            <Text style={s.featureSub}>Log & timer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.featureCard}
            onPress={() => router.push('/medication-reminder' as any)}
            activeOpacity={0.85}
          >
            <View style={[s.featureIcon, { backgroundColor: '#D1FAE5' }]}>
              <MaterialCommunityIcons name="pill" size={20} color="#059669" />
            </View>
            <Text style={s.featureTitle}>Medications</Text>
            <Text style={s.featureSub}>Pills & doses</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.featureCard}
            onPress={() => router.push('/breathing' as any)}
            activeOpacity={0.85}
          >
            <View style={[s.featureIcon, { backgroundColor: '#EDE9FE' }]}>
              <MaterialCommunityIcons name="weather-windy" size={20} color="#7C3AED" />
            </View>
            <Text style={s.featureTitle}>Relax Breath</Text>
            <Text style={s.featureSub}>Pelvic calm</Text>
          </TouchableOpacity>
        </View>

        {/* Reminder Sections */}
        {renderSection('MINDFULNESS & PELVIC RELAXATION', mindfulnessReminders)}
        {renderSection('HER COMFORT THERAPY & BIOAMP', therapyReminders)}
        {renderSection('HYDRATION & REST', wellnessReminders)}
        {renderSection('CYCLE & REPRODUCTIVE HEALTH', cycleReminders)}
      </ScrollView>

      {/* Time Picker Modal */}
      <Modal
        visible={!!editingItem}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingItem(null)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditingItem(null)}
        >
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Set Alert Time</Text>
            <Text style={s.modalSub}>{editingItem?.title}</Text>

            <ScrollView style={{ maxHeight: 280, marginTop: 8 }} showsVerticalScrollIndicator={false}>
              {TIME_PRESETS.map((t) => {
                const isSelected = editingItem?.time === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[s.modalOpt, isSelected && s.modalOptSelected]}
                    onPress={() => updateTime(t)}
                  >
                    <Text style={[s.modalOptText, isSelected && s.modalOptTextSelected]}>
                      {t}
                    </Text>
                    {isSelected && <Feather name="check" size={18} color={T.pink.action} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setEditingItem(null)}
              style={s.modalCancelBtn}
            >
              <Text style={s.modalCancelText}>Cancel</Text>
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
  testBellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F5',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  featureCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  featureSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
    textAlign: 'center',
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  reminderSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  timeChipText: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: '#475569',
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
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 8,
  },
  modalOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
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
