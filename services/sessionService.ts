/**
 * sessionService.ts
 * Local persistence layer for therapy session records using AsyncStorage.
 * Sessions are stored as a JSON array under the key SESSION_STORE_KEY.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_STORE_KEY = '@nari_sessions_v1';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SessionRecord {
  id: string;
  date: string;           // ISO timestamp when session was started
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
  emgPoints: number[];    // ~30-pt waveform snapshot (raw_analog values)
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
   */
  async getSessions(): Promise<SessionRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(SESSION_STORE_KEY);
      if (!raw) return [];
      const parsed: SessionRecord[] = JSON.parse(raw);
      return parsed.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    } catch (err) {
      console.error('[SessionService] getSessions error:', err);
      return [];
    }
  },

  /**
   * Save a new session record. Prepends to the existing list.
   */
  async saveSession(
    data: Omit<SessionRecord, 'id'>
  ): Promise<SessionRecord> {
    try {
      const record: SessionRecord = { id: generateId(), ...data };
      const existing = await sessionService.getSessions();
      const updated = [record, ...existing];
      await AsyncStorage.setItem(SESSION_STORE_KEY, JSON.stringify(updated));
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
