/**
 * cycleService.ts
 * API calls for Period & Cycle Tracker.
 * Uses the shared authApi axios instance (auth interceptors auto-attach the JWT).
 */

import { authApi } from "./authService";

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

// ─── API Calls ────────────────────────────────────────────────────────────────

async function getSummary(): Promise<CycleSummary> {
  const res = await authApi.get<{ success: boolean; data: CycleSummary }>(
    "/api/cycle/summary"
  );
  return res.data.data;
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
  const res = await authApi.get<{ success: boolean; data: CycleHistory }>(
    "/api/cycle/history",
    { params: { page, limit } }
  );
  return res.data.data;
}

async function getCalendarData(
  year: number,
  month: number
): Promise<Cycle[]> {
  const res = await authApi.get<{ success: boolean; data: Cycle[] }>(
    "/api/cycle/calendar",
    { params: { year, month } }
  );
  return res.data.data;
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
