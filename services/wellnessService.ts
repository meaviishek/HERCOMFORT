import { authApi as api } from "./authService";  // reuses the axios instance with JWT interceptors

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MoodEntry {
  value: string; emoji: string; label: string; note: string; date: string; loggedAt?: string;
}
export interface SleepEntry {
  duration: number; quality: number; bedtime: string; wakeTime: string; date: string;
}
export interface SleepInsights {
  avgDuration: number; avgQuality: number; message: string;
}
export interface HydrationEntry {
  amount: number; goal: number; date: string;
}
export interface SymptomEntry {
  symptoms: string[]; date: string;
}
export interface SymptomInsights {
  topSymptoms: { key: string; count: number }[];
  totalLogs: number;
}
export interface Medication {
  _id: string; name: string; dose: string; unit: string;
  time: string; frequency: string; notes: string; active: boolean; createdAt: string;
}
export interface DailySummary {
  date: string;
  mood?: MoodEntry;
  sleep?: SleepEntry;
  hydration?: HydrationEntry;
  symptoms?: { list: string[]; loggedAt: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const data = <T>(res: { data: { data: T } }) => res.data.data;

// ─── Mood ─────────────────────────────────────────────────────────────────────
export const logMood = async (payload: Omit<MoodEntry, "loggedAt">) =>
  data<DailySummary>(await api.post("/api/wellness/mood", payload));

export const getMoodHistory = async (days = 30): Promise<MoodEntry[]> =>
  data(await api.get(`/api/wellness/mood/history?days=${days}`));

// ─── Sleep ────────────────────────────────────────────────────────────────────
export const logSleep = async (payload: Omit<SleepEntry, "date"> & { date?: string }) =>
  data<DailySummary>(await api.post("/api/wellness/sleep", payload));

export const getSleepHistory = async (days = 30): Promise<SleepEntry[]> =>
  data(await api.get(`/api/wellness/sleep/history?days=${days}`));

export const getSleepInsights = async (): Promise<SleepInsights | null> =>
  data(await api.get("/api/wellness/sleep/insights"));

// ─── Hydration ────────────────────────────────────────────────────────────────
export const getTodayHydration = async (): Promise<HydrationEntry> =>
  data(await api.get("/api/wellness/hydration/today"));

export const addHydration = async (ml: number, goal?: number) =>
  data<HydrationEntry>(await api.post("/api/wellness/hydration/add", { ml, goal }));

export const setHydration = async (amount: number, goal?: number) =>
  data<HydrationEntry>(await api.post("/api/wellness/hydration", { amount, goal }));

export const getHydrationHistory = async (days = 7): Promise<HydrationEntry[]> =>
  data(await api.get(`/api/wellness/hydration/history?days=${days}`));

// ─── Symptoms ─────────────────────────────────────────────────────────────────
export const logSymptoms = async (symptoms: string[], date?: string) =>
  data<DailySummary>(await api.post("/api/wellness/symptoms", { symptoms, date }));

export const getSymptomsHistory = async (days = 30): Promise<SymptomEntry[]> =>
  data(await api.get(`/api/wellness/symptoms/history?days=${days}`));

export const getSymptomInsights = async (): Promise<SymptomInsights> =>
  data(await api.get("/api/wellness/symptoms/insights"));

// ─── Medications ─────────────────────────────────────────────────────────────
export const getMedications = async (): Promise<Medication[]> =>
  data(await api.get("/api/wellness/medications"));

export const addMedication = async (med: Omit<Medication, "_id" | "createdAt">) =>
  data<Medication>(await api.post("/api/wellness/medications", med));

export const updateMedication = async (id: string, patch: Partial<Medication>) =>
  data<Medication>(await api.patch(`/api/wellness/medications/${id}`, patch));

export const deleteMedication = async (id: string) =>
  data(await api.delete(`/api/wellness/medications/${id}`));

// ─── Overview ─────────────────────────────────────────────────────────────────
export const getDailySummary = async (date?: string): Promise<DailySummary> =>
  data(await api.get(`/api/wellness/summary${date ? `?date=${date}` : ""}`));

export const getWeeklyOverview = async (): Promise<DailySummary[]> =>
  data(await api.get("/api/wellness/week"));

const wellnessService = {
  logMood, getMoodHistory,
  logSleep, getSleepHistory, getSleepInsights,
  getTodayHydration, addHydration, setHydration, getHydrationHistory,
  logSymptoms, getSymptomsHistory, getSymptomInsights,
  getMedications, addMedication, updateMedication, deleteMedication,
  getDailySummary, getWeeklyOverview,
};

export default wellnessService;
