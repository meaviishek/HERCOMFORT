/**
 * sessionService.ts
 * Local persistence layer for therapy session records using AsyncStorage.
 * Sessions are stored as a JSON array under the key SESSION_STORE_KEY.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from './ApiService';

const SESSION_STORE_KEY = '@nari_sessions_v1';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SessionRecord {
  id: string;
  date: string;            // ISO timestamp when session was started
  durationSeconds: number; // exact seconds (e.g. 300 for 5 min)
  durationMin: number;     // rounded minutes
  targetDurationMin?: number; // target duration preset in minutes (10, 15, 20, 30)
  status?: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  location: string;        // e.g. "Lower Abdomen"
  painBefore: number;      // 0–10
  painAfter: number;       // 0–10
  avgTemp: number;         // °C
  maxTemp: number;         // °C
  targetTemp: number;      // °C set by user (heater setpoint)
  vibIntensity: number;    // 0–100 %
  /** OFF | CONTINUOUS | PULSE | HARMONIC */
  vibMode: string;
  heaterEnabled: boolean;
  motorEnabled: boolean;
  symptoms: string[];      // selected symptom keys
  emgPoints: number[];     // waveform snapshot (last 30 pts)
  emgRms?: number;         // Root Mean Square of EMG
  avgBodyAngle?: number;   // average body angle during session (degrees)
  primaryPosition?: string;// most common firmware position string
  imuStats?: {
    avgMovement: number;
    maxMovement: number;
  };
  contractionLevel?: string;
  notes: string;
  deviceId?: string;
  userId?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function generateId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Service ───────────────────────────────────────────────────────────────────

