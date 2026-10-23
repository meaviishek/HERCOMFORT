import * as svc from '../service/wellness.service.js';

const ok  = (res, data) => res.json({ success: true, data });
const err = (res, e, status = 500) => res.status(status).json({ success: false, message: e.message || "Server error" });

// ── Mood ──────────────────────────────────────────────────────────────────────
export const logMood = async (req, res) => {
  try { ok(res, await svc.logMood(req.user._id, req.body)); } catch (e) { err(res, e); }
};
export const getMoodHistory = async (req, res) => {
  try { ok(res, await svc.getMoodHistory(req.user._id, Number(req.query.days) || 30)); } catch (e) { err(res, e); }
};

// ── Sleep ─────────────────────────────────────────────────────────────────────
export const logSleep = async (req, res) => {
  try { ok(res, await svc.logSleep(req.user._id, req.body)); } catch (e) { err(res, e); }
};
export const getSleepHistory = async (req, res) => {
  try { ok(res, await svc.getSleepHistory(req.user._id, Number(req.query.days) || 30)); } catch (e) { err(res, e); }
};
export const getSleepInsights = async (req, res) => {
  try { ok(res, await svc.getSleepInsights(req.user._id)); } catch (e) { err(res, e); }
};

// ── Hydration ─────────────────────────────────────────────────────────────────
export const logHydration = async (req, res) => {
  try { ok(res, await svc.logHydration(req.user._id, req.body)); } catch (e) { err(res, e); }
};
export const addHydration = async (req, res) => {
  try { ok(res, await svc.addHydration(req.user._id, req.body)); } catch (e) { err(res, e); }
};
export const getTodayHydration = async (req, res) => {
  try { ok(res, await svc.getTodayHydration(req.user._id)); } catch (e) { err(res, e); }
};
export const getHydrationHistory = async (req, res) => {
  try { ok(res, await svc.getHydrationHistory(req.user._id, Number(req.query.days) || 7)); } catch (e) { err(res, e); }
};

// ── Symptoms ──────────────────────────────────────────────────────────────────
export const logSymptoms = async (req, res) => {
  try { ok(res, await svc.logSymptoms(req.user._id, req.body)); } catch (e) { err(res, e); }
};
export const getSymptomsHistory = async (req, res) => {
  try { ok(res, await svc.getSymptomsHistory(req.user._id, Number(req.query.days) || 30)); } catch (e) { err(res, e); }
};
export const getSymptomInsights = async (req, res) => {
  try { ok(res, await svc.getSymptomInsights(req.user._id)); } catch (e) { err(res, e); }
};

// ── Medications ───────────────────────────────────────────────────────────────
export const getMedications = async (req, res) => {
  try { ok(res, await svc.getMedications(req.user._id)); } catch (e) { err(res, e); }
};
export const addMedication = async (req, res) => {
  try { ok(res, await svc.addMedication(req.user._id, req.body)); } catch (e) { err(res, e); }
};
export const updateMedication = async (req, res) => {
  try { ok(res, await svc.updateMedication(req.user._id, req.params.id, req.body)); } catch (e) { err(res, e); }
};
export const deleteMedication = async (req, res) => {
  try { ok(res, await svc.deleteMedication(req.user._id, req.params.id)); } catch (e) { err(res, e); }
};

// ── Overview ─────────────────────────────────────────────────────────────────
export const getDailySummary = async (req, res) => {
  try { ok(res, await svc.getDailySummary(req.user._id, req.query.date)); } catch (e) { err(res, e); }
};
export const getWeeklyOverview = async (req, res) => {
  try { ok(res, await svc.getWeeklyOverview(req.user._id)); } catch (e) { err(res, e); }
};

export default {
  logMood, getMoodHistory,
  logSleep, getSleepHistory, getSleepInsights,
  logHydration, addHydration, getTodayHydration, getHydrationHistory,
  logSymptoms, getSymptomsHistory, getSymptomInsights,
  getMedications, addMedication, updateMedication, deleteMedication,
  getDailySummary, getWeeklyOverview,
};
