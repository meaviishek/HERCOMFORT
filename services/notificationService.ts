/**
 * notificationService.ts
 *
 * Local notifications manager for Nari Health:
 *  - Hydration alerts (recurring interval during daytime)
 *  - Medication & supplement dose alerts
 *  - Relax & Breathe mindfulness breaks
 *  - Posture check & Her Comfort therapy session cues
 *  - Cycle prediction notifications
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIF_CONFIG_KEY = '@nari_notifications_meta_v1';

// Configure foreground notification presentation
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const CHANNEL_ID = 'nari-health-reminders';

class NotificationService {
  private initialized = false;

  /**
   * Initialize notification channel (Android) and request permissions.
   */
  async init(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: 'Nari Health Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#E84EA1',
          sound: 'default',
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      this.initialized = finalStatus === 'granted';
      return this.initialized;
    } catch (e) {
      console.warn('[NotificationService] Init error:', e);
      return false;
    }
  }

  /**
   * Check whether notifications are permitted.
   */
  async hasPermission(): Promise<boolean> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * Request notification permission if not yet granted.
   */
  async requestPermission(): Promise<boolean> {
    return this.init();
  }

  /**
   * Schedule or update Hydration Reminders.
   * @param intervalHours Number of hours between reminders (e.g. 1, 1.5, 2, 3)
   * @param enabled Whether hydration reminders are turned on
   */
  async scheduleHydrationReminder(intervalHours: number, enabled: boolean): Promise<void> {
    await this.init();
    await this.cancelCategory('hydration');

    if (!enabled) return;

    try {
      const seconds = Math.max(60, Math.round(intervalHours * 3600));

      const quotes = [
        '💧 Time to Hydrate! Drink a glass of water to soothe cramps and ease bloating.',
        '✨ Hydration Cue: A glass of warm water helps relax pelvic muscles.',
        '🌿 Refresh Yourself: Keep your hydration goal on track today!',
        '💧 Water Check-in: Stay nourished and hydrated for smoother cycles.',
      ];
      const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

      await Notifications.scheduleNotificationAsync({
        identifier: `hydration_interval_${Date.now()}`,
        content: {
          title: '💧 Hydration Reminder',
          body: randomQuote,
          sound: 'default',
          data: { type: 'hydration', route: '/hydration-tracker' },
        },
        trigger: {
          seconds,
          repeats: true,
          channelId: CHANNEL_ID,
        } as any,
      });

      await this.saveMeta('hydration', { intervalHours, enabled, lastScheduled: Date.now() });
    } catch (err) {
      console.warn('[NotificationService] scheduleHydrationReminder error:', err);
    }
  }

  /**
   * Schedule Medication reminder for a specific time of day.
   * @param medId Medication document ID
   * @param name Medication name
   * @param dose Dose string (e.g. "500 mg")
   * @param timeStr Time string (e.g. "8 AM", "08:30 PM", "2 PM")
   * @param enabled Active status
   */
  async scheduleMedicationReminder(
    medId: string,
    name: string,
    dose: string,
    timeStr: string,
    enabled: boolean
  ): Promise<void> {
    await this.init();
    const identifier = `med_${medId}`;
    await this.cancelById(identifier);

    if (!enabled) return;

    try {
      const { hour, minute } = this.parseTimeString(timeStr);

      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: `💊 Medication Time: ${name}`,
          body: `Don't forget to take your ${dose ? `${dose} of ` : ''}${name} as prescribed.`,
          sound: 'default',
          data: { type: 'medication', medId, route: '/medication-reminder' },
        },
        trigger: {
          hour,
          minute,
          repeats: true,
          channelId: CHANNEL_ID,
        } as any,
      });
    } catch (err) {
      console.warn('[NotificationService] scheduleMedicationReminder error:', err);
    }
  }

  /**
   * Schedule Relax & Breathe mindfulness reminder.
   * @param timeStr Time of day (e.g. "02:00 PM")
   * @param enabled Active status
   */
  async scheduleRelaxBreatheReminder(timeStr: string, enabled: boolean): Promise<void> {
    await this.init();
    const identifier = 'reminder_relax_breathe';
    await this.cancelById(identifier);

    if (!enabled) return;

    try {
      const { hour, minute } = this.parseTimeString(timeStr);

      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: '🌸 Relax & Breathe Break',
          body: 'Take 3 minutes for deep pelvic relaxation breathing to release tension and lower cortisol.',
          sound: 'default',
          data: { type: 'breathing', route: '/breathing' },
        },
        trigger: {
          hour,
          minute,
          repeats: true,
          channelId: CHANNEL_ID,
        } as any,
      });

      await this.saveMeta('relax_breathe', { timeStr, enabled });
    } catch (err) {
      console.warn('[NotificationService] scheduleRelaxBreatheReminder error:', err);
    }
  }

  /**
   * Schedule Posture Check reminder.
   * @param enabled Active status
   */
  async schedulePostureReminder(timeStr: string, enabled: boolean): Promise<void> {
    await this.init();
    const identifier = 'reminder_posture_reset';
    await this.cancelById(identifier);

    if (!enabled) return;

    try {
      const { hour, minute } = this.parseTimeString(timeStr);

      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: '✨ Posture Alignment Check',
          body: 'Check your spine alignment and belt placement for optimal pelvic comfort and relief.',
          sound: 'default',
          data: { type: 'posture', route: '/(tabs)/session' },
        },
        trigger: {
          hour,
          minute,
          repeats: true,
          channelId: CHANNEL_ID,
        } as any,
      });

      await this.saveMeta('posture_reset', { timeStr, enabled });
    } catch (err) {
      console.warn('[NotificationService] schedulePostureReminder error:', err);
    }
  }

  /**
   * Schedule Her Comfort Therapy Session reminder.
   * @param timeStr Time of day (e.g. "07:30 PM")
   * @param enabled Active status
   */
  async scheduleTherapyReminder(timeStr: string, enabled: boolean): Promise<void> {
    await this.init();
    const identifier = 'reminder_therapy_session';
    await this.cancelById(identifier);

    if (!enabled) return;

    try {
      const { hour, minute } = this.parseTimeString(timeStr);

      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: '⚡ Her Comfort Therapy Session',
          body: 'Your scheduled evening heat & vibration session is ready. Slip on your belt for 15 minutes of calm.',
          sound: 'default',
          data: { type: 'therapy', route: '/(tabs)/session' },
        },
        trigger: {
          hour,
          minute,
          repeats: true,
          channelId: CHANNEL_ID,
        } as any,
      });

      await this.saveMeta('therapy_session', { timeStr, enabled });
    } catch (err) {
      console.warn('[NotificationService] scheduleTherapyReminder error:', err);
    }
  }

  /**
   * Schedule Period Onset Prediction reminder.
   */
  async scheduleCycleReminder(daysBefore: number, enabled: boolean): Promise<void> {
    await this.init();
    const identifier = 'reminder_cycle_predict';
    await this.cancelById(identifier);

    if (!enabled) return;

    try {
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: '🌸 Upcoming Period Prediction',
          body: `Your period is estimated to arrive in ${daysBefore} days. Keep your Her Comfort belt charged!`,
          sound: 'default',
          data: { type: 'cycle', route: '/(tabs)' },
        },
        trigger: {
          hour: 9,
          minute: 0,
          repeats: true,
          channelId: CHANNEL_ID,
        } as any,
      });

      await this.saveMeta('cycle_predict', { daysBefore, enabled });
    } catch (err) {
      console.warn('[NotificationService] scheduleCycleReminder error:', err);
    }
  }

  /**
   * Trigger an instant test notification.
   */
  async sendImmediateTestNotification(title: string, body: string): Promise<void> {
    await this.init();
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
        },
        trigger: null, // triggers immediately
      });
    } catch (err) {
      console.warn('[NotificationService] sendImmediateTestNotification error:', err);
    }
  }

  /**
   * Cancel single notification by identifier.
   */
  async cancelById(id: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {}
  }

  /**
   * Cancel all notifications in a category prefix.
   */
  async cancelCategory(prefix: string): Promise<void> {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const notif of scheduled) {
        if (notif.identifier.startsWith(prefix)) {
          await Notifications.cancelScheduledNotificationAsync(notif.identifier);
        }
      }
    } catch {}
  }

  /**
   * Cancel all scheduled notifications across the app.
   */
  async cancelAll(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {}
  }

  /**
   * Helper to parse time strings like "8 AM", "08:30 PM", "14:00".
   */
  private parseTimeString(t: string): { hour: number; minute: number } {
    const clean = t.trim().toUpperCase();
    const match12 = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
    if (match12) {
      let hour = parseInt(match12[1], 10);
      const minute = match12[2] ? parseInt(match12[2], 10) : 0;
      const isPM = match12[3] === 'PM';
      if (isPM && hour < 12) hour += 12;
      if (!isPM && hour === 12) hour = 0;
      return { hour, minute };
    }

    const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      return {
        hour: parseInt(match24[1], 10),
        minute: parseInt(match24[2], 10),
      };
    }

    return { hour: 9, minute: 0 };
  }

  private async saveMeta(key: string, data: any) {
    try {
      const raw = await AsyncStorage.getItem(NOTIF_CONFIG_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[key] = data;
      await AsyncStorage.setItem(NOTIF_CONFIG_KEY, JSON.stringify(all));
    } catch {}
  }
}

const notificationService = new NotificationService();
export default notificationService;
