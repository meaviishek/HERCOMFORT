/**
 * cycleService.ts
 * API calls for Period & Cycle Tracker with local AsyncStorage caching & offline resilience.
 * Uses the shared authApi axios instance (auth interceptors auto-attach the JWT).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { authApi } from "./authService";

// ─── Cache Keys ────────────────────────────────────────────────────────────────
const CYCLE_SUMMARY_KEY = "@nari:cycleSummary";
const CYCLE_CALENDAR_KEY = "@nari:cycleCalendar";
const CYCLE_HISTORY_KEY = "@nari:cycleHistory";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type FlowLevel = "light" | "medium" | "heavy";

export interface FlowLog {
  date: string;
  level: FlowLevel;
}

export interface Cycle {
  _id: string;
  user: string;
  startDate: string;
  endDate: string | null;
  flowLogs: FlowLog[];
  symptoms: string[];
  notes: string | null;
  periodDuration: number | null;
  cycleLength: number | null;
  isIrregular: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal";

export interface CycleSummary {
  hasData: boolean;
  currentCycle?: Cycle;
  isOngoing?: boolean;
  cycleDay?: number;
  avgCycleLength?: number;
  avgPeriodDuration?: number;
  nextPeriodDate?: string;
  daysUntilNextPeriod?: number;
  ovulationDate?: string;
  fertileWindowStart?: string;
  fertileWindowEnd?: string;
  phase?: CyclePhase;
  isIrregular?: boolean;
}

export interface CycleHistory {
  cycles: Cycle[];
  total: number;
  page: number;
  pages: number;
}

// ─── API Calls with Offline Fallback ───────────────────────────────────────────

async function getSummary(): Promise<CycleSummary> {
  try {
    const res = await authApi.get<{ success: boolean; data: CycleSummary }>(
      "/api/cycle/summary"
    );
    if (res.data?.data) {
      await AsyncStorage.setItem(
        CYCLE_SUMMARY_KEY,
        JSON.stringify(res.data.data)
      ).catch(() => {});
      return res.data.data;
    }
  } catch (err: any) {
    console.warn("[CycleService] getSummary fallback:", err?.message || err);
    try {
      const cached = await AsyncStorage.getItem(CYCLE_SUMMARY_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}
  }
  return { hasData: false };
}

async function startPeriod(payload: {
  startDate: string;
  flowLevel?: FlowLevel;
  symptoms?: string[];
  notes?: string;
}): Promise<Cycle> {
  const res = await authApi.post<{ success: boolean; data: Cycle }>(
    "/api/cycle/start",
    payload
  );
  return res.data.data;
}

async function endPeriod(payload: {
  endDate: string;
  cycleId?: string;
}): Promise<Cycle> {
  const res = await authApi.post<{ success: boolean; data: Cycle }>(
    "/api/cycle/end",
    payload
  );
  return res.data.data;
}

async function logFlow(payload: {
  date: string;
  level: FlowLevel;
  cycleId?: string;
}): Promise<Cycle> {
  const res = await authApi.post<{ success: boolean; data: Cycle }>(
    "/api/cycle/flow",
    payload
  );
  return res.data.data;
}

async function getHistory(
  page = 1,
  limit = 10
): Promise<CycleHistory> {
  try {
    const res = await authApi.get<{ success: boolean; data: CycleHistory }>(
      "/api/cycle/history",
      { params: { page, limit } }
    );
    if (res.data?.data) {
      if (page === 1) {
        await AsyncStorage.setItem(
          CYCLE_HISTORY_KEY,
          JSON.stringify(res.data.data)
        ).catch(() => {});
      }
      return res.data.data;
    }
  } catch (err: any) {
    console.warn("[CycleService] getHistory fallback:", err?.message || err);
    try {
      const cached = await AsyncStorage.getItem(CYCLE_HISTORY_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}
  }
  return { cycles: [], total: 0, page: 1, pages: 1 };
}

async function getCalendarData(
  year: number,
  month: number
): Promise<Cycle[]> {
  const cacheKey = `${CYCLE_CALENDAR_KEY}_${year}_${month}`;
  try {
    const res = await authApi.get<{ success: boolean; data: Cycle[] }>(
      "/api/cycle/calendar",
      { params: { year, month } }
    );
    if (res.data?.data) {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(res.data.data)).catch(() => {});
      return res.data.data;
    }
  } catch (err: any) {
    console.warn("[CycleService] getCalendarData fallback:", err?.message || err);
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}
  }
  return [];
}

async function updateCycle(
  id: string,
  updates: Partial<Pick<Cycle, "startDate" | "endDate" | "flowLogs" | "symptoms" | "notes">>
): Promise<Cycle> {
  const res = await authApi.patch<{ success: boolean; data: Cycle }>(
    `/api/cycle/${id}`,
    updates
  );
  return res.data.data;
}

async function deleteCycle(id: string): Promise<void> {
  await authApi.delete(`/api/cycle/${id}`);
}

export default {
  getSummary,
  startPeriod,
  endPeriod,
  logFlow,
  getHistory,
  getCalendarData,
  updateCycle,
  deleteCycle,
};
