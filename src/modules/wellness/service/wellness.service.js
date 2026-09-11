import WellnessLog from '../../../models/WellnessLog.js';
import Medication  from '../../../models/Medication.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function upsertOpts(userId, date) {
  return {
    filter: { user: userId, date },
    options: { upsert: true, new: true, setDefaultsOnInsert: true },
  };
}

// ─── MOOD ─────────────────────────────────────────────────────────────────────
export async function logMood(userId, { mood, emoji, label, note, date }) {
  const d = date || todayStr();
  const { filter, options } = upsertOpts(userId, d);
  return WellnessLog.findOneAndUpdate(
    filter,
    { $set: { mood: { value: mood, emoji, label, note: note || "", loggedAt: new Date() } } },
    options
  );
}

export async function getMoodHistory(userId, days = 30) {
  const logs = await WellnessLog.find({ user: userId, "mood.value": { $exists: true } })
    .sort({ date: -1 })
    .limit(days)
    .lean();
  return logs.map(l => ({ ...l.mood, date: l.date }));
}

// ─── SLEEP ────────────────────────────────────────────────────────────────────
export async function logSleep(userId, { duration, quality, bedtime, wakeTime, date }) {
  const d = date || todayStr();
  const { filter, options } = upsertOpts(userId, d);
  return WellnessLog.findOneAndUpdate(
    filter,
    { $set: { sleep: { duration, quality, bedtime, wakeTime, loggedAt: new Date() } } },
    options
  );
}

export async function getSleepHistory(userId, days = 30) {
  const logs = await WellnessLog.find({ user: userId, "sleep.duration": { $exists: true } })
    .sort({ date: -1 })
    .limit(days)
    .lean();
  return logs.map(l => ({ ...l.sleep, date: l.date }));
}

export async function getSleepInsights(userId) {
  const history = await getSleepHistory(userId, 14);
  if (history.length < 3) return null;
  const avg = history.reduce((s, h) => s + (h.duration || 0), 0) / history.length;
  const avgQuality = history.reduce((s, h) => s + (h.quality || 0), 0) / history.length;
  return {
    avgDuration: parseFloat(avg.toFixed(1)),
    avgQuality: parseFloat(avgQuality.toFixed(1)),
    message: avg < 6
      ? "Your average sleep is under 6 hours. Studies show poor sleep can intensify period pain by up to 25%. Aim for 7-8 hours 🌙"
      : "Your sleep pattern looks good! Quality sleep helps regulate hormones and reduces pain sensitivity 💪",
  };
}

// ─── HYDRATION ────────────────────────────────────────────────────────────────
export async function logHydration(userId, { amount, goal, date }) {
  const d = date || todayStr();
  const { filter, options } = upsertOpts(userId, d);
  return WellnessLog.findOneAndUpdate(
    filter,
    { $set: { hydration: { amount, goal: goal || 2500, loggedAt: new Date() } } },
    options
  );
}

export async function addHydration(userId, { ml, goal, date }) {
  const d = date || todayStr();
  const existing = await WellnessLog.findOne({ user: userId, date: d }).lean();
  const currentAmount = existing?.hydration?.amount || 0;
  const newAmount = Math.min(currentAmount + ml, (goal || 2500) * 1.5);
  return logHydration(userId, { amount: newAmount, goal, date: d });
}

export async function getTodayHydration(userId) {
  const d = todayStr();
  const log = await WellnessLog.findOne({ user: userId, date: d }).lean();
  return log?.hydration || { amount: 0, goal: 2500 };
}

export async function getHydrationHistory(userId, days = 7) {
  const logs = await WellnessLog.find({ user: userId, "hydration.amount": { $gt: 0 } })
    .sort({ date: -1 })
    .limit(days)
    .lean();
  return logs.map(l => ({ ...l.hydration, date: l.date }));
}

// ─── SYMPTOMS ─────────────────────────────────────────────────────────────────
export async function logSymptoms(userId, { symptoms, date }) {
  const d = date || todayStr();
  const { filter, options } = upsertOpts(userId, d);
  return WellnessLog.findOneAndUpdate(
    filter,
    { $set: { symptoms: { list: symptoms || [], loggedAt: new Date() } } },
    options
  );
}

export async function getSymptomsHistory(userId, days = 30) {
  const logs = await WellnessLog.find({ user: userId, "symptoms.loggedAt": { $exists: true } })
    .sort({ date: -1 })
    .limit(days)
    .lean();
  return logs.map(l => ({ symptoms: l.symptoms?.list || [], date: l.date }));
}

export async function getSymptomInsights(userId) {
  const history = await getSymptomsHistory(userId, 60);
  const freq = {};
  history.forEach(h => h.symptoms.forEach(s => { freq[s] = (freq[s] || 0) + 1; }));
  const top = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({ key, count }));
  return { topSymptoms: top, totalLogs: history.length };
}

// ─── MEDICATIONS ──────────────────────────────────────────────────────────────
export async function getMedications(userId) {
  return Medication.find({ user: userId }).sort({ createdAt: -1 }).lean();
}

export async function addMedication(userId, data) {
  return Medication.create({ user: userId, ...data });
}

export async function updateMedication(userId, medId, data) {
  return Medication.findOneAndUpdate({ _id: medId, user: userId }, data, { new: true });
}

export async function deleteMedication(userId, medId) {
  return Medication.findOneAndDelete({ _id: medId, user: userId });
}

// ─── DAILY SUMMARY ────────────────────────────────────────────────────────────
export async function getDailySummary(userId, date) {
  const d = date || todayStr();
  const log = await WellnessLog.findOne({ user: userId, date: d }).lean();
  return log || { date: d, mood: null, sleep: null, hydration: null, symptoms: null };
}

// ─── WEEKLY OVERVIEW ──────────────────────────────────────────────────────────
export async function getWeeklyOverview(userId) {
  const logs = await WellnessLog.find({ user: userId })
    .sort({ date: -1 })
    .limit(7)
    .lean();
  return logs;
}