const sessionService = {
  /**
   * Retrieve all stored sessions, newest first.
   * Merges remote MongoDB sessions with local offline sessions.
   */
  async getSessions(): Promise<SessionRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(SESSION_STORE_KEY);
      const local: SessionRecord[] = raw ? JSON.parse(raw) : [];

      // Try fetching from remote MongoDB
      try {
        const remote = await ApiService.getRemoteSessions();
        if (remote && remote.length > 0) {
        const remoteRecords: SessionRecord[] = remote.map((r: any) => ({
            id: r.sessionId || r._id,
            date: r.startTime || r.createdAt,
            durationSeconds: r.durationSeconds ?? ((r.durationMin ?? 0) * 60),
            durationMin: r.durationMin ?? Math.round((r.durationSeconds ?? 0) / 60),
            targetDurationMin: r.targetDurationMin,
            status: r.status || 'COMPLETED',
            location: r.location || 'Lower Abdomen',
            painBefore: r.painBefore ?? 5,
            painAfter: r.painAfter ?? r.painBefore ?? 3,
            avgTemp: r.features?.avgTemp ?? 36.6,
            maxTemp: r.features?.maxTemp ?? 36.6,
            targetTemp: r.therapy?.targetTemp ?? 40,
            vibIntensity: r.therapy?.vibIntensity ?? 100,
            vibMode: r.therapy?.vibMode ?? 'CONTINUOUS',
            heaterEnabled: r.therapy?.heatEnabled ?? false,
            motorEnabled: r.therapy?.vibEnabled ?? false,
            symptoms: r.symptoms ?? [],
            emgPoints: r.features?.emgPoints ?? [],
            emgRms: r.features?.emgRms,
            avgBodyAngle: r.features?.avgBodyAngle,
            primaryPosition: r.features?.primaryPosition,
            imuStats: r.features?.imuStats,
            contractionLevel: r.features?.contractionLevel,
            notes: r.notes ?? '',
            deviceId: r.deviceId,
            userId: r.userId,
          }));

          const seen = new Set(local.map((s) => s.id));
          for (const rem of remoteRecords) {
            if (!seen.has(rem.id)) {
              local.push(rem);
            }
          }
        }
      } catch (remErr) {
        console.warn('[SessionService] Remote fetch notice:', remErr);
      }

      return local.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    } catch (err) {
      console.error('[SessionService] getSessions error:', err);
      return [];
    }
  },

  /**
   * Immediately persist session when user presses "Start Session".
   * Stores to AsyncStorage and writes to MongoDB with status IN_PROGRESS.
   */
  async startSession(data: {
    sessionId?: string;
    location: string;
    painBefore: number;
    symptoms: string[];
    targetDurationMin: number;
    deviceId?: string;
    targetTemp?: number;
    vibIntensity?: number;
    vibMode?: string;
  }): Promise<SessionRecord> {
    try {
      const id = data.sessionId || generateId();
      let userId: string | undefined;
      try {
        const uStr = await AsyncStorage.getItem('@nari:user');
        if (uStr) {
          const u = JSON.parse(uStr);
          userId = u._id || u.id;
        }
      } catch {}

      const record: SessionRecord = {
        id,
        date: new Date().toISOString(),
        durationSeconds: 0,
        durationMin: 0,
        targetDurationMin: data.targetDurationMin,
        status: 'IN_PROGRESS',
        location: data.location,
        painBefore: data.painBefore,
        painAfter: data.painBefore,
        avgTemp: 36.6,
        maxTemp: 36.6,
        targetTemp: data.targetTemp ?? 40,
        vibIntensity: data.vibIntensity ?? 100,
        vibMode: data.vibMode ?? 'CONTINUOUS',
        heaterEnabled: false,
        motorEnabled: false,
        symptoms: data.symptoms,
        emgPoints: [],
        deviceId: data.deviceId || 'HER-COMFORT',
        userId,
        notes: `Relief therapy initiated. Target: ${data.targetDurationMin} min. Location: ${data.location}. Initial pain: ${data.painBefore}/10.`,
      };

      const existing = await sessionService.getSessions();
      const updated = [record, ...existing.filter((s) => s.id !== record.id)];
      await AsyncStorage.setItem(SESSION_STORE_KEY, JSON.stringify(updated));

      // Post start event to MongoDB
      ApiService.saveSessionRecord({
        sessionId: record.id,
        userId,
        deviceId: record.deviceId,
        startTime: record.date,
        status: 'IN_PROGRESS',
        targetDurationMin: record.targetDurationMin,
        durationSeconds: 0,
        durationMin: 0,
        painBefore: record.painBefore,
        location: record.location,
        symptoms: record.symptoms,
        therapy: {
          heatEnabled: false,
          targetTemp: record.targetTemp,
          vibEnabled: false,
          vibIntensity: record.vibIntensity,
          vibMode: record.vibMode,
        },
        notes: record.notes,
      }).catch((err) => console.warn('[SessionService] MongoDB startSession sync notice:', err));

      return record;
    } catch (err) {
      console.error('[SessionService] startSession error:', err);
      throw err;
    }
  },

  /**
   * Save or update a finished session record. Stores locally and syncs to MongoDB.
   */
  async saveSession(
    data: Omit<SessionRecord, 'id'> & { id?: string }
  ): Promise<SessionRecord> {
    try {
      const record: SessionRecord = {
        ...data,
        id: data.id || generateId(),
        status: 'COMPLETED',
      };
      const existing = await sessionService.getSessions();
      const updated = [record, ...existing.filter((s) => s.id !== record.id)];
      await AsyncStorage.setItem(SESSION_STORE_KEY, JSON.stringify(updated));

      // Map UI contraction label → MongoDB enum value
      const contractionMap: Record<string, string> = {
        'MUSCLE FREE':         'MUSCLE_FREE',
        'RELAXED':             'RELAXED',
        'SLIGHTLY TIGHT':      'SLIGHTLY_TIGHT',
        'HIGH TIGHTNESS':      'HIGH_TIGHTNESS',
        'EXTREME CONTRACTION': 'EXTREME_CONTRACTION',
      };
      const rawLabel = (record.contractionLevel ?? 'MUSCLE FREE').toUpperCase();
      const dbContraction = contractionMap[rawLabel] ?? 'MUSCLE_FREE';

      // Get user id if not provided
      let userId = record.userId;
      if (!userId) {
        try {
          const uStr = await AsyncStorage.getItem('@nari:user');
          if (uStr) {
            const u = JSON.parse(uStr);
            userId = u._id || u.id;
          }
        } catch {}
      }

      // Sync to MongoDB backend asynchronously
      ApiService.saveSessionRecord({
        sessionId: record.id,
        userId,
        deviceId: record.deviceId || 'HER-COMFORT',
        status: 'COMPLETED',
        targetDurationMin: record.targetDurationMin,
        durationSeconds: record.durationSeconds,
        durationMin: record.durationMin,
        startTime: record.date,
        endTime: new Date().toISOString(),
        painBefore: record.painBefore,
        painAfter: record.painAfter,
        location: record.location,
        symptoms: record.symptoms,
        therapy: {
          heatEnabled: record.heaterEnabled ?? false,
          targetTemp: record.targetTemp,
          vibEnabled: record.motorEnabled ?? false,
          vibIntensity: record.vibIntensity,
          vibMode: record.vibMode,
        },
        features: {
          emgRms: record.emgRms ?? 0,
          emgPoints: (record.emgPoints ?? []).slice(-30),
          avgTemp: record.avgTemp,
          maxTemp: record.maxTemp,
          avgBodyAngle: record.avgBodyAngle ?? 0,
          primaryPosition: record.primaryPosition ?? 'UNKNOWN',
          imuStats: record.imuStats ?? { avgMovement: 0, maxMovement: 0 },
          contractionLevel: dbContraction,
        },
        notes: record.notes,
      }).catch((err) => console.warn('[SessionService] MongoDB save notice:', err));

      return record;
    } catch (err) {
      console.error('[SessionService] saveSession error:', err);
      throw err;
    }
  },

  /**
   * Delete a single session by id.
   */
  async deleteSession(id: string): Promise<void> {
    try {
      const existing = await sessionService.getSessions();
      const updated = existing.filter((s) => s.id !== id);
      await AsyncStorage.setItem(SESSION_STORE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('[SessionService] deleteSession error:', err);
    }
  },

  /**
   * Wipe all sessions (use with caution).
   */
  async clearSessions(): Promise<void> {
    await AsyncStorage.removeItem(SESSION_STORE_KEY);
  },

  /**
   * Filter helpers.
   */
  filterThisWeek(sessions: SessionRecord[]): SessionRecord[] {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return sessions.filter((s) => new Date(s.date) >= startOfWeek);
  },

  filterThisMonth(sessions: SessionRecord[]): SessionRecord[] {
    const now = new Date();
    return sessions.filter((s) => {
      const d = new Date(s.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  },
};

export default sessionService;
