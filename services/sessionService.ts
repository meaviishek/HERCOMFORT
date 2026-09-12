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
  date: string;           // ISO timestamp when session was started
  durationSeconds: number;// exact seconds (e.g. 300 for 5 min)
  durationMin: number;    // rounded minutes
  location: string;       // e.g. "Lower abdomen"
  painBefore: number;     // 0-10
  painAfter: number;      // 0-10
  avgTemp: number;        // °C
  maxTemp: number;        // °C
  targetTemp: number;     // °C set by user
  vibIntensity: number;   // 0-100 %
  vibMode: string;        // Continuous | Pulse | Wave | Relax
  symptoms: string[];     // selected symptom keys
  emgPoints: number[];    // waveform snapshot
  emgRms?: number;        // Root Mean Square of EMG
  imuStats?: {
    avgMovement: number;
    maxMovement: number;
  };
  contractionLevel?: string;
  notes: string;          // auto-generated or manual notes
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
            durationSeconds: r.durationSeconds ?? (r.durationMin * 60),
            durationMin: r.durationMin,
            location: r.location,
            painBefore: r.painBefore,
            painAfter: r.painAfter,
            avgTemp: r.features?.avgTemp ?? 36.6,
            maxTemp: r.features?.maxTemp ?? 36.6,
            targetTemp: r.therapy?.targetTemp ?? 40,
            vibIntensity: r.therapy?.vibIntensity ?? 70,
            vibMode: r.therapy?.vibMode ?? 'Pulse',
            symptoms: r.symptoms ?? [],
            emgPoints: [],
            emgRms: r.features?.emgRms,
            imuStats: r.features?.imuStats,
            contractionLevel: r.features?.contractionLevel,
            notes: r.notes ?? '',
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
   * Save a new session record. Stores locally and syncs to MongoDB.
   */
  async saveSession(
    data: Omit<SessionRecord, 'id'>
  ): Promise<SessionRecord> {
    try {
      const record: SessionRecord = { id: generateId(), ...data };
      const existing = await sessionService.getSessions();
      const updated = [record, ...existing.filter((s) => s.id !== record.id)];
      await AsyncStorage.setItem(SESSION_STORE_KEY, JSON.stringify(updated));

      // Sync to MongoDB backend asynchronously
      ApiService.saveSessionRecord({
        sessionId: record.id,
        durationSeconds: record.durationSeconds,
        durationMin: record.durationMin,
        startTime: record.date,
        endTime: new Date().toISOString(),
        painBefore: record.painBefore,
        painAfter: record.painAfter,
        location: record.location,
        symptoms: record.symptoms,
        therapy: {
          heatEnabled: true,
          targetTemp: record.targetTemp,
          vibEnabled: record.vibIntensity > 0,
          vibIntensity: record.vibIntensity,
          vibMode: record.vibMode,
        },
        features: {
          emgRms: record.emgRms ?? 0,
          avgTemp: record.avgTemp,
          maxTemp: record.maxTemp,
          imuStats: record.imuStats ?? { avgMovement: 0, maxMovement: 0 },
          contractionLevel: record.contractionLevel ?? 'Relaxed',
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
